import { Account, AccountStatus } from '@0xsequence/account'
import { signAuthorization, AuthorizationOptions } from '@0xsequence/auth'
import { commons } from '@0xsequence/core'
import {
  ChainId,
  ChainIdLike,
  findNetworkConfig,
  findSupportedNetwork,
  NetworkConfig,
  EIP1193Provider,
  JsonRpcResponse
} from '@0xsequence/network'
import { logger, toHexString, TypedData } from '@0xsequence/utils'
import { ethers } from 'ethers'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'

import { fromExtended } from '../extended'
import { validateTransactionRequest } from '../transactions'
import {
  ConnectDetails,
  ConnectOptions,
  ErrSignedInRequired,
  MessageToSign,
  NetworkedConnectOptions,
  OpenWalletIntent,
  PromptConnectDetails,
  ProviderEventTypes,
  ProviderMessageRequest,
  ProviderMessageRequestHandler,
  ProviderMessageResponse,
  ProviderRpcError,
  TypedEventEmitter,
  WalletSession
} from '../types'
import { prefixEIP191Message } from '../utils'

const SIGNER_READY_TIMEOUT = 10000

export interface WalletSignInOptions {
  connect?: boolean
  defaultNetworkId?: number
}

export class WalletRequestHandler implements EIP1193Provider, ProviderMessageRequestHandler {
  // signer interface of the wallet. A null value means there is no signer (ie. user not signed in). An undefined
  // value means the signer state is unknown, usually meaning the wallet app is booting up and initializing. Of course
  // a Signer value is the actually interface to a signed-in account
  private account: Account | null | undefined
  private signerReadyCallbacks: Array<() => void> = []

  private prompter: WalletUserPrompter | null
  private networks: NetworkConfig[]

  private _openIntent?: OpenWalletIntent
  private _connectOptions?: ConnectOptions

  private events: TypedEventEmitter<ProviderEventTypes> = new EventEmitter() as TypedEventEmitter<ProviderEventTypes>

  onConnectOptionsChange: ((connectOptions: ConnectOptions | undefined) => void) | undefined = undefined

  constructor(account: Account | null | undefined, prompter: WalletUserPrompter | null, networks: NetworkConfig[]) {
    this.account = account
    this.prompter = prompter
    this.networks = networks
  }

  defaultChainId(): number {
    return this.prompter?.getDefaultChainId() ?? this.networks[0].chainId
  }

  async signIn(account: Account | null, options: WalletSignInOptions = {}) {
    this.setAccount(account)

    const { connect, defaultNetworkId } = options

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

    if (defaultNetworkId && this.defaultChainId() !== defaultNetworkId) {
      await this.prompter?.promptChangeNetwork(defaultNetworkId)
    }
  }

  signOut() {
    if (this.account) {
      this.notifyDisconnect()
    }

    // signed out state
    this.setAccount(null)
  }

  signerReset() {
    // resetting signer puts the wallet in an uninitialized state, which requires the app to
    // re-initiatize and set the signer either as "null" (ie. no signer) or "Signer" (ie. signed in).
    this.account = undefined
  }

