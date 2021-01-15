import { Networks, NetworkConfig, WalletContext, sequenceContext, ChainId, getNetworkId, JsonRpcSender,
  JsonRpcRouter, JsonRpcMiddleware, allowProviderMiddleware, CachedProvider, PublicProvider, loggingProviderMiddleware,
  SigningProvider, EagerProvider, exceptionProviderMiddleware, JsonRpcExternalProvider,
  JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcHandler, findNetworkConfig
} from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/config'
import { JsonRpcProvider, JsonRpcSigner, ExternalProvider } from '@ethersproject/providers'
import { Web3Provider, Web3Signer } from './provider'
import { WindowMessageProvider, ProxyMessageProvider } from './transports'
import { WalletSession, ProviderMessageEvent } from './types'
import { WalletCommands } from './commands'

export interface WalletProvider {
  login(refresh?: boolean): Promise<boolean>
  logout(): void
  
  getProviderConfig(): ProviderConfig
  isConnected(): boolean
  isLoggedIn(): boolean
  getSession(): WalletSession | undefined

  getAddress(): Promise<string>
  getNetworks(chainId?: ChainId): Promise<NetworkConfig[]>
  getChainId(): Promise<number>

  openWallet(path?: string, state?: any): Promise<boolean>
  closeWallet(): void

  getProvider(chainId?: ChainId): Web3Provider
  getSigner(chainId?: ChainId): Web3Signer

  getWalletContext(): Promise<WalletContext>
  getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]>
  isDeployed(chainId?: ChainId): Promise<boolean>

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void)

  commands: WalletCommands
}

export class Wallet implements WalletProvider {
  public commands: WalletCommands

  private config: ProviderConfig
  private session?: WalletSession

  private transport: {
    provider?: Web3Provider

    router?: JsonRpcRouter
    allowProvider?: JsonRpcMiddleware
    cachedProvider?: CachedProvider
  
    windowMessageProvider?: WindowMessageProvider
    proxyMessageProvider?: ProxyMessageProvider // TODO ..
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
    const config = this.config

    if (this.transport.provider) {
      // init must have already been called
      return
    }

    // TODO: check the config types, if we want proxy, we need method to pass here.
    // TODO: higher-order MessageBroadcaster(...transports) should go here, where we send/listen
    // on multiple channels.. or.. MessageMux(..transports) .. ie. MessageMux(windowTransport, proxyTransport)
    // this.proxyTransportProvider = new ProxyMessageProvider()


    // Setup provider
    switch (config.type) {
      // TODO: loop through types, which are just Window and Proxy
      case 'Window': {

        // .....
        this.transport.allowProvider = allowProviderMiddleware((request: JsonRpcRequest): boolean => {
          if (request.method === 'sequence_setDefaultChain') return true

          const isLoggedIn = this.isLoggedIn()
          if (!isLoggedIn) {
            throw new Error('Sequence: not logged in')
          }
          return isLoggedIn
        })

        // Provider proxy to support middleware stack of logging, caching and read-only rpc calls
        this.transport.cachedProvider = new CachedProvider()

        // ..
        this.transport.windowMessageProvider = new WindowMessageProvider(this.config.walletAppURL)
        this.transport.windowMessageProvider.register()

        // ..
        this.transport.router = new JsonRpcRouter([
          loggingProviderMiddleware,
          this.transport.allowProvider,
          exceptionProviderMiddleware,
          this.transport.cachedProvider,
        ], this.transport.windowMessageProvider)

        this.transport.provider = new Web3Provider(this.transport.router)

        // below will update the networks automatically when the wallet networks change, however
        // this is currently disabled as it may confuse the dapp. Instead the dapp can
        // check active networks list from the session and switch the default network
        // with useNetwork() explicitly
        //
        // this.windowTransportProvider.on('networks', networks => {
        //   this.useNetworks(networks)
        //   this.saveSession(this.session)
        // })
        this.transport.windowMessageProvider.on('accountsChanged', (accounts) => {
          if (accounts && accounts.length === 0) {
            this.logout()
          }
        })

        break
      }

      // TODO: add unsupported message...
      case 'Web3Global': {
        // TODO: check if window.web3.currentProvider or window.ethereum exists or is set, otherwise return error
        // TODO: call window.ethereum.enable() or .connect()

        // this.provider = new Web3Provider((window as any).ethereum, 'unspecified') // TODO: check the network argument
        break
      }

      default: {
        throw new Error('unsupported provider type, must be one of ${ProviderType}')
      }
    }

    // Load existing session from localStorage
    const session = this.loadSession()
    if (session) {
      this.useSession(session)
    }
  }

