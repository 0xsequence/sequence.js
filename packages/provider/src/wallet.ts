import { Networks, NetworkConfig, WalletContext, sequenceContext, ChainId, getNetworkId, JsonRpcSender,
  JsonRpcRouter, JsonRpcMiddleware, allowProviderMiddleware, CachedProvider, PublicProvider, loggingProviderMiddleware,
  SigningProvider, EagerProvider, exceptionProviderMiddleware, networkProviderMiddleware, JsonRpcExternalProvider,
  JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, checkNetworkConfig, findNetworkConfig, updateNetworkConfig, ensureValidNetworks
} from '@0xsequence/network'
import { WalletConfig, WalletState } from '@0xsequence/config'
import { JsonRpcProvider, JsonRpcSigner, ExternalProvider } from '@ethersproject/providers'
import { Web3Provider, Web3Signer } from './provider'
import { MuxMessageProvider, WindowMessageProvider, ProxyMessageProvider, ProxyMessageChannelPort } from './transports'
import { WalletSession, ProviderMessageEvent, ConnectOptions, OpenWalletIntent } from './types'
import { WalletCommands } from './commands'
import { ethers } from 'ethers'

export interface WalletProvider {
  connect(options?: ConnectOptions): Promise<boolean>
  disconnect(): void
  
  // TODO:
  // authorize()

  isOpened(): boolean
  isConnected(): boolean
  getSession(): WalletSession | undefined

  getAddress(): Promise<string>
  getNetworks(chainId?: ChainId): Promise<NetworkConfig[]>
  getChainId(): Promise<number>
  getAuthChainId(): Promise<number>

  openWallet(path?: string, intent?: OpenWalletIntent): Promise<boolean>
  closeWallet(): void

  getProvider(chainId?: ChainId): Web3Provider | undefined
  getSigner(chainId?: ChainId): Web3Signer

  getWalletContext(): Promise<WalletContext>
  getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]>
  getWalletState(chainId?: ChainId): Promise<WalletState[]>
  isDeployed(chainId?: ChainId): Promise<boolean>

  getProviderConfig(): ProviderConfig

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void): void
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void): void

  commands: WalletCommands
}

export class Wallet implements WalletProvider {
  public commands: WalletCommands

  private config: ProviderConfig
  private session?: WalletSession

  private transport: {
    // top-level provider which connects all transport layers
    provider?: Web3Provider

    // middleware stack for provider
    router?: JsonRpcRouter
    networkProvider?: JsonRpcMiddleware
    allowProvider?: JsonRpcMiddleware
    cachedProvider?: CachedProvider

    // message communication
    messageProvider?: MuxMessageProvider
    windowMessageProvider?: WindowMessageProvider
    proxyMessageProvider?: ProxyMessageProvider
  }

  private networks: NetworkConfig[]
  private providers: { [chainId: number] : Web3Provider }


  constructor(defaultNetworkId?: string | number, config?: Partial<ProviderConfig>) {
    // config is a Partial, so that we may intersect it with the DefaultProviderConfig,
    // which allows easy overriding and control of the config.
    this.config = { ...DefaultProviderConfig }
    if (config) {
      this.config = { ...this.config, ...config }
    }
    if (defaultNetworkId) {
      this.config.defaultNetworkId = defaultNetworkId
    } else if (!this.config.defaultNetworkId) {
      this.config.defaultNetworkId = 'mainnet'
    }

    this.transport = {}
    this.networks = []
    this.providers = {}
    this.commands = new WalletCommands(this)
    this.init()
  }
  