  signerReady(timeout: number = SIGNER_READY_TIMEOUT): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.account !== undefined) {
        resolve()
      } else {
        setTimeout(() => {
          if (this.account === undefined) {
            this.signerReadyCallbacks = []
            reject(`signerReady timed out`)
          }
        }, timeout)
        this.signerReadyCallbacks.push(resolve)
      }
    })
  }

  async connect(options?: NetworkedConnectOptions): Promise<ConnectDetails> {
    if (!this.account) {
      return {
        connected: false,
        chainId: '0x0',
        error: 'unable to connect without signed in account'
      }
    }

    const networkId = options?.networkId ?? this.defaultChainId() ?? ChainId.MAINNET
    const chainId = findSupportedNetwork(networkId)!.chainId

    const connectDetails: ConnectDetails = {
      connected: true,
      chainId: ethers.toQuantity(chainId)
    }

    if (options && options.authorize) {
      // Perform ethauth eip712 request and construct the ConnectDetails response
      // including the auth proof
      const authOptions: AuthorizationOptions = {
        app: options.app,
        origin: options.origin,
        expiry: options.expiry,
        nonce: options.authorizeNonce
      }
      // if (typeof(options.authorize) === 'object') {
      //   authOptions = { ...authOptions, ...options.authorize }
      // }

      try {
        // TODO: Either implement account as a signer, or change signAuthorization to accept an account
        connectDetails.proof = await signAuthorization(this.account, chainId, authOptions)
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
    connectDetails.session = this.walletSession(chainId)

    return connectDetails
  }

  promptConnect = async (options?: NetworkedConnectOptions): Promise<ConnectDetails> => {
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
      connectDetails.session = await this.walletSession(options?.networkId)
    }

    return promptConnectDetails
  }

  // sendMessageRequest will unwrap the ProviderMessageRequest and send it to the JsonRpcHandler
  // (aka, the signer in this instance) and then responds with a wrapped response of
  // ProviderMessageResponse to be sent over the transport
  async sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse> {
    // Older versions of the client require the response to be jsonrpc wrapped
    const majorVersion = Number(message.clientVersion?.split('.')[0] || '0')
    const isJsonRpcResponse = majorVersion < 2
    const jsonRpcResponse: JsonRpcResponse = {
      id: message.data.id!,
      jsonrpc: '2.0',
      result: null,
      error: undefined
    }

    try {
      const result = await this.request({
        method: message.data.method,
        params: message.data.params,
        chainId: message.chainId,
        origin: message.origin,
        projectAccessKey: message.projectAccessKey
      })

      return {
        ...message,
        data: isJsonRpcResponse ? { ...jsonRpcResponse, result } : result
      }
    } catch (error) {
      return {
        ...message,
        data: isJsonRpcResponse ? { ...jsonRpcResponse, error } : { error }
      }
    }
  }

  async request(request: {
    method: string
    params?: any[]
    chainId?: number
    origin?: string
    projectAccessKey?: string
  }): Promise<any> {
    await this.getAccount()

    try {
      // only allow public json rpc method to the provider when user is not logged in, aka signer is not set
      if ((!this.account || this.account === null) && !permittedJsonRpcMethods.includes(request.method)) {
        // throw new Error(`not logged in. ${request.method} is unavailable`)
        throw ErrSignedInRequired
      }

      // wallet account
      const account = this.account
      if (!account) {
        throw new Error('WalletRequestHandler: wallet account is not configured')
      }

      // fetch the provider for the specific chain, or undefined will select defaultChain
      const provider = this.account?.providerFor(request.chainId ?? this.defaultChainId())
      if (!provider) {
        throw new Error(`WalletRequestHandler: wallet provider is not configured for chainId ${request.chainId}`)
      }

      // NOTE: we cannot use `instanceof ethers.JsonRpcProvider` because despite that we know
      // its the proper type, its not resolving properly at runtime during the pupeteer e2e tests.
      // Switching to the type guard function below is safer and more reliable.
      //
      // const jsonRpcProvider = provider instanceof ethers.JsonRpcProvider ? provider : undefined
      const jsonRpcProvider = isJsonRpcProvider(provider) ? provider : undefined

      switch (request.method) {
        case 'net_version': {
          if (!jsonRpcProvider) {
            throw new Error(`Account provider doesn't support send method`)
          }

          return await jsonRpcProvider.send('net_version', [])
        }

        case 'eth_chainId': {
          if (!jsonRpcProvider) {
            throw new Error(`Account provider doesn't support send method`)
          }

          return await jsonRpcProvider.send('eth_chainId', [])
        }

        case 'eth_accounts': {
          return [account.address]
        }

        case 'eth_getBalance': {
          const [accountAddress, blockTag] = request.params!
          const walletBalance = await provider.getBalance(accountAddress, blockTag)
          return toHexString(walletBalance)
        }

        case 'sequence_sign':
        case 'personal_sign':
        case 'eth_sign': {
          // note: message from json-rpc input is in hex format
          let message: any

          // there is a difference in the order of the params:
          // sequence_sign, personal_sign: [data, address]
          // eth_sign: [address, data]
          switch (request.method) {
            case 'sequence_sign':
            case 'personal_sign': {
              const [data, _address] = request.params!
              message = data
              break
            }
            case 'eth_sign': {
              const [_address, data] = request.params!
              message = data
              break
            }
          }

          let sig = ''

          // Message must be prefixed with "\x19Ethereum Signed Message:\n"
          // as defined by EIP-191
          const prefixedMessage = prefixEIP191Message(message)

          // TODO:
          // if (process.env.TEST_MODE === 'true' && this.prompter === null) {
          const sequenceVerified = request.method === 'sequence_sign'

          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await account.signMessage(
              prefixedMessage,
              request.chainId ?? this.defaultChainId(),
              sequenceVerified ? 'eip6492' : 'ignore'
            )
          } else {
            sig = await this.prompter.promptSignMessage(
              {
                chainId: request.chainId,
                message: ethers.getBytes(prefixedMessage),
                eip6492: sequenceVerified
              },
              request.origin,
              request.projectAccessKey
            )
          }

          if (sig && sig.length > 0) {
            return sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
        }

        case 'sequence_signTypedData_v4':
        case 'eth_signTypedData':
        case 'eth_signTypedData_v4': {
          // note: signingAddress from json-rpc input is in hex format, and typedDataObject
          // should be an object, but in some instances may be double string encoded
          const [signingAddress, typedDataObject] = request.params!

          let typedData: TypedData | undefined = undefined
          if (typeof typedDataObject === 'string') {
            try {
              typedData = JSON.parse(typedDataObject)
            } catch (e) {
              console.warn('walletRequestHandler: error parsing typedData', e)
            }
          } else {
            typedData = typedDataObject
          }

          if (!typedData || !typedData.domain || !typedData.types || !typedData.message) {
            throw new Error('invalid typedData object')
          }

          let sig = ''

          const sequenceVerified = request.method === 'sequence_signTypedData_v4'
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await account.signTypedData(
              typedData.domain,
              typedData.types,
              typedData.message,
              request.chainId ?? this.defaultChainId(),
              sequenceVerified ? 'eip6492' : 'ignore'
            )
          } else {
            sig = await this.prompter.promptSignMessage(
              {
                chainId: request.chainId,
                typedData: typedData,
                eip6492: sequenceVerified
              },
              request.origin,
              request.projectAccessKey
            )
          }

          if (sig && sig.length > 0) {
            return sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
        }

        case 'eth_sendTransaction': {
          // https://eth.wiki/json-rpc/API#eth_sendtransaction
          const transactionParams = fromExtended(request.params![0]).map(tx => {
            // eth_sendTransaction uses 'gas'
            // ethers and sequence use 'gasLimit'
            if ('gas' in tx && tx.gasLimit === undefined) {
              tx.gasLimit = tx.gas as any
              delete tx.gas
            }

            return tx
          })

          validateTransactionRequest(account.address, transactionParams)

          let txnHash = ''
          if (this.prompter === null) {
            // prompter is null, so we'll send from here
            const txnResponse = await account.sendTransaction(transactionParams, request.chainId ?? this.defaultChainId())
            txnHash = txnResponse?.hash ?? ''
          } else {
            // prompt user to provide the response
            txnHash = await this.prompter.promptSendTransaction(
              transactionParams,
              request.chainId,
              request.origin,
              request.projectAccessKey
            )
          }

          if (txnHash) {
            return txnHash
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
        }

        case 'eth_signTransaction': {
          // https://eth.wiki/json-rpc/API#eth_signTransaction
          const [transaction] = request.params!
          const sender = ethers.getAddress(transaction.from)

          if (sender !== account.address) {
            throw new Error('sender address does not match wallet')
          }

          validateTransactionRequest(account.address, transaction)

          if (this.prompter === null) {
            // The eth_signTransaction method expects a `string` return value we instead return a `SignedTransactions` object,
            // this can only be broadcasted using an RPC provider with support for signed Sequence transactions, like this one.
            //
            // TODO: verify serializing / transporting the SignedTransaction object works as expected, most likely however
            // we will want to resolveProperties the big number values to hex strings
            return await account.signTransactions(transaction, request.chainId ?? this.defaultChainId())
          } else {
            return await this.prompter.promptSignTransaction(
              transaction,
              request.chainId,
              request.origin,
              request.projectAccessKey
            )
          }
        }

        case 'eth_sendRawTransaction': {
          // NOTE: we're not using a prompter here as the transaction is already signed
          // and would have prompted the user upon signing.

          // https://eth.wiki/json-rpc/API#eth_sendRawTransaction
          if (commons.transaction.isSignedTransactionBundle(request.params![0])) {
            const txChainId = Number(request.params![0].chainId)
            const tx = await account.relayer(txChainId)!.relay(request.params![0])
            return tx.hash
          } else {
            const tx = await provider.broadcastTransaction(request.params![0])
            return tx.hash
          }
        }

        case 'eth_getTransactionCount': {
          const address = ethers.getAddress(request.params![0] as string)
          const tag = request.params![1]

          // TODO: Maybe we should fetch this data from the relayer or from the reader
          // but for now we keep it simple and just use the provider

          const count = await provider.getTransactionCount(address, tag)
          return toHexString(BigInt(count))
        }

        case 'eth_blockNumber': {
          return await provider.getBlockNumber()
        }

        case 'eth_getBlockByNumber': {
          return await provider.getBlock(request.params![0] /* , jsonRpcRequest.params[1] */)
        }

        case 'eth_getBlockByHash': {
          return await provider.getBlock(request.params![0] /* , jsonRpcRequest.params[1] */)
        }

        case 'eth_getTransactionByHash': {
          return await provider.getTransaction(request.params![0])
        }

        case 'eth_call': {
          const [transactionObject, blockTag] = request.params!
          return await provider.call({ ...transactionObject, blockTag })
        }

        case 'eth_getCode': {
          const [contractAddress, blockTag] = request.params!
          return await provider.getCode(contractAddress, blockTag)
        }

        case 'eth_estimateGas': {
          const [transactionObject] = request.params!
          return await provider.estimateGas(transactionObject)
        }

        case 'eth_gasPrice': {
          const feeData = await provider.getFeeData()
          return feeData.gasPrice === null ? null : toHexString(feeData.gasPrice)
        }

        case 'wallet_switchEthereumChain': {
          const [switchParams] = request.params!
          if (!switchParams.chainId || switchParams.chainId.length === 0) {
            throw new Error('invalid chainId')
          }

          const chainId = BigInt(switchParams.chainId)

          this.setDefaultChainId(Number(chainId))

          return null // success
        }

        // smart wallet method
        case 'sequence_getWalletContext': {
          return account.contexts
        }

        // smart wallet method
        case 'sequence_getWalletConfig': {
          const [chainId] = request.params!
          if (chainId) {
            return [(await account.status(chainId)).onChain.config]
          } else {
            return await Promise.all(
              account.networks.map(async network => {
                const status = await account.status(network.chainId)
                return status.onChain.config
              })
            )
          }
        }

        // smart wallet method
        case 'sequence_getWalletState': {
          const [chainId] = request.params!
          // TODO: Add getWalletState to the Signer interface
          if (chainId) {
            return [getLegacyWalletState(chainId, await account.status(chainId))]
          } else {
            return await Promise.all(
              account.networks.map(async network => {
                const status = await account.status(network.chainId)
                return getLegacyWalletState(network.chainId, status)
              })
            )
          }
        }

        // smart wallet method
        case 'sequence_getNetworks': {
          // NOTE: must ensure that the response result below returns clean serialized data, which is to omit
          // the provider and relayer objects and only return the urls so can be reinstantiated on dapp side.
          // This is handled by this.getNetworks() but noted here for future readers.
          return await this.getNetworks(true)
        }

        case 'sequence_isSequence': {
          return true
        }

        // smart wallet method
        case 'sequence_updateConfig': {
          throw new Error('sequence_updateConfig method is not allowed from a dapp')
          // NOTE: method is disabled as we don't need a dapp to request to update a config.
          // However, if we ever want this, we can enable it but must also use the prompter
          // for confirmation.
          //
          // const [newConfig] = request.params
          // return await signer.updateConfig(newConfig)
        }

        // smart wallet method
        case 'sequence_publishConfig': {
          throw new Error('sequence_publishConfig method is not allowed from a dapp')
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
          const [defaultChainId] = request.params!

          if (!defaultChainId) {
            throw new Error('invalid request, method argument defaultChainId cannot be empty')
          }

          this.setDefaultChainId(defaultChainId)
          return await this.getNetworks(true)
        }

        default: {
          if (!jsonRpcProvider) {
            throw new Error(`Account provider doesn't support send method`)
          }

          // NOTE: provider here will be chain-bound if chainId is provided
          return await jsonRpcProvider.send(request.method, request.params!)
        }
      }
    } catch (err) {
      logger.error(err)
      throw { message: typeof err == 'string' ? err : err?.message || 'unkown error', code: 4001 } as ProviderRpcError
    }
  }

  on<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.on(event, fn as any)
  }

  once<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.once(event, fn as any)
  }

  async getAddress(): Promise<string> {
    return this.account?.address ?? ''
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

  async setDefaultChainId(chainId: number): Promise<number> {
    await this.prompter?.promptChangeNetwork(chainId)
    return this.defaultChainId()
  }

  async getNetworks(jsonRpcResponse?: boolean): Promise<NetworkConfig[]> {
    if (!this.account) {
      logger.warn('signer not set: getNetworks is returning an empty list')
      return []
    }

    if (jsonRpcResponse) {
      // omit provider and relayer objects as they are not serializable
      return this.account.networks.map(n => {
        const network: NetworkConfig = { ...n }
        network.provider = undefined
        network.relayer = undefined
        return network
      })
    } else {
      return this.account.networks
    }
  }

  walletSession(networkId?: ChainIdLike): WalletSession | undefined {
    if (!this.account) {
      return undefined
    }

    const session = {
      walletContext: this.account.contexts,
      accountAddress: this.account.address,
      // The dapp shouldn't access the relayer directly, and the provider (as an object) is not serializable.
      networks: this.account.networks.map(n => ({ ...n, provider: undefined, relayer: undefined }))
    }

    if (networkId) {
      const network = findNetworkConfig(session.networks, networkId)

      if (network) {
        // Delete the isDefaultChain property from the session network
        session.networks?.forEach(n => delete n.isDefaultChain)

        // Add the isDefaultChain property to the network with the given networkId
        network.isDefaultChain = true
      }
    }

    return session
  }

  notifyConnect(connectDetails: ConnectDetails, origin?: string) {
    console.log('emit connect', connectDetails)
    this.events.emit('connect', connectDetails)
    if (connectDetails.session?.accountAddress) {
      this.events.emit('accountsChanged', [connectDetails.session?.accountAddress], origin)
    }
  }

  notifyDisconnect(origin?: string) {
    this.events.emit('accountsChanged', [], origin)
    this.events.emit('disconnect', undefined, origin)
  }

  notifyChainChanged(chainId: number, origin?: string) {
    this.events.emit('chainChanged', ethers.toQuantity(chainId), origin)
  }

  async notifyNetworks(networks?: NetworkConfig[]) {
    const n = networks || (await this.getNetworks(true))
    this.events.emit('networks', n)
    if (n.length > 0) {
      const defaultNetwork = n.find(network => network.chainId === this.defaultChainId())
      if (defaultNetwork) {
        this.events.emit('chainChanged', ethers.toQuantity(defaultNetwork.chainId))
      }
    } else {
      this.events.emit('chainChanged', '0x0')
    }
  }

  async notifyWalletContext() {
    if (!this.account) {
      logger.warn('signer not set: skipping to notify wallet context')
      return
    }
    const walletContext = this.account.contexts
    this.events.emit('walletContext', walletContext)
  }

  notifyClose(error?: ProviderRpcError) {
    this.events.emit('close', error)
  }

  isSignedIn = async (): Promise<boolean> => {
    await this.signerReady()
    return !!this.account
  }

  getAccount = async (): Promise<Account | null> => {
    await this.signerReady()
    if (this.account === undefined) {
      throw new Error('signerReady failed resolve')
    }
    return this.account
  }

  setAccount(account: Account | null | undefined) {
    this.account = account

    if (account !== undefined) {
      for (let i = 0; i < this.signerReadyCallbacks.length; i++) {
        this.signerReadyCallbacks[i]()
      }
      this.signerReadyCallbacks = []
    }
  }

  private async handleConfirmWalletDeployPrompt(
    prompter: WalletUserPrompter,
    account: Account,
    sequenceVerified: boolean,
    chainId?: number,
    origin?: string
  ): Promise<boolean> {
    // check if wallet is deployed and up to date, if not, prompt user to deploy
    // if no chainId is provided, we'll assume the wallet is auth chain wallet and is up to date
    if (!chainId) {
      return true
    }

    const skipsDeploy = (status: AccountStatus) => {
      return status.canOnchainValidate || (status.original.version === 2 && sequenceVerified)
    }

    const status = await account.status(chainId)
    if (skipsDeploy(status)) {
      return true
    }

    const promptResult = await prompter.promptConfirmWalletDeploy(chainId, origin)

    // if client returned true, check again to make sure wallet is deployed and up to date
    if (promptResult) {
      const status2 = await account.status(chainId)

      if (skipsDeploy(status2)) {
        return true
      } else {
        logger.error('WalletRequestHandler: result for promptConfirmWalletDeploy is not correct')
        return false
      }
    }

    return false
  }
}

