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
  ErrSignedInRequired,
  ProviderEventTypes,
  TypedEventEmitter
} from '../types'

import { BigNumber, ethers } from 'ethers'
import { ExternalProvider } from '@ethersproject/providers'

import {
  Networks,
  NetworkConfig,
  JsonRpcHandler,
  JsonRpcRequest,
  JsonRpcResponseCallback,
  JsonRpcResponse
} from '@0xsequence/network'

import { Signer, Account } from '@0xsequence/wallet'
import { isSignedTransactions, SignedTransactions, TransactionRequest } from '@0xsequence/transactions'

import { signAuthorization, AuthorizationOptions } from '@0xsequence/auth'

import { logger, TypedData } from '@0xsequence/utils'

export interface WalletSignInOptions {
  connect?: boolean
}

export class WalletRequestHandler implements ExternalProvider, JsonRpcHandler, ProviderMessageRequestHandler {
  private signer: Signer | null
  private prompter: WalletUserPrompter | null

  private _connectOptions?: ConnectOptions

  private events: TypedEventEmitter<ProviderEventTypes> = new EventEmitter() as TypedEventEmitter<ProviderEventTypes>

  constructor(
    signer: Signer | null,
    prompter: WalletUserPrompter | null,
    private _chainId: () => number
  ) {
    this.signer = signer
    this.prompter = prompter
  }

  async signIn(signer: Signer | null, options: WalletSignInOptions = {}) {
    this.signer = signer

    const { connect } = options

    // Optionally, connect the dapp and wallet. In case connectOptions are provided, we will perform
    // necessary auth request, and then notify the dapp of the 'connect' details.
    //
    // NOTE: if a user is signing into a dapp from a fresh state, and and auth request is made
    // we don't trigger the promptConnect flow, as we consider the user just authenticated
    // for this dapp, so its safe to authorize in the connect() method without the prompt.
    //
    // NOTE: signIn can optionally connect and notify dapp at this time for new signIn flows
    if (connect) {
      const connectOptions = this._connectOptions

      const connectDetails = await this.connect(connectOptions)
      this.notifyConnect(connectDetails)

      if (!connectOptions || connectOptions.keepWalletOpened !== true) {
        this.notifyClose()
      }
    }
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

    if (!this.prompter || !this.prompter?.promptConnect) {
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
      const provider = await signer.getProvider(chainId ?? await this.getChainId())
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

        case 'eth_sign': {
          // note: message from json-rpc input is in hex format
          const [signingAddress, message] = request.params!

          let sig = ''
          // TODO:
          // if (process.env.TEST_MODE === 'true' && this.prompter === null) {
          if (this.prompter === null || !this.prompter?.promptSignMessage) {
            // prompter is null, so we'll sign from here
            sig = await signer.signMessage(ethers.utils.arrayify(message), chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, message: message })
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
          if (this.prompter === null || !this.prompter?.promptSignMessage) {
            // prompter is null, so we'll sign from here
            sig = await signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, typedData: typedData })
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

          let txnHash = ''
          if (this.prompter === null || !this.prompter?.promptSendTransaction) {
            // prompter is null, so we'll send from here
            const txnResponse = await signer.sendTransaction(transactionParams, chainId)
            txnHash = txnResponse.hash
          } else {
            // prompt user to provide the response
            txnHash = await this.prompter.promptSendTransaction(transactionParams, chainId)
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

          if (this.prompter === null || !this.prompter?.promptSignTransaction) {
            // The eth_signTransaction method expects a `string` return value we instead return a `SignedTransactions` object,
            // this can only be broadcasted using an RPC provider with support for signed Sequence transactions, like this one.
            //
            // TODO: verify serializing / transporting the SignedTransaction object works as expected, most likely however
            // we will want to resolveProperties the bignumber values to hex strings
            response.result = await signer.signTransactions(transaction, chainId)
          } else {
            response.result = await this.prompter.promptSignTransaction(transaction, chainId)
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
        case 'sequence_estimateGasLimits': {
          // TODO
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
    return this._chainId()
  }

  get connectOptions(): ConnectOptions | undefined {
    return this._connectOptions
  }

  setConnectOptions(options: ConnectOptions | undefined) {
    this._connectOptions = options
  }

  // TODO: This should just tell the wallet-webapp
  // no need to keep an internal model of the networks / defaultNetworkId
  async setDefaultNetwork(chainId: string | number): Promise<boolean | undefined> {
    return this.prompter?.promptUseNetwork && this.prompter.promptUseNetwork(chainId)
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

  notifyConnect(connectDetails: ConnectDetails) {
    this.events.emit('connect', connectDetails)
    if (connectDetails.session?.accountAddress) {
      this.events.emit('accountsChanged', [connectDetails.session?.accountAddress])
    }
  }

  notifyDisconnect() {
    this.events.emit('accountsChanged', [])
    this.events.emit('networks', [])
    this.events.emit('disconnect')
  }

  // TODO: This should be called from wallet-webapp, not internally
  async notifyNetworks() {
    this.events.emit('chainChanged', ethers.utils.hexlify(await this.getChainId()))
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

  isSignedIn(): boolean {
    return !!this.signer
  }

  getSigner(): Signer | null {
    return this.signer
  }

  setSigner(signer: Signer | null) {
    this.signer = signer
  }
}

export interface WalletUserPrompter {
  promptConnect?(options?: ConnectOptions): Promise<PromptConnectDetails>
  promptSignMessage?(message: MessageToSign): Promise<string>
  promptSignTransaction?(txn: TransactionRequest, chaindId?: number): Promise<string>
  promptSendTransaction?(txn: TransactionRequest, chaindId?: number): Promise<string>
  promptUseNetwork?(chainId: string | number): Promise<boolean | undefined>
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