  private init = () => {
    if (this.transport.provider) {
      // init must have already been called
      return
    }

    // Setup provider

    this.transport.messageProvider = new MuxMessageProvider()

    // multiple message provider setup, first one to connect will be the main transport
    if (this.config.transports?.windowTransport?.enabled) {
      this.transport.windowMessageProvider = new WindowMessageProvider(this.config.walletAppURL)
      this.transport.messageProvider.add(this.transport.windowMessageProvider)
    }
    if (this.config.transports?.proxyTransport?.enabled) {
      this.transport.proxyMessageProvider = new ProxyMessageProvider(this.config.transports.proxyTransport.appPort!)
      this.transport.messageProvider.add(this.transport.proxyMessageProvider)
    }
    this.transport.messageProvider.register()

    // .....
    this.transport.allowProvider = allowProviderMiddleware((request: JsonRpcRequest): boolean => {
      if (request.method === 'sequence_setDefaultNetwork') return true

      const isConnected = this.isConnected()
      if (!isConnected) {
        throw new Error('Sequence: wallet not connected')
      }
      return isConnected
    })

    // ...
    this.transport.networkProvider = networkProviderMiddleware((request: JsonRpcRequest): number => {
      // return stub chainId of 0 when not connected to any
      if (!this.networks || this.networks.length === 0) return 0

      // return the default chainId as we're connected
      return this.networks[0].chainId
    })    

    // Provider proxy to support middleware stack of logging, caching and read-only rpc calls
    this.transport.cachedProvider = new CachedProvider()
    this.transport.cachedProvider.onUpdate(() => {
      if (!this.session) this.session = { providerCache: {} }
      this.session.providerCache = this.transport.cachedProvider!.getCache()
      this.saveSession(this.session)
    })

    // ..
    this.transport.router = new JsonRpcRouter([
      loggingProviderMiddleware,
      this.transport.networkProvider,
      this.transport.allowProvider,
      exceptionProviderMiddleware,
      this.transport.cachedProvider,
    ], this.transport.messageProvider)

    this.transport.provider = new Web3Provider(this.transport.router)


    // below will update the account upon wallet connect/disconnect (aka, login/logout)
    this.transport.messageProvider.on('accountsChanged', (accounts: string[]) => {
      if (!accounts || accounts.length === 0 || accounts[0] === '') {
        this.clearSession()
      } else {
        this.useSession({ accountAddress: accounts[0] }, true)
      }
    })

    // below will update the networks automatically when the wallet networks change
    this.transport.messageProvider.on('networks', (networks: NetworkConfig[]) => {
      this.useSession({ networks: networks }, true)
    })

    // below will update the wallet context automatically
    this.transport.messageProvider.on('walletContext', (walletContext: WalletContext) => {
      this.useSession({ walletContext: walletContext }, true)
    })

    // Load existing session from localStorage
    const session = this.loadSession()
    if (session) {
      this.useSession(session, false)
    }
  }

  connect = async (options?: ConnectOptions): Promise<boolean> => {
    if (options?.refresh === true) {
      this.disconnect()
    }
    if (this.isConnected()) {
      return true
    }

    await this.openWallet(undefined, { type: 'connect', authorize: options?.authorize })
    const sessionPayload = await this.transport.messageProvider!.waitUntilConnected()
    this.useSession(sessionPayload, true)

    return this.isConnected()
  }

  disconnect(): void {
    if (this.isOpened()) {
      this.closeWallet()
    }
    this.clearSession()
  }

  getProviderConfig(): ProviderConfig {
    return this.config
  }

  isOpened(): boolean {
    return this.transport.messageProvider!.isOpened()
  }

  isConnected(): boolean {
    return this.session !== undefined &&
      this.session.networks !== undefined && this.session.networks.length > 0 &&
      this.networks !== undefined && this.networks.length > 0 &&
      this.session.accountAddress!.startsWith('0x')
  }

  getSession = (): WalletSession | undefined => {
    if (!this.isConnected()) {
      return undefined
    }
    return this.session
  }

  getAddress = async (): Promise<string> => {
    if (!this.isConnected()) {
      throw new Error('connect first')
    }
    const session = this.getSession()
    return session!.accountAddress!
  }

  getNetworks = async (chainId?: ChainId): Promise<NetworkConfig[]> => {
    if (!this.isConnected() || !this.networks) {
      throw new Error('connect first')
    }
    if (chainId) {
      // filter list to just the specific chain requested
      const network = findNetworkConfig(this.networks, chainId)
      return network ? [network] : []
    }
    return this.networks
  }

  // getChainId returns the default chain id
  getChainId = async (): Promise<number> => {
    if (!this.networks || this.networks.length < 1) {
      throw new Error('networks have not been set by session. connect first.')
    }
    // default chain id is first one in the list, by design
    const network = this.networks[0]
    if (!network.isDefaultChain) {
      throw new Error('expecting first network in list to be default chain')
    }
    return network.chainId
  }

