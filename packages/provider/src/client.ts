import { JsonRpcRequest, JsonRpcResponse, NetworkConfig } from "@0xsequence/network"
import { ConnectDetails, ConnectOptions, ItemStore, MuxMessageProvider, MuxTransportTemplate, OpenWalletIntent, OptionalChainId, OptionalEIP6492, ProviderTransport, WalletSession, isMuxTransportTemplate } from "."
import { commons } from "@0xsequence/core"
import { TypedData } from "@0xsequence/utils"
import { toExtended } from "./extended"
import { ethers } from "ethers"

type Callbacks = {
  onOpen: () => void
  onClose: () => void
  onNetworks: (networks: NetworkConfig[]) => void
  onAccountsChanged: (accounts: string[]) => void
  onWalletContext: (context: commons.context.VersionedContext) => void
  onDefaultChainIDChanged: (chainId: number) => void
}

/**
 *  This session class is meant to persist the state of the wallet connection
 *  whitin the dapp. This enables the client to retain the wallet address (and some more)
 *  even if the user refreshes the page. Otherwise we would have to open the popup again.
 */
export class SequenceClientSession {
  static readonly SESSION_LOCALSTORE_KEY = '@sequence.session'

  constructor (
    private store: ItemStore
  ) {}

  connectedSession(): Required<WalletSession> {
    const session = this.getSession()

    if (
      session &&
      session.accountAddress &&
      session.walletContext &&
      session.networks
    ) {
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
export class DefaultChainIDTracker {
  static readonly SESSION_LOCALSTORE_KEY = '@sequence.session.defaultChainId'

  callbacks: ((chainId: number) => void)[] = []

  constructor(
    private store: ItemStore,
    private startingChainId: number = 1
  ) {
    store.onItemChange(DefaultChainIDTracker.SESSION_LOCALSTORE_KEY, (value: string | null) => {
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
      this.store.setItem(DefaultChainIDTracker.SESSION_LOCALSTORE_KEY, chainId.toString())
    }
  }

  getDefaultChainId(): number {
    const read = this.store.getItem(DefaultChainIDTracker.SESSION_LOCALSTORE_KEY)

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
  private readonly defaultChainId: DefaultChainIDTracker
  private readonly callbacks: { [K in keyof Callbacks]?: Callbacks[K][] } = {}

  public readonly transport: ProviderTransport

  constructor (
    transport: ProviderTransport | MuxTransportTemplate,
    store: ItemStore,
    defaultChainId?: number
  ) {
    if (isMuxTransportTemplate(transport)) {
      this.transport = MuxMessageProvider.new(transport)
    } else {
      this.transport = transport
    }

    this.session = new SequenceClientSession(store)
    this.defaultChainId = new DefaultChainIDTracker(store, defaultChainId)

    this.transport.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length > 1) {
        console.warn('SequenceClient: wallet-webapp returned more than one account')
      }

      this.callbacks.onAccountsChanged?.forEach(cb => cb(accounts))
    })

    this.transport.on('networks', (networks: NetworkConfig[]) => {
      this.callbacks.onNetworks?.forEach(cb => cb(networks))
    })

    this.transport.on('walletContext', (context: commons.context.VersionedContext) => {
      this.callbacks.onWalletContext?.forEach(cb => cb(context))
    })

    this.transport.on('open', () => {
      this.callbacks.onOpen?.forEach(cb => cb())
    })

    this.transport.on('close', () => {
      this.callbacks.onClose?.forEach(cb => cb())
    })
  
    this.defaultChainId.onDefaultChainIdChanged((chainId: number) => {
      this.callbacks.onDefaultChainIDChanged?.forEach(cb => cb(chainId))
    })
  }

  // Callbacks

  registerCallback<K extends keyof Callbacks>(eventName: K, callback: Callbacks[K]) {
    if (!this.callbacks[eventName]) {
      this.callbacks[eventName] = []
    }
  
    this.callbacks[eventName]!.push(callback)
  
    return () => {
      this.callbacks[eventName] = this.callbacks[eventName]!.filter(c => c !== callback) as any
    }
  }

  // Individual callbacks lead to more idiomatic code

  onOpen(callback: Callbacks['onOpen']) {
    return this.registerCallback('onOpen', callback)
  }

  onClose(callback: Callbacks['onClose']) {
    return this.registerCallback('onClose', callback)
  }
  
  onNetworks(callback: Callbacks['onNetworks']) {
    return this.registerCallback('onNetworks', callback)
  }

  onAccountsChanged(callback: Callbacks['onAccountsChanged']) {
    return this.registerCallback('onAccountsChanged', callback)
  }

  // @deprecated
  onWalletContext(callback: Callbacks['onWalletContext']) {
    return this.registerCallback('onWalletContext', callback)
  }

  onDefaultChainIdChanged(callback: (chainId: number) => void) {
    return this.registerCallback('onDefaultChainIDChanged', callback)
  }

  getChainId(): number {
    return this.defaultChainId.getDefaultChainId()
  }

  setDefaultChainId(chainId: number) {
    return this.defaultChainId.setDefaultChainId(chainId)
  }

  // Proxy transport methods

  async openWallet(path?: string, intent?: OpenWalletIntent) {
    this.transport.openWallet(path, intent, 1)
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

    await this.openWallet(undefined, { type: 'connect', options })

    const connectDetails = await this.transport.waitUntilConnected().catch((error): ConnectDetails => {
      if (error instanceof Error) {
        return { connected: false, error: error.message }
      } else {
        return { connected: false, error: JSON.stringify(error) }
      }
    })

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
  send(request: JsonRpcRequest, chainId?: number): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      this.transport.sendAsync(request, (error, response) => {
        if (error) {
          reject(error)
        } else if (response === undefined) {
          reject(new Error(`Got undefined response for request: ${request}`))
        } else {
          resolve(response)
        }
      }, chainId || this.getChainId())
    })
  }