  login = async (refresh?: boolean): Promise<boolean> => {
    if (refresh === true) {
      this.logout()
    }

    if (this.isLoggedIn()) {
      return true
    }

    // TODO: need this to work with multiple transports
    // ie. Proxy and Window at same time..

    // might want to create abstraction above the transports.. for multi..

    // authenticate
    const config = this.config

    switch (config.type) {
      case 'Window': {
        await this.openWallet('', { login: true })
        const sessionPayload = await this.transport.windowMessageProvider.waitUntilLoggedIn()
        this.useSession(sessionPayload)
        break
      }

      // TODO: remove..
      // .. or, if we keep this, can we use our SDK with injected window.web3?
      case 'Web3Global': {
        // TODO: for Web3Global,
        // window.ethereum.enable() ..
        break
      }
    }

    return this.isLoggedIn()
  }

  logout(): void {
    window.localStorage.removeItem('@sequence.session')
    this.session = undefined
    this.networks = undefined
    this.providers = {}
    this.transport.cachedProvider?.clearCache()
    this.transport.cachedProvider?.onUpdate(undefined)
  }

  getProviderConfig(): ProviderConfig {
    return this.config
  }

  isConnected(): boolean {
    if (this.transport.windowMessageProvider) {
      return this.transport.windowMessageProvider.isConnected()
    } else {
      return false
    }
  }

  isLoggedIn(): boolean {
    return this.session !== undefined &&
      this.session.networks !== undefined && this.session.networks.length > 0 &&
      this.session.accountAddress.startsWith('0x')
  }

  getSession = (): WalletSession | undefined => {
    if (!this.isLoggedIn()) {
      return undefined
    }
    return this.session
  }

  getAddress = async (): Promise<string> => {
    const session = this.getSession()
    return session.accountAddress
  }

  getNetworks = async (chainId?: ChainId): Promise<NetworkConfig[]> => {
    if (!this.isLoggedIn()) {
      throw new Error('login first')
    }

    const session = this.getSession()
    if (!session.networks) {
      throw new Error('network has not been set by session. login first.')
    }

    if (chainId) {
      const network = findNetworkConfig(session.networks, chainId)
      return network ? [network] : []
    }
    return session.networks
  }

  // getChainId returns the default chain id
  getChainId = async (): Promise<number> => {
    const session = this.getSession()
    if (!session.networks || session.networks.length < 1) {
      throw new Error('networks have not been set by session. login first.')
    }
    // default chain id is first one in the list, by design
    return session.networks[0].chainId
  }

  openWallet = async (path?: string, state?: any): Promise<boolean> => {
    if (state?.login !== true && !this.isLoggedIn()) {
      throw new Error('login first')
    }

    if (this.transport.windowMessageProvider) {
      this.transport.windowMessageProvider.openWallet(path, state)

      await this.transport.windowMessageProvider.waitUntilConnected()

      // setDefaultChain - it's important to send this right away upon connection. This will also
      // update the network list in the session each time the wallet is opened & connected.
      const networks = await this.transport.provider.send('sequence_setDefaultChain', [this.config.defaultNetworkId])
      this.useNetworks(networks)

      return true
    }
    return false
  }

  closeWallet = (): void => {
    if (this.transport.windowMessageProvider) {
      this.transport.windowMessageProvider.closeWallet()
    }
  }

  getProvider(chainId?: ChainId): Web3Provider | undefined {
    // return the top-level provider message transport when chainId is unspecified
    // and user has not logged in
    if (chainId && !this.isLoggedIn()) {
      throw new Error(`session is empty. login and try again.`)
    }
    if (!chainId) {
      return this.transport.provider
    }
    if (this.session.networks.length === 0) {
      throw new Error('networks list is empty. upon logging in, networks should be populated')
    }

    let network = this.session.networks[0]
    if (chainId) {
      network = findNetworkConfig(this.session.networks, chainId)
    }

    // return memoized network provider
    if (this.providers[network.chainId]) {
      return this.providers[network.chainId]
    }

    // network.provider may be set by the ProviderConfig override
    const rpcProvider = network.provider ? network.provider : new JsonRpcProvider(network.rpcUrl, network.chainId)

    // provider stack for the respective network
    const router = new JsonRpcRouter([
      loggingProviderMiddleware,
      new EagerProvider(this.session.accountAddress), //, network.chainId),
      exceptionProviderMiddleware,
      new CachedProvider(network.chainId),
      new SigningProvider(this.transport.provider)
    ], new JsonRpcSender(rpcProvider))
    
    const provider = new Web3Provider(router, network.chainId)

    this.providers[network.chainId] = provider
    return provider
  }

  async getAuthProvider(): Promise<Web3Provider> {
    return this.getProvider((await this.getAuthNetwork()).chainId)
  }

  async getAuthNetwork(): Promise<NetworkConfig> {
    return (await this.getNetworks()).find((n) => n.isAuthChain)
  }

  getAllProviders(): { [chainId: number] : Web3Provider } {
    return this.providers
  }

  getSigner(chainId?: ChainId): Web3Signer {
    return this.getProvider(chainId).getSigner()
  }

  async getAuthSigner(): Promise<Web3Signer> {
    return (await this.getAuthProvider()).getSigner()
  }

  getWalletConfig(): Promise<WalletConfig[]> {
    return this.getSigner().getWalletConfig()
  }

  getWalletContext(): Promise<WalletContext> {
    return this.getSigner().getWalletContext()
  }

  isDeployed(chainId?: ChainId): Promise<boolean> {
    return this.getSigner(chainId).isDeployed()
  }

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    if (!this.transport.windowMessageProvider) {
      return
    }
    this.transport.windowMessageProvider.on(event, fn)
  }

  once(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    if (!this.transport.windowMessageProvider) {
      return
    }
    this.transport.windowMessageProvider.once(event, fn)
  }

  private loadSession = (): WalletSession => {
    const data = window.localStorage.getItem('@sequence.session')
    if (!data || data === '') {
      return null
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

  private useSession = async (session: WalletSession) => {
    if (!session.accountAddress || session.accountAddress === '') {
      throw new Error('session error, accountAddress is empty')
    }

    // set active session
    this.session = session

    // setup provider cache
    if (!session.providerCache) {
      session.providerCache = {}
    }
    this.transport.cachedProvider.setCache(session.providerCache)
    this.transport.cachedProvider.onUpdate(() => {
      this.session.providerCache = this.transport.cachedProvider.getCache()
      this.saveSession(this.session)
    })

    // set networks
    // TODO: build intersected list with this.config.networks
    if (session.networks) {
      this.useNetworks(session.networks)
    }

    this.saveSession(this.session)

    // confirm the session address matches the one with the signer
    const accountAddress = await this.getSigner().getAddress()
    if (session.accountAddress.toLowerCase() !== accountAddress.toLowerCase()) {
      throw new Error('wallet account address does not match the session')
    }
  }

  private useNetworks(networks: NetworkConfig[]) {
    this.networks = networks

    // hmm.. here..?
    if (!this.session) this.session = {}
    this.session.networks = networks // TODO ..

    // // ..
    // if (this.config.networks) {
    //   // intersect our this.config.networks if exists..
    //   this.networks = networks
    //   // TODO: add a method, which can combine network configs..
    // } else {
    //   this.networks = networks
    // }
  }
}

export interface ProviderConfig {
  type: ProviderType

  // Sequence Wallet App URL, default: https://sequence.app
  walletAppURL: string

  // Sequence Wallet Modules Context override. By default (and recommended), the
  // WalletContext is returned by the wallet app upon login.
  walletContext?: WalletContext

  // Global web3 provider (optional)
  // web3Provider?: ExternalProvider

  // WindowProvider config (optional)
  windowTransport?: {
    // ..
    // timeout?: number
  }

  // networks is a configuration list of networks used by the wallet. This list
  // is combined with the network list supplied from the wallet upon login,
  // and settings here take precedence such as overriding a relayer setting, or rpcUrl.
  networks?: NetworkConfig[]

  // networkRpcUrl will set the provider rpcUrl of the default network 
  networkRpcUrl?: string

  // defaultNetworkId is the primary network of a dapp and the default network a
  // provider will communicate. Note: this setting is also configurable from the
  // Wallet constructor's first argument.
  defaultNetworkId?: string | number
}

/*

const wallet = new Wallet({
  network: {
    chainId: 1,
    rpcUrl: 'https://.....',
    mode: 'mainnet'
  }
})

//--


const wallet = new Wallet('mainnet')

const wallet = new Wallet('mainnet', { etc ..})
const wallet = new Wallet(1, { walletAppURL: 'xx', networkRpcUrl: 'xxx', networks: [{ chainId: 1, rpcUrl: 'xxx' }]  })


everything can be omitted and will default to mainnet.. as..

const wallet = new Wallet()

//--


*/

// TODO: remove Web3Global ..?
export type ProviderType = 'Web3Global' | 'Window' | 'Proxy' // TODO: combo..? ie, window+proxy ..

export const DefaultProviderConfig: ProviderConfig = {
  // TODO: check process.env for this if test or production, etc..
  walletAppURL: 'http://localhost:3333',

  type: 'Window', // TODO: rename.. transports: []

  windowTransport: {
  }
}