  getAuthChainId = async (): Promise<number> => {
    if (!this.networks || this.networks.length < 1) {
      throw new Error('networks have not been set by session. connect first.')
    }
    // auth chain is first or second one in the list, by design
    const network0 = this.networks[0]
    if (network0.isAuthChain) {
      return network0.chainId
    }
    if (this.networks.length > 1) {
      const network1 = this.networks[1]
      if (network1.isAuthChain) {
        return network1.chainId
      }
    }
    throw new Error('expecting first or second network in list to be the auth chain')
  }

  openWallet = async (path?: string, intent?: OpenWalletIntent): Promise<boolean> => {
    if (intent?.type !== 'connect' && !this.isConnected()) {
      throw new Error('connect first')
    }
    
    this.transport.messageProvider!.openWallet(path, intent, this.config.defaultNetworkId)
    await this.transport.messageProvider!.waitUntilOpened()

    return true
  }

  closeWallet = (): void => {
    this.transport.messageProvider!.closeWallet()
  }

  getProvider(chainId?: ChainId): Web3Provider | undefined {
    // return the top-level provider message transport when chainId is unspecified
    // and user has not logged in
    if (!this.isConnected()) {
      if (chainId) {
        throw new Error(`session is empty. connect and try again.`)
      } else {
        return this.transport.provider
      }
    }

    let network: NetworkConfig | undefined = this.networks[0]
    if (chainId) {
      network = findNetworkConfig(this.networks, chainId)
      if (!network) {
        throw new Error(`network ${chainId} is not in the network list`)
      }
    }

    // return memoized network provider
    if (this.providers[network.chainId]) {
      return this.providers[network.chainId]
    }

    // builder web3 provider stack
    let provider: Web3Provider

    // network.provider may be set by the ProviderConfig override
    const rpcProvider = network.provider ? network.provider : new JsonRpcProvider(network.rpcUrl, network.chainId)

    if (network.isDefaultChain) {
      // communicating with defaultChain will prioritize the wallet message transport
      const router = new JsonRpcRouter([
        loggingProviderMiddleware,
        exceptionProviderMiddleware,
        new EagerProvider({ accountAddress: this.session!.accountAddress, walletContext: this.session!.walletContext }),
        new SigningProvider(this.transport!.provider!),
        this.transport.cachedProvider!,
      ], new JsonRpcSender(rpcProvider))

      provider = new Web3Provider(router)

    } else {
      // communicating with another chain will bind to that network, but will forward
      // any signing-related requests to the wallet message transport
      const router = new JsonRpcRouter([
        loggingProviderMiddleware,
        exceptionProviderMiddleware,
        new EagerProvider({ accountAddress: this.session!.accountAddress, walletContext: this.session!.walletContext, chainId: network.chainId }),
        new SigningProvider(this.transport.provider!),
        new CachedProvider(network.chainId),
      ], new JsonRpcSender(rpcProvider))

      provider = new Web3Provider(router, network.chainId)
    }

    this.providers[network.chainId] = provider
    return provider
  }

  async getAuthProvider(): Promise<Web3Provider> {
    return this.getProvider((await this.getAuthNetwork()).chainId)!
  }

  async getAuthNetwork(): Promise<NetworkConfig> {
    return (await this.getNetworks()).find((n) => n.isAuthChain)!
  }

  getAllProviders(): { [chainId: number] : Web3Provider } {
    return this.providers
  }

  getSigner(chainId?: ChainId): Web3Signer {
    return this.getProvider(chainId)!.getSigner()
  }

  async getAuthSigner(): Promise<Web3Signer> {
    return (await this.getAuthProvider()).getSigner()
  }

  getWalletConfig(): Promise<WalletConfig[]> {
    return this.getSigner().getWalletConfig()
  }

  getWalletState(): Promise<WalletState[]> {
    return this.getSigner().getWalletState()
  }

  getWalletContext(): Promise<WalletContext> {
    return this.getSigner().getWalletContext()
  }