  async getNetworks(pull?: boolean): Promise<NetworkConfig[]> {
    const connectedSession = this.session.connectedSession()

    if (pull) {
      const nextNetworks = await this.send({ method: 'sequence_getNetworks' })
      connectedSession.networks = nextNetworks.result
      this.session.setSession(connectedSession)
    }

    return connectedSession.networks
  }

  getAccounts(): string[] {
    return [this.getAddress()]
  }

  async signMessage(
    message: ethers.BytesLike,
    options?: OptionalEIP6492 & OptionalChainId
  ): Promise<string> {
    const method = options?.eip6492 ? 'sequence_sign' : 'personal_sign'

    // Address is ignored by the wallet webapp
    const res = await this.send({ method, params: [message, this.getAddress()] }, options?.chainId)
    return res.result
  }

  async signTypedData(
    typedData: TypedData,
    options?: OptionalEIP6492 & OptionalChainId
  ): Promise<string> {
    const method = options?.eip6492 ? 'sequence_signTypedData_v4' : 'eth_signTypedData_v4'

    // TODO: Stop using ethers for this, this is the only place where we use it
    // and it makes the client depend on ethers.
    const encoded =  ethers.utils._TypedDataEncoder.getPayload(typedData.domain, typedData.types, typedData.message)

    // The sign typed data will use one of the following chainIds, in order:
    // - The one provided in the options
    // - The one provided in the typedData.domain.chainId
    // - The default chainId

    const res = await this.send({ method, params: [this.getAddress(), encoded] }, (
      options?.chainId ||
      (
        typedData.domain.chainId &&
        ethers.BigNumber.from(typedData.domain.chainId).toNumber()
      ) ||
      this.getChainId()
    ))
    return res.result
  }

  async sendTransaction(
    tx: (
      ethers.providers.TransactionRequest[] |
      ethers.providers.TransactionRequest
    ),
    options?: OptionalChainId
  ): Promise<string> {
    const sequenceTxs = Array.isArray(tx) ? tx : [tx]
    const extendedTxs = toExtended(sequenceTxs)

    const res = await this.send({ method: 'eth_sendTransaction', params: [extendedTxs] }, options?.chainId )
    return res.result
  }

  async getWalletContext(): Promise<commons.context.VersionedContext> {
    const res = await this.send({ method: 'sequence_getWalletContext' })
    return res.result
  }

  async getOnchainWalletConfig(options?: OptionalChainId): Promise<commons.config.Config> {
    // NOTICE: sequence_getWalletConfig sends the chainId as a param
    const res = await this.send({ method: 'sequence_getWalletConfig', params: [options?.chainId || this.getChainId()] }, options?.chainId)
    return Array.isArray(res.result) ? res.result[0] : res.result
  }

  // NOTICE: We are leaving out all the "regular" methods os a tipical
  // JSON RPC Provider (eth_getBlockByNumber, eth_call, etc)
  // wallet-webapp does implement them, but this client is meant to be
  // exclusively used for Sequence specific methods
}