export interface WalletUserPrompter {
  getDefaultChainId(): number
  promptConnect(connectOptions?: ConnectOptions): Promise<PromptConnectDetails>
  promptSignInConnect(connectOptions?: ConnectOptions): Promise<PromptConnectDetails>
  promptSignMessage(message: MessageToSign, origin?: string, projectAccessKey?: string): Promise<string>
  promptSignTransaction(
    txn: commons.transaction.Transactionish,
    chainId?: number,
    origin?: string,
    projectAccessKey?: string
  ): Promise<string>
  promptSendTransaction(
    txn: commons.transaction.Transactionish,
    chainId?: number,
    origin?: string,
    projectAccessKey?: string
  ): Promise<string>
  promptConfirmWalletDeploy(chainId: number, origin?: string): Promise<boolean>
  promptChangeNetwork(chainId: number): Promise<boolean>
}

interface LegacyWalletState {
  context: commons.context.WalletContext
  config?: commons.config.Config

  // the wallet address
  address: string

  // the chainId of the network
  chainId: number

  // whether the wallet has been ever deployed
  deployed: boolean

  // the imageHash of the `config` WalletConfig
  imageHash: string

  // the last imageHash of a WalletConfig, stored on-chain
  lastImageHash?: string

  // whether the WalletConfig object itself has been published to logs
  published?: boolean

  status: AccountStatus
}

function getLegacyWalletState(chainId: number, status: AccountStatus): LegacyWalletState {
  return {
    context: status.original.context,
    config: status.onChain.config,
    address: commons.context.addressOf(status.original.context, status.original.imageHash),
    chainId,
    deployed: status.onChain.deployed,
    imageHash: status.imageHash,
    lastImageHash: status.onChain.imageHash,
    published: true,
    status
  }
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

function isJsonRpcProvider(provider: any): provider is ethers.JsonRpcProvider {
  return (
    provider && typeof provider === 'object' && typeof provider.send === 'function' && typeof provider.getNetwork === 'function'
  )
}
