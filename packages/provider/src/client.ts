import { JsonRpcRequest, JsonRpcResponse, NetworkConfig } from '@0xsequence/network'
import {
  ConnectDetails,
  ConnectOptions,
  ItemStore,
  MuxMessageProvider,
  MuxTransportTemplate,
  OpenWalletIntent,
  OptionalChainId,
  OptionalEIP6492,
  ProviderTransport,
  WalletEventTypes,
  WalletSession,
  isMuxTransportTemplate,
  isProviderTransport
} from '.'
import { commons } from '@0xsequence/core'
import { TypedData } from '@0xsequence/utils'
import { toExtended } from './extended'
import { ethers } from 'ethers'

/**
 *  This session class is meant to persist the state of the wallet connection
 *  whitin the dapp. This enables the client to retain the wallet address (and some more)
 *  even if the user refreshes the page. Otherwise we would have to open the popup again.
 */
export class SequenceClientSession {
  static readonly SESSION_LOCALSTORE_KEY = '@sequence.session'

  constructor(private store: ItemStore) {}

  connectedSession(): Required<WalletSession> {
    const session = this.getSession()

    if (session && session.accountAddress && session.walletContext && session.networks) {
      return {
        accountAddress: session.accountAddress!,
        walletContext: session.walletContext!,
        networks: session.networks!
      }
    }

    throw new Error('Sequence session not connected')
  }

  hasSession(): boolean {
    return this.getSession()?.accountAddress !== undefined
  }

  setSession(session: WalletSession) {
    return this.store.setItem(SequenceClientSession.SESSION_LOCALSTORE_KEY, JSON.stringify(session))
  }

  getSession(): WalletSession | undefined {
    const session = this.store.getItem(SequenceClientSession.SESSION_LOCALSTORE_KEY)

    if (session) {
      return JSON.parse(session)
    }

    return undefined
  }

  async clearSession() {
    return this.store.removeItem(SequenceClientSession.SESSION_LOCALSTORE_KEY)
  }
}

/**
 *  The wallet webapp doesn't really care what's the "default chain" for the user.
 *  so we don't even bother to send this information to the wallet. Instead, we
 *  track it locally using storage, that way the data stays always in sync.
 */
export class DefaultChainIdTracker {
  static readonly SESSION_CHAIN_ID_KEY = '@sequence.session.defaultChainId'

  callbacks: ((chainId: number) => void)[] = []

  constructor(
    private store: ItemStore,
    private startingChainId: number = 1
  ) {
    store.onItemChange(DefaultChainIdTracker.SESSION_CHAIN_ID_KEY, (value: string | null) => {
      if (value) {
        const chainId = parseInt(value)
        this.callbacks.forEach(cb => cb(chainId))
      }
    })
  }

  onDefaultChainIdChanged(callback: (chainId: number) => void) {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback)
    }
  }

  setDefaultChainId(chainId: number) {
    if (chainId !== this.getDefaultChainId()) {
      this.store.setItem(DefaultChainIdTracker.SESSION_CHAIN_ID_KEY, chainId.toString())
    }
  }

  getDefaultChainId(): number {
    const read = this.store.getItem(DefaultChainIdTracker.SESSION_CHAIN_ID_KEY)

    if (!read || read.length === 0) {
      return this.startingChainId
    }

    return parseInt(read)
  }
}

/**
 *  This is a wallet client for sequence wallet-webapp. It connects using *some* transport
 *  and it allows to perform all sequence specific (or write) operations related to the wallet.
 *
 *  It doesn't implement a full ethereum Provider, it doesn't include read-only methods.
 */
export class SequenceClient {
  private readonly session: SequenceClientSession
  private readonly defaultChainId: DefaultChainIdTracker
  private readonly callbacks: { [K in keyof WalletEventTypes]?: WalletEventTypes[K][] } = {}

  public readonly transport: ProviderTransport

  constructor(transport: ProviderTransport | MuxTransportTemplate, store: ItemStore, defaultChainId?: number) {
    if (isMuxTransportTemplate(transport)) {
      this.transport = MuxMessageProvider.new(transport)
    } else if (isProviderTransport(transport)) {
      this.transport = transport
    } else {
      throw new Error('Invalid transport')
    }

    this.session = new SequenceClientSession(store)
    this.defaultChainId = new DefaultChainIdTracker(store, defaultChainId)

    this.transport.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length > 1) {
        console.warn('SequenceClient: wallet-webapp returned more than one account')
      }

