import { EventEmitter2 as EventEmitter } from 'eventemitter2'

import {
  ProviderMessageRequest,
  ProviderMessageResponse,
  ProviderMessageRequestHandler,
  MessageToSign,
  ProviderRpcError,
  ConnectOptions,
  ConnectDetails,
  PromptConnectDetails,
  WalletSession,
  OpenWalletIntent,
  ErrSignedInRequired,
  ProviderEventTypes,
  TypedEventEmitter
} from '../types'

import { BigNumber, ethers, providers } from 'ethers'

import { NetworkConfig, JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'
import { Signer } from '@0xsequence/wallet'
import { isSignedTransactions, TransactionRequest } from '@0xsequence/transactions'
import { signAuthorization, AuthorizationOptions } from '@0xsequence/auth'
import { logger, TypedData } from '@0xsequence/utils'

import { isWalletUpToDate, prefixEIP191Message } from '../utils'

type ExternalProvider = providers.ExternalProvider

const SIGNER_READY_TIMEOUT = 10000

export interface WalletSignInOptions {
  connect?: boolean
  mainnetNetworks?: NetworkConfig[]
  testnetNetworks?: NetworkConfig[]
  defaultNetworkId?: string | number
}

export class WalletRequestHandler implements ExternalProvider, JsonRpcHandler, ProviderMessageRequestHandler {
  // signer interface of the wallet. A null value means there is no signer (ie. user not signed in). An undefined
  // value means the signer state is unknown, usually meaning the wallet app is booting up and initializing. Of course
  // a Signer value is the actually interface to a signed-in account
  private signer: Signer | null | undefined
  private signerReadyCallbacks: Array<() => void> = []

  private prompter: WalletUserPrompter | null
  private mainnetNetworks: NetworkConfig[]
  private testnetNetworks: NetworkConfig[]

  private _openIntent?: OpenWalletIntent
  private _connectOptions?: ConnectOptions
  private _defaultNetworkId?: string | number
  private _chainId?: number

  private events: TypedEventEmitter<ProviderEventTypes> = new EventEmitter() as TypedEventEmitter<ProviderEventTypes>

  onConnectOptionsChange: ((connectOptions: ConnectOptions | undefined) => void) | undefined = undefined

  constructor(
    signer: Signer | null | undefined,
    prompter: WalletUserPrompter | null,
    mainnetNetworks: NetworkConfig[],
    testnetNetworks: NetworkConfig[] = []
  ) {
    this.signer = signer
    this.prompter = prompter
    this.mainnetNetworks = mainnetNetworks
    this.testnetNetworks = testnetNetworks
  }

  async signIn(signer: Signer | null, options: WalletSignInOptions = {}) {
    this.setSigner(signer)

    const { connect, mainnetNetworks, testnetNetworks, defaultNetworkId } = options

    if (mainnetNetworks && mainnetNetworks.length > 0) {
      this.mainnetNetworks = mainnetNetworks
    }
    if (testnetNetworks && testnetNetworks.length > 0) {
      this.testnetNetworks = testnetNetworks
    }
    if (
      (!this.mainnetNetworks || this.mainnetNetworks.length === 0) &&
      (!this.testnetNetworks || this.testnetNetworks.length === 0)
    ) {
      throw new Error('signIn failed as network configuration is empty')
    }

    const networkId = defaultNetworkId || this._defaultNetworkId
    if (networkId) {
      if (!(await this.setDefaultNetwork(networkId, false))) {
        throw new Error(`WalletRequestHandler setup unable to set defaultNetworkId ${networkId}`)
      }
    }

    // Optionally, connect the dapp and wallet. In case connectOptions are provided, we will perform
    // necessary auth request, and then notify the dapp of the 'connect' details.
    //
    // NOTE: if a user is signing into a dapp from a fresh state, and and auth request is made
    // we don't trigger the promptConnect flow, as we consider the user just authenticated
    // for this dapp, so its safe to authorize in the promptSignInConnect() which will directly
    // connect after signing in.
    //
    // NOTE: signIn can optionally connect and notify dapp at this time for new signIn flows
    if (connect) {
      const connectOptions = this._connectOptions

      let connectDetails: ConnectDetails | PromptConnectDetails

      if (this.prompter !== null) {
        connectDetails = await this.prompter?.promptSignInConnect(connectOptions)
      } else {
        connectDetails = await this.connect(connectOptions)
      }

      this.notifyConnect(connectDetails)

      if (!connectOptions || connectOptions.keepWalletOpened !== true) {
        this.notifyClose()
      }
    }
  }

  signOut() {
    // signed out state
    this.setSigner(null)
  }

  signerReset() {
    // resetting signer puts the wallet in an uninitialized state, which requires the app to
    // re-initiatize and set the signer either as "null" (ie. no signer) or "Signer" (ie. signed in).
    this.signer = undefined
  }

  signerReady(timeout: number = SIGNER_READY_TIMEOUT): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.signer !== undefined) {
        resolve()
      } else {
        setTimeout(() => {
          if (this.signer === undefined) {
            this.signerReadyCallbacks = []
            reject(`signerReady timed out`)
          }
        }, timeout)
        this.signerReadyCallbacks.push(resolve)
      }
    })
  }

  async connect(options?: ConnectOptions): Promise<ConnectDetails> {
    if (!this.signer) {
      return {
        connected: false,
        chainId: '0x0',
        error: 'unable to connect without signed in account'
      }
    }

    const connectDetails: ConnectDetails = {
      connected: true,
      chainId: ethers.utils.hexlify(await this.getChainId())
    }

    if (options && options.authorize) {
      // Perform ethauth eip712 request and construct the ConnectDetails response
      // including the auth proof
      const authOptions: AuthorizationOptions = {
        app: options.app,
        origin: options.origin,
        expiry: options.expiry
      }
      // if (typeof(options.authorize) === 'object') {
      //   authOptions = { ...authOptions, ...options.authorize }
      // }

      try {
        connectDetails.proof = await signAuthorization(this.signer, authOptions)
      } catch (err) {
        logger.warn(`connect, signAuthorization failed for options: ${JSON.stringify(options)}, due to: ${err.message}`)
        return {
          connected: false,
          chainId: '0x0',
          error: `signAuthorization failed: ${err.message}`
        }
      }
    }

    // Build session response for connect details
    connectDetails.session = await this.walletSession()

    return connectDetails
  }

  promptConnect = async (options?: ConnectOptions): Promise<ConnectDetails> => {
    if (!options && !this._connectOptions) {
      // this is an unexpected state and should not happen
      throw new Error('prompter connect options are empty')
    }

    if (!this.prompter) {
      // if prompter is null, we'll auto connect
      return this.connect(options)
    }

    const promptConnectDetails = await this.prompter.promptConnect(options || this._connectOptions).catch(_ => {
      return { connected: false } as ConnectDetails
    })

    const connectDetails: ConnectDetails = promptConnectDetails
    if (connectDetails.connected && !connectDetails.session) {
      connectDetails.session = await this.walletSession()
    }

    return promptConnectDetails
  }

  // sendMessageRequest will unwrap the ProviderMessageRequest and send it to the JsonRpcHandler
  // (aka, the signer in this instance) and then responds with a wrapped response of
  // ProviderMessageResponse to be sent over the transport
  sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse> {
    return new Promise(resolve => {
      this.sendAsync(
        message.data,
        (error: any, response?: JsonRpcResponse) => {
          // TODO: if response includes data.error, why do we need a separate error argument here?

          const responseMessage: ProviderMessageResponse = {
            ...message,
            data: response!
          }

          // NOTE: we always resolve here, are the sendAsync call will wrap any exceptions
          // in the error field of the response to ensure we send back to the user
          resolve(responseMessage)
        },
        message.chainId
      )
    })
  }

  // sendAsync implements the JsonRpcHandler interface for sending JsonRpcRequests to the wallet
  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id!,
      result: null
    }

    await this.getSigner()

    try {
      // only allow public json rpc method to the provider when user is not logged in, aka signer is not set
      if ((!this.signer || this.signer === null) && !permittedJsonRpcMethods.includes(request.method)) {
        // throw new Error(`not logged in. ${request.method} is unavailable`)
        throw ErrSignedInRequired
      }

      // wallet signer
      const signer = this.signer
      if (!signer) throw new Error('WalletRequestHandler: wallet signer is not configured')

      // fetch the provider for the specific chain, or undefined will select defaultChain
      const provider = await signer.getProvider(chainId)
      if (!provider) throw new Error(`WalletRequestHandler: wallet provider is not configured for chainId ${chainId}`)

      switch (request.method) {
        case 'net_version': {
          const result = await provider.send('net_version', [])
          response.result = result
          break
        }

        case 'eth_chainId': {
          const result = await provider.send('eth_chainId', [])
          response.result = result
          break
        }

        case 'eth_accounts': {
          const walletAddress = await signer.getAddress()
          response.result = [walletAddress]
          break
        }

        case 'eth_getBalance': {
          const [accountAddress, blockTag] = request.params!
          const walletBalance = await provider.getBalance(accountAddress, blockTag)
          response.result = walletBalance.toHexString()
          break
        }

        case 'personal_sign':
        case 'eth_sign': {
          // note: message from json-rpc input is in hex format
          let message: any

          // there is a difference in the order of the params:
          // personal_sign: [data, address]
          // eth_sign: [address, data]
          if (request.method === 'personal_sign') {
            const [data, address] = request.params!
            message = data
          } else {
            const [address, data] = request.params!
            message = data
          }

          let sig = ''

          // Message must be prefixed with "\x19Ethereum Signed Message:\n"
          // as defined by EIP-191
          const prefixedMessage = prefixEIP191Message(message)

          // TODO:
          // if (process.env.TEST_MODE === 'true' && this.prompter === null) {
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await signer.signMessage(prefixedMessage, chainId)
          } else {
            const promptResultForDeployment = await this.handleConfirmWalletDeployPrompt(this.prompter, signer, chainId)
            if (promptResultForDeployment) {
              sig = await this.prompter.promptSignMessage({ chainId: chainId, message: prefixedMessage }, this.connectOptions)
            }
          }

          if (sig && sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4': {
          // note: signingAddress from json-rpc input is in hex format, and typedDataObject
          // should be an object, but in some instances may be double string encoded
          const [signingAddress, typedDataObject] = request.params!

          let typedData: TypedData | undefined = undefined
          if (typeof typedDataObject === 'string') {
            try {
              typedData = JSON.parse(typedDataObject)
            } catch (e) {}
          } else {
            typedData = typedDataObject
          }

          if (!typedData || !typedData.domain || !typedData.types || !typedData.message) {
            throw new Error('invalid typedData object')
          }

          let sig = ''

          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainId)
          } else {
            const promptResultForDeployment = await this.handleConfirmWalletDeployPrompt(this.prompter, signer, chainId)
            if (promptResultForDeployment) {
              sig = await this.prompter.promptSignMessage({ chainId: chainId, typedData: typedData }, this.connectOptions)
            }
          }

          if (sig && sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_sendTransaction': {
          // https://eth.wiki/json-rpc/API#eth_sendtransaction
          const [transactionParams] = request.params!

          // eth_sendTransaction uses 'gas'
          // ethers and sequence use 'gasLimit'
          if ('gas' in transactionParams && transactionParams.gasLimit === undefined) {
            transactionParams.gasLimit = transactionParams.gas
            delete transactionParams.gas
          }

          let txnHash = ''
          if (this.prompter === null) {
            // prompter is null, so we'll send from here
            const txnResponse = await signer.sendTransaction(transactionParams, chainId)
            txnHash = txnResponse.hash
          } else {
            // prompt user to provide the response
            txnHash = await this.prompter.promptSendTransaction(transactionParams, chainId, this.connectOptions)
          }

          if (txnHash) {
            response.result = txnHash
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_signTransaction': {
          // https://eth.wiki/json-rpc/API#eth_signTransaction
          const [transaction] = request.params!
          const sender = ethers.utils.getAddress(transaction.from)

          if (sender !== (await signer.getAddress())) {
            throw new Error('sender address does not match wallet')
          }

          if (this.prompter === null) {
            // The eth_signTransaction method expects a `string` return value we instead return a `SignedTransactions` object,
            // this can only be broadcasted using an RPC provider with support for signed Sequence transactions, like this one.
            //
            // TODO: verify serializing / transporting the SignedTransaction object works as expected, most likely however
            // we will want to resolveProperties the bignumber values to hex strings
            response.result = await signer.signTransactions(transaction, chainId)
          } else {
            response.result = await this.prompter.promptSignTransaction(transaction, chainId, this.connectOptions)
          }

          break
        }

        case 'eth_sendRawTransaction': {
          // NOTE: we're not using a prompter here as the transaction is already signed
          // and would have prompted the user upon signing.

          // https://eth.wiki/json-rpc/API#eth_sendRawTransaction
          if (isSignedTransactions(request.params![0])) {
            const txChainId = BigNumber.from(request.params![0].chainId).toNumber()
            const tx = await (await signer.getRelayer(txChainId))!.relay(request.params![0])
            response.result = (await tx).hash
          } else {
            const tx = await provider.sendTransaction(request.params![0])
            response.result = tx.hash
          }
          break
        }

        case 'eth_getTransactionCount': {
          const address = ethers.utils.getAddress(request.params![0] as string)
          const tag = request.params![1]

          const walletAddress = ethers.utils.getAddress(await signer.getAddress())

          if (address === walletAddress) {
            const count = await signer.getTransactionCount(tag)
            response.result = ethers.BigNumber.from(count).toHexString()
          } else {
            const count = await provider.getTransactionCount(address, tag)
            response.result = ethers.BigNumber.from(count).toHexString()
          }
          break
        }

        case 'eth_blockNumber': {
          response.result = await provider.getBlockNumber()
          break
        }

        case 'eth_getBlockByNumber': {
          response.result = await provider.getBlock(request.params![0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getBlockByHash': {
          response.result = await provider.getBlock(request.params![0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getTransactionByHash': {
          response.result = await provider.getTransaction(request.params![0])
          break
        }

        case 'eth_call': {
          const [transactionObject, blockTag] = request.params!
          response.result = await provider.call(transactionObject, blockTag)
          break
        }

        case 'eth_getCode': {
          const [contractAddress, blockTag] = request.params!
          response.result = await provider.getCode(contractAddress, blockTag)
          break
        }

        case 'eth_estimateGas': {
          const [transactionObject] = request.params!
          response.result = await provider.estimateGas(transactionObject)
          break
        }

        case 'eth_gasPrice': {
          const gasPrice = await provider.getGasPrice()
          response.result = gasPrice.toHexString()
          break
        }

        case 'wallet_switchEthereumChain': {
          const [switchParams] = request.params!
          if (!switchParams.chainId || switchParams.chainId.length === 0) {
            throw new Error('invalid chainId')
          }

          const chainId = ethers.BigNumber.from(switchParams.chainId)

          const ok = await this.setDefaultNetwork(chainId.toString(), true)
          if (!ok) {
            throw new Error(`unable to set chainId ${chainId}`)
          }

          response.result = null // success
          break
        }

        // smart wallet method
        case 'sequence_getWalletContext': {
          response.result = await signer.getWalletContext()
          break
        }

        // smart wallet method
        case 'sequence_getWalletConfig': {
          const [chainId] = request.params!
          response.result = await signer.getWalletConfig(chainId)
          break
        }

        // smart wallet method
        case 'sequence_getWalletState': {
          const [chainId] = request.params!
          response.result = await signer.getWalletState(chainId)
          break
        }

        // smart wallet method
        case 'sequence_getNetworks': {
          // NOTE: must ensure that the response result below returns clean serialized data, which is to omit
          // the provider and relayer objects and only return the urls so can be reinstantiated on dapp side.
          // This is handled by this.getNetworks() but noted here for future readers.
          response.result = await this.getNetworks(true)
          break
        }

        case 'sequence_isSequence': {
          response.result = true
          break
        }

        // smart wallet method
        case 'sequence_updateConfig': {
          throw new Error('sequence_updateConfig method is not allowed from a dapp')
          // NOTE: method is disabled as we don't need a dapp to request to update a config.
          // However, if we ever want this, we can enable it but must also use the prompter
          // for confirmation.
          //
          // const [newConfig] = request.params
          // response.result = await signer.updateConfig(newConfig)
          break
        }

        // smart wallet method
        case 'sequence_publishConfig': {
          throw new Error('sequence_publishConfig method is not allowed from a dapp')
          break
        }

        // relayer method
        case 'sequence_gasRefundOptions': {
          // TODO
          break
        }

        // relayer method
        case 'sequence_getNonce': {
          // TODO
          break
        }

        // relayer method
        case 'sequence_relay': {
          // TODO
          break
        }

        // set default network of wallet
        case 'sequence_setDefaultNetwork': {
          const [defaultNetworkId] = request.params!

          if (!defaultNetworkId) {
            throw new Error('invalid request, method argument defaultNetworkId cannot be empty')
          }
          const ok = await this.setDefaultNetwork(defaultNetworkId)
          if (!ok) {
            throw new Error(`unable to set default network ${defaultNetworkId}`)
          }

          response.result = await this.getNetworks(true)
          break
        }

        default: {
          // NOTE: provider here will be chain-bound if chainId is provided
          const providerResponse = await provider.send(request.method, request.params!)
          response.result = providerResponse
        }
      }
    } catch (err) {
      logger.error(err)

      // See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1193.md#rpc-errors
      response.result = null
      response.error = {
        ...new Error(err),
        code: 4001
      }
    }

    callback(undefined, response)
  }

  on<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.on(event, fn as any)
  }

  once<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.once(event, fn as any)
  }

  async getAddress(): Promise<string> {
    if (!this.signer) {
      return ''
    } else {
      return this.signer.getAddress()
    }
  }

  async getChainId(): Promise<number> {
    if (!this.signer) {
      return 0
    } else {
      if (this._chainId) return this._chainId // memoized
      this._chainId = await this.signer.getChainId()
      return this._chainId
    }
  }

  get openIntent(): OpenWalletIntent | undefined {
    return this._openIntent
  }

  setOpenIntent(intent: OpenWalletIntent | undefined) {
    this._openIntent = intent
  }

  get connectOptions(): ConnectOptions | undefined {
    return this._connectOptions
  }

  setConnectOptions(options: ConnectOptions | undefined) {
    this._connectOptions = options

    this.onConnectOptionsChange?.(options)
  }

  get defaultNetworkId(): string | number | undefined {
    return this._defaultNetworkId
  }

  async setDefaultNetwork(chainId: string | number, notifyNetworks: boolean = true): Promise<number | undefined> {
    if (!chainId) return undefined
    this._defaultNetworkId = chainId
    this._chainId = undefined

    if (this.signer && (<any>this.signer).setNetworks) {
      const defaultChainId: number = (<any>this.signer).setNetworks(this.mainnetNetworks, this.testnetNetworks, chainId)
      if (defaultChainId && notifyNetworks) {
        await this.notifyNetworks()
      }
      return defaultChainId
    } else {
      return undefined
    }
  }

  async getNetworks(jsonRpcResponse?: boolean): Promise<NetworkConfig[]> {
    if (!this.signer) {
      logger.warn('signer not set: getNetworks is returning an empty list')
      return []
    }

    const networks = await this.signer.getNetworks()

    if (jsonRpcResponse) {
      // omit provider and relayer objects as they are not serializable
      return networks.map(n => {
        const network: NetworkConfig = { ...n }
        network.provider = undefined
        network.relayer = undefined
        return network
      })
    } else {
      return networks
    }
  }

  async walletSession(): Promise<WalletSession | undefined> {
    return !this.signer
      ? undefined
      : {
          walletContext: await this.signer.getWalletContext(),
          accountAddress: await this.signer.getAddress(),
          networks: await this.getNetworks(true)
        }
  }

  notifyConnect(connectDetails: ConnectDetails, origin?: string) {
    this.events.emit('connect', connectDetails)
    if (connectDetails.session?.accountAddress) {
      this.events.emit('accountsChanged', [connectDetails.session?.accountAddress], origin)
    }
  }

  notifyDisconnect(origin?: string) {
    this.events.emit('accountsChanged', [], origin)
    this.events.emit('disconnect')
  }

  async notifyNetworks(networks?: NetworkConfig[]) {
    const n = networks || (await this.getNetworks(true))
    this.events.emit('networks', n)
    if (n.length > 0) {
      const defaultNetwork = n.find(network => network.isDefaultChain)
      if (defaultNetwork) {
        this.events.emit('chainChanged', ethers.utils.hexlify(defaultNetwork.chainId))
      }
    } else {
      this.events.emit('chainChanged', '0x0')
    }
  }

  async notifyWalletContext() {
    if (!this.signer) {
      logger.warn('signer not set: skipping to notify wallet context')
      return
    }
    const walletContext = await this.signer.getWalletContext()
    this.events.emit('walletContext', walletContext)
  }

  notifyClose(error?: ProviderRpcError) {
    this.events.emit('close', error)
  }

  isSignedIn = async (): Promise<boolean> => {
    await this.signerReady()
    return !!this.signer
  }

  getSigner = async (): Promise<Signer | null> => {
    await this.signerReady()
    if (this.signer === undefined) {
      throw new Error('signerReady failed resolve')
    }
    return this.signer
  }

  setSigner(signer: Signer | null | undefined) {
    this.signer = signer

    if (signer !== undefined) {
      for (let i = 0; i < this.signerReadyCallbacks.length; i++) {
        this.signerReadyCallbacks[i]()
      }
      this.signerReadyCallbacks = []
    }
  }

  private async handleConfirmWalletDeployPrompt(
    prompter: WalletUserPrompter,
    signer: Signer,
    chainId?: number
  ): Promise<boolean> {
    // check if wallet is deployed and up to date, if not, prompt user to deploy
    // if no chainId is provided, we'll assume the wallet is auth chain wallet and is up to date
    if (!chainId) {
      return true
    }
    const isUpToDate = await isWalletUpToDate(signer, chainId)
    if (isUpToDate) {
      return true
    }
    const promptResult = await prompter.promptConfirmWalletDeploy(chainId, this.connectOptions)
    // if client returned true, check again to make sure wallet is deployed and up to date
    if (promptResult) {
      const isPromptResultCorrect = await isWalletUpToDate(signer, chainId)
      if (!isPromptResultCorrect) {
        logger.error('WalletRequestHandler: result for promptConfirmWalletDeploy is not correct')
        return false
      } else {
        return true
      }
    }
    return false
  }
}

export interface WalletUserPrompter {
  promptConnect(options?: ConnectOptions): Promise<PromptConnectDetails>
  promptSignInConnect(options?: ConnectOptions): Promise<PromptConnectDetails>

  promptSignMessage(message: MessageToSign, options?: ConnectOptions): Promise<string>
  promptSignTransaction(txn: TransactionRequest, chaindId?: number, options?: ConnectOptions): Promise<string>
  promptSendTransaction(txn: TransactionRequest, chaindId?: number, options?: ConnectOptions): Promise<string>
  promptConfirmWalletDeploy(chainId: number, options?: ConnectOptions): Promise<boolean>
}

const permittedJsonRpcMethods = [
  'net_version',
  'eth_chainId',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getCode',
  'eth_estimateGas',
  'eth_gasPrice',

  'sequence_getWalletContext',
  'sequence_getNetworks',
  'sequence_setDefaultNetwork'
]