  isDeployed(chainId?: ChainId): Promise<boolean> {
    return this.getSigner(chainId).isDeployed()
  }

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    this.transport.messageProvider!.on(event, fn)
  }

  once(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    this.transport.messageProvider!.once(event, fn)
  }

  private loadSession = (): WalletSession | undefined => {
    const data = window.localStorage.getItem('@sequence.session')
    if (!data || data === '') {
      return undefined
    }
    try {
      const session = JSON.parse(data) as WalletSession
      return session
    } catch (err) {
      console.warn('loadSession failed, unable to parse session payload from localStorage.')
      return undefined
    }
  }

  private saveSession = (session: WalletSession) => {
    const data = JSON.stringify(session)
    window.localStorage.setItem('@sequence.session', data)
  }

  private useSession = async (session: WalletSession, autoSave: boolean = true) => {
    if (!this.session) this.session = {}

    // setup wallet context
    if (this.config.walletContext) {
      this.session.walletContext = this.config.walletContext
    } else if (session.walletContext) {
      this.session.walletContext = session.walletContext
    }

    // setup account
    if (session.accountAddress) {
      this.useAccountAddress(session.accountAddress)
    }

    // setup networks
    if (session.networks) {
      this.useNetworks(session.networks)
    }

    // setup provider cache
    if (session.providerCache) {
      this.transport.cachedProvider!.setCache(session.providerCache)
    }

    // persist
    if (autoSave) {
      this.saveSession(this.session)
    }
  }

  private useAccountAddress(accountAddress: string) {
    if (!this.session) this.session = {}
    this.session.accountAddress = ethers.utils.getAddress(accountAddress)
  }

  private useNetworks(networks: NetworkConfig[]) {
    // set networks in the session
    if (!this.session) this.session = {}

    // confirm default network is set correctly
    if (this.config.defaultNetworkId && networks && networks.length > 0) {
      if (!checkNetworkConfig(networks[0], this.config.defaultNetworkId)) {
        throw new Error(`expecting defaultNetworkId '${this.config.defaultNetworkId}' but is set to '${networks[0].name}'`)
      }
    }

    // set networks on session object
    this.session.networks = networks

    // short-circuit if setting empty network list (aka logged out state)
    if (!this.session.networks || this.session.networks.length === 0) {
      return
    }

    // check if any custom network settings, otherwise return early
    if (!this.config.networks && !this.config.networkRpcUrl) {
      this.networks = networks
      return
    }

    // combine custom network config with networks in the session
    if (this.config.networks) {
      this.networks = networks.map(n => ({ ...n })) // copy
      this.config.networks.forEach(n => {
        const network = findNetworkConfig(this.networks, n.chainId || n.name!)
        if (!network) return
        updateNetworkConfig(n, network)
      })
      ensureValidNetworks(this.networks, true)
    }

    // an extra override for convenience
    if (this.config.networkRpcUrl) {
      this.networks[0].rpcUrl = this.config.networkRpcUrl
    }
  }

  private clearSession(): void {
    window.localStorage.removeItem('@sequence.session')
    this.session = undefined
    this.networks = []
    this.providers = {}
    this.transport.cachedProvider?.clearCache()
  }
}

export interface ProviderConfig {
  // Sequence Wallet App URL, default: https://sequence.app
  walletAppURL: string

  // networks is a configuration list of networks used by the wallet. This list
  // is combined with the network list supplied from the wallet upon login,
  // and settings here take precedence such as overriding a relayer setting, or rpcUrl.
  networks?: Partial<NetworkConfig>[]

  // networkRpcUrl will set the provider rpcUrl of the default network 
  networkRpcUrl?: string

  // defaultNetworkId is the primary network of a dapp and the default network a
  // provider will communicate. Note: this setting is also configurable from the
  // Wallet constructor's first argument.
  defaultNetworkId?: string | number

  // transports for dapp to wallet jron-rpc communication
  transports?: {

    // WindowMessage transport (optional)
    windowTransport?: {
      enabled: boolean
    }

    // ProxyMessage transport (optional)
    proxyTransport?: {
      enabled: boolean
      appPort?: ProxyMessageChannelPort
    }

  }

  // Sequence Wallet Modules Context override. By default (and recommended), the
  // WalletContext used the one returned by the wallet app upon login.
  //
  // NOTE: do not use this option unless you know what you're doing
  walletContext?: WalletContext

}

export const DefaultProviderConfig: ProviderConfig = {
  walletAppURL: 'https://sequence.app',

  transports: {
    windowTransport: { enabled: true },
    proxyTransport: { enabled: false }
  }
}