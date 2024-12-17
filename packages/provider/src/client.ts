import { NetworkConfig } from '@0xsequence/network'
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
  isProviderTransport,
  messageToBytes
} from '.'
import { commons, VERSION } from '@0xsequence/core'
import { TypedData } from '@0xsequence/utils'
import { toExtended } from './extended'
import { Analytics, setupAnalytics } from './analytics'
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
    try {
      const session = this.store.getItem(SequenceClientSession.SESSION_LOCALSTORE_KEY)

      if (session) {
        return JSON.parse(session)
      }
    } catch (err) {
      console.error('Error parsing session', err)
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

export type SequenceClientOptions = {
  defaultChainId?: number
  defaultEIP6492?: boolean
  projectAccessKey?: string
  analytics?: boolean
}

/**
 *  This is a wallet client for sequence wallet-webapp. It connects using *some* transport
 *  and it allows to perform all sequence specific (or write) operations related to the wallet.
 *s
 *  It doesn't implement a full ethereum Provider, it doesn't include read-only methods.
 */

// TODO: rename Client to transport.. or something.. like SequenceTransport ..
export class SequenceClient {
  private readonly session: SequenceClientSession
  private readonly defaultChainId: DefaultChainIdTracker
  private readonly callbacks: { [K in keyof WalletEventTypes]?: WalletEventTypes[K][] } = {}

  public readonly transport: ProviderTransport

  public readonly defaultEIP6492: boolean
  public readonly projectAccessKey?: string
  public readonly analytics?: Analytics

  constructor(transport: ProviderTransport | MuxTransportTemplate, store: ItemStore, options?: SequenceClientOptions) {
    if (isMuxTransportTemplate(transport)) {
      this.transport = MuxMessageProvider.new(transport, options?.projectAccessKey)
    } else if (isProviderTransport(transport)) {
      this.transport = transport
    } else {
      throw new Error('Invalid transport')
    }

    const defaultChainId = options?.defaultChainId
    this.defaultEIP6492 = options?.defaultEIP6492 ?? false

    this.session = new SequenceClientSession(store)
    this.defaultChainId = new DefaultChainIdTracker(store, defaultChainId)

    this.transport.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length > 1) {
        console.warn('SequenceClient: wallet-webapp returned more than one account')
      }

      this.callbacks.accountsChanged?.forEach(cb => cb(accounts))
    })

    this.transport.on('connect', (response: ConnectDetails) => {
      const chainIdHex = ethers.toQuantity(this.getChainId())
      this.callbacks.connect?.forEach(cb =>
        cb({
          ...response,
          // Ignore the full connect response
          // use the chainId defined locally
          chainId: chainIdHex
        })
      )
    })

    this.transport.on('disconnect', (error, origin) => {
      this.callbacks.disconnect?.forEach(cb => cb(error, origin))
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

    this.transport.on('chainChanged', (chainIdHex, origin) => {
      this.callbacks.chainChanged?.forEach(cb => cb(chainIdHex, origin))
    })

    // We don't listen for the transport chainChanged event
    // instead we handle it locally, so we listen for changes in the store
    this.defaultChainId.onDefaultChainIdChanged((chainId: number) => {
      const chainIdHex = ethers.toQuantity(chainId)
      this.callbacks.chainChanged?.forEach(cb => cb(chainIdHex))
    })

    if (options?.projectAccessKey) {
      this.projectAccessKey = options.projectAccessKey
    }
    if (this.projectAccessKey && options?.analytics) {
      this.analytics = setupAnalytics(this.projectAccessKey)
    }

    if (this.session.getSession()?.accountAddress) {
      this.analytics?.identify(this.session.getSession()?.accountAddress?.toLowerCase())
    }
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

  onChainChanged(callback: WalletEventTypes['chainChanged']) {
    return this.registerCallback('chainChanged', callback)
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

    options.projectAccessKey = this.projectAccessKey

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

    await this.openWallet(undefined, {
      type: 'connect',
      options: { ...options, networkId: this.getChainId(), clientVersion: VERSION }
    })

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
      connectDetails.chainId = BigInt(connectDetails.chainId).toString()
    }

    if (connectDetails.connected) {
      if (!connectDetails.session) {
        throw new Error('impossible state, connect response is missing session')
      }

      this.session.setSession(connectDetails.session)

      if (connectDetails.session?.accountAddress) {
        this.analytics?.identify(connectDetails.session.accountAddress.toLowerCase())
      }
    }

    return connectDetails
  }

  disconnect() {
    if (this.isOpened()) {
      this.closeWallet()
    }

    this.analytics?.reset()

    return this.session.clearSession()
  }

  // Higher level API

  async request(request: { method: string; params?: any[]; chainId?: number }): Promise<any> {
    // Internally when sending requests we use `legacy_sign`
    // to avoid the default EIP6492 behavior overriding an explicit
    // "legacy sign" request, so we map the method here.
    request.method = this.mapSignMethod(request.method)

    const result = await this.transport.request(request)

    // We may need to unwrap the response if it's a JSON-RPC response. ie. older universal wallet versions
    return unwrapJsonRpcResponse(result)
  }

  async getNetworks(pull?: boolean): Promise<NetworkConfig[]> {
    const connectedSession = this.session.connectedSession()

    if (pull) {
      connectedSession.networks = await this.request({ method: 'sequence_getNetworks' })
      this.session.setSession(connectedSession)
    }

    return connectedSession.networks
  }

  // NOTICE: `legacy_sign` will get overriden by `send`
  // it is done this way to ensure that:
  //  - `send` handles `personal_sign` as a request for the default sign method
  //  - explicit `personal_sign` is not replaced by `sequence_sign` (if default is EI6492)
  private signMethod(options?: OptionalEIP6492) {
    if (options?.eip6492 === undefined) {
      return 'personal_sign'
    }

    return options.eip6492 ? 'sequence_sign' : 'legacy_sign'
  }

  private signTypedDataMethod(options?: OptionalEIP6492) {
    if (options?.eip6492 === undefined) {
      return 'eth_signTypedData_v4'
    }

    return options.eip6492 ? 'sequence_signTypedData_v4' : 'legacy_signTypedData_v4'
  }

  private mapSignMethod(method: string): string {
    if (method === 'personal_sign') {
      if (this.defaultEIP6492) {
        return 'sequence_sign'
      } else {
        return 'personal_sign'
      }
    }

    if (method === 'eth_signTypedData_v4') {
      if (this.defaultEIP6492) {
        return 'sequence_signTypedData_v4'
      } else {
        return 'eth_signTypedData_v4'
      }
    }

    if (method === 'legacy_sign') {
      return 'personal_sign'
    }

    if (method === 'legacy_signTypedData_v4') {
      return 'eth_signTypedData_v4'
    }

    return method
  }

  async signMessage(message: ethers.BytesLike, options?: OptionalEIP6492 & OptionalChainId): Promise<string> {
    const method = this.signMethod(options)

    this.analytics?.track({ event: 'SIGN_MESSAGE_REQUEST', props: { chainId: `${options?.chainId || this.getChainId()}` } })

    message = ethers.hexlify(messageToBytes(message))

    // Address is ignored by the wallet webapp
    return this.request({
      method,
      params: [message, this.getAddress()],
      chainId: options?.chainId
    })
  }

  async signTypedData(typedData: TypedData, options?: OptionalEIP6492 & OptionalChainId): Promise<string> {
    const method = this.signTypedDataMethod(options)

    // TODO: Stop using ethers for this, this is the only place where we use it
    // and it makes the client depend on ethers.
    const encoded = ethers.TypedDataEncoder.getPayload(typedData.domain, typedData.types, typedData.message)

    // The sign typed data will use one of the following chainIds, in order:
    // - The one provided in the options
    // - The one provided in the typedData.domain.chainId
    // - The default chainId

    this.analytics?.track({ event: 'SIGN_TYPED_DATA_REQUEST', props: { chainId: `${options?.chainId || this.getChainId()}` } })

    return this.request({
      method,
      params: [this.getAddress(), encoded],
      chainId: options?.chainId || (typedData.domain.chainId && Number(typedData.domain.chainId)) || this.getChainId()
    })
  }

  async sendTransaction(tx: ethers.TransactionRequest[] | ethers.TransactionRequest, options?: OptionalChainId): Promise<string> {
    const sequenceTxs = Array.isArray(tx) ? tx : [tx]
    const extendedTxs = toExtended(sequenceTxs)

    this.analytics?.track({ event: 'SEND_TRANSACTION_REQUEST', props: { chainId: `${options?.chainId || this.getChainId()}` } })

    return this.request({ method: 'eth_sendTransaction', params: [extendedTxs], chainId: options?.chainId })
  }

  async getWalletContext(): Promise<commons.context.VersionedContext> {
    return this.request({ method: 'sequence_getWalletContext' })
  }

  async getOnchainWalletConfig(options?: OptionalChainId): Promise<commons.config.Config> {
    // NOTICE: sequence_getWalletConfig sends the chainId as a param
    const res = await this.request({
      method: 'sequence_getWalletConfig',
      params: [options?.chainId || this.getChainId()],
      chainId: options?.chainId
    })
    return Array.isArray(res) ? res[0] : res
  }

  // NOTICE: We are leaving out all the "regular" methods os a tipical
  // JSON RPC Provider (eth_getBlockByNumber, eth_call, etc)
  // wallet-webapp does implement them, but this client is meant to be
  // exclusively used for Sequence specific methods
}

// Unwrap a JsonRpcResponse result
const unwrapJsonRpcResponse = (response: any): any => {
  if (response && typeof response === 'object' && 'jsonrpc' in response && 'result' in response) {
    return response.result
  }

  return response
}