      this.callbacks.accountsChanged?.forEach(cb => cb(accounts))
    })

    this.transport.on('connect', (response: ConnectDetails) => {
      const chainIdHex = ethers.BigNumber.from(this.getChainId()).toHexString()
      this.callbacks.connect?.forEach(cb =>
        cb({
          ...response,
          // Ignore the full connect response
          // use the chainId defined locally
          chainId: chainIdHex
        })
      )
    })

    this.transport.on('disconnect', error => {
      this.callbacks.disconnect?.forEach(cb => cb(error))
    })

    this.transport.on('networks', networks => {
      this.callbacks.networks?.forEach(cb => cb(networks))
    })

    this.transport.on('walletContext', context => {
      this.callbacks.walletContext?.forEach(cb => cb(context))
    })

    this.transport.on('open', info => {
      this.callbacks.open?.forEach(cb => cb(info))
    })

    this.transport.on('close', () => {
      this.callbacks.close?.forEach(cb => cb())
    })

    // We don't listen for the transport chainChanged event
    // instead we handle it locally, so we listen for changes in the store
    this.defaultChainId.onDefaultChainIdChanged((chainId: number) => {
      const chainIdHex = ethers.utils.hexValue(chainId)
      this.callbacks.chainChanged?.forEach(cb => cb(chainIdHex))
    })
  }

  // Callbacks

  registerCallback<K extends keyof WalletEventTypes>(eventName: K, callback: WalletEventTypes[K]) {
    if (!this.callbacks[eventName]) {
      this.callbacks[eventName] = []
    }

    this.callbacks[eventName]!.push(callback)

    return () => {
      this.callbacks[eventName] = this.callbacks[eventName]!.filter(c => c !== callback) as any
    }
  }

  // Individual callbacks lead to more idiomatic code

  onOpen(callback: WalletEventTypes['open']) {
    return this.registerCallback('open', callback)
  }

  onClose(callback: WalletEventTypes['close']) {
    return this.registerCallback('close', callback)
  }

  onConnect(callback: WalletEventTypes['connect']) {
    return this.registerCallback('connect', callback)
  }

  onDisconnect(callback: WalletEventTypes['disconnect']) {
    return this.registerCallback('disconnect', callback)
  }

  onNetworks(callback: WalletEventTypes['networks']) {
    return this.registerCallback('networks', callback)
  }

  onAccountsChanged(callback: WalletEventTypes['accountsChanged']) {
    return this.registerCallback('accountsChanged', callback)
  }

  // @deprecated
  onWalletContext(callback: WalletEventTypes['walletContext']) {
    return this.registerCallback('walletContext', callback)
  }

  onDefaultChainIdChanged(callback: WalletEventTypes['chainChanged']) {
    return this.registerCallback('chainChanged', callback)
  }

  getChainId(): number {
    return this.defaultChainId.getDefaultChainId()
  }

  setDefaultChainId(chainId: number) {
    return this.defaultChainId.setDefaultChainId(chainId)
  }

  // Proxy transport methods

  async openWallet(path?: string, intent?: OpenWalletIntent) {
    this.transport.openWallet(path, intent, this.getChainId())
    await this.transport.waitUntilOpened()
    return this.isOpened()
  }

  closeWallet() {
    return this.transport.closeWallet()
  }

  isOpened(): boolean {
    return this.transport.isOpened()
  }

  isConnected(): boolean {
    return this.session.hasSession()
  }

  getSession(): WalletSession | undefined {
    return this.session.getSession()
  }

  // Basic API
  getAddress(): string {
    const session = this.session.connectedSession()
    return session.accountAddress
  }

  async connect(options: ConnectOptions): Promise<ConnectDetails> {
    if (options?.authorizeVersion === undefined) {
      // Populate default authorize version if not provided
      options.authorizeVersion = 2
    }

    if (options?.refresh === true) {
      this.disconnect()
    }

    if (options) {
      if (options.authorize) {
        if (!options.app) {
          throw new Error(`connecting with 'authorize' option also requires 'app' to be set`)
        }

        if (options.authorizeVersion === undefined) {
          options.authorizeVersion = 2
        }
      }
    }

    await this.openWallet(undefined, { type: 'connect', options: { ...options, networkId: this.getChainId() } })

    const connectDetails = await this.transport.waitUntilConnected().catch((error): ConnectDetails => {
      if (error instanceof Error) {
        return { connected: false, error: error.message }
      } else {
        return { connected: false, error: JSON.stringify(error) }
      }
    })

    // Normalize chainId into a decimal string
    // TODO: Remove this once wallet-webapp returns chainId as a string
    if (connectDetails.chainId) {
      connectDetails.chainId = ethers.BigNumber.from(connectDetails.chainId).toString()
    }

    if (connectDetails.connected) {
      if (!connectDetails.session) {
        throw new Error('impossible state, connect response is missing session')
      }

      this.session.setSession(connectDetails.session)
    }

    return connectDetails
  }

  disconnect() {
    if (this.isOpened()) {
      this.closeWallet()
    }

    return this.session.clearSession()
  }

  // Higher level API

  // Working with sendAsync is less idiomatic
  // but transport uses it instead of send, so we wrap it
  send(request: JsonRpcRequest, chainId?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.transport.sendAsync(
        request,
        (error, response) => {
          if (error) {
            reject(error)
          } else if (response === undefined) {
            reject(new Error(`Got undefined response for request: ${request}`))
          } else if (typeof response === 'object' && response.error) {
            reject(response.error)
          } else if (typeof response === 'object' && response.result) {
            resolve(response.result)
          } else {
            reject(new Error(`Got invalid response for request: ${request}`))
          }
        },
        chainId || this.getChainId()
      )
    })
  }

  async getNetworks(pull?: boolean): Promise<NetworkConfig[]> {
    const connectedSession = this.session.connectedSession()

    if (pull) {
      connectedSession.networks = await this.send({ method: 'sequence_getNetworks' })
      this.session.setSession(connectedSession)
    }

    return connectedSession.networks
  }

  async signMessage(message: ethers.BytesLike, options?: OptionalEIP6492 & OptionalChainId): Promise<string> {
    const method = options?.eip6492 ? 'sequence_sign' : 'personal_sign'

    // Address is ignored by the wallet webapp
    return this.send({ method, params: [message, this.getAddress()] }, options?.chainId)
  }

  async signTypedData(typedData: TypedData, options?: OptionalEIP6492 & OptionalChainId): Promise<string> {
    const method = options?.eip6492 ? 'sequence_signTypedData_v4' : 'eth_signTypedData_v4'

    // TODO: Stop using ethers for this, this is the only place where we use it
    // and it makes the client depend on ethers.
    const encoded = ethers.utils._TypedDataEncoder.getPayload(typedData.domain, typedData.types, typedData.message)

    // The sign typed data will use one of the following chainIds, in order:
    // - The one provided in the options
    // - The one provided in the typedData.domain.chainId
    // - The default chainId

    return this.send(
      { method, params: [this.getAddress(), encoded] },
      options?.chainId ||
        (typedData.domain.chainId && ethers.BigNumber.from(typedData.domain.chainId).toNumber()) ||
        this.getChainId()
    )
  }

  async sendTransaction(
    tx: ethers.providers.TransactionRequest[] | ethers.providers.TransactionRequest,
    options?: OptionalChainId
  ): Promise<string> {
    const sequenceTxs = Array.isArray(tx) ? tx : [tx]
    const extendedTxs = toExtended(sequenceTxs)

    return this.send({ method: 'eth_sendTransaction', params: [extendedTxs] }, options?.chainId)
  }

  async getWalletContext(): Promise<commons.context.VersionedContext> {
    return this.send({ method: 'sequence_getWalletContext' })
  }

  async getOnchainWalletConfig(options?: OptionalChainId): Promise<commons.config.Config> {
    // NOTICE: sequence_getWalletConfig sends the chainId as a param
    const res = await this.send(
      { method: 'sequence_getWalletConfig', params: [options?.chainId || this.getChainId()] },
      options?.chainId
    )
    return Array.isArray(res) ? res[0] : res
  }

  // NOTICE: We are leaving out all the "regular" methods os a tipical
  // JSON RPC Provider (eth_getBlockByNumber, eth_call, etc)
  // wallet-webapp does implement them, but this client is meant to be
  // exclusively used for Sequence specific methods
}
