import { Networks, NetworkConfig, WalletContext, sequenceContext, ChainId, JsonRpcRouter, JsonRpcMiddleware, CachedProvider, PublicProvider, loggingProviderMiddleware, allowProviderMiddleware } from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/wallet'
import { JsonRpcProvider, JsonRpcSigner, ExternalProvider } from '@ethersproject/providers'
import { ethers } from 'ethers'
import { Web3Provider, Web3Signer } from './provider'
import { SidechainProvider } from './sidechain-provider'
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

  getAddress(): string // TODO: .. Promise..?
  getNetworks(): Promise<NetworkConfig[]>
  getChainId(): number // TODO: Promise..?

  openWallet(path?: string, state?: any): Promise<boolean>
  closeWallet(): void

  getProvider(chainId?: ChainId): Web3Provider
  getSigner(chainId?: ChainId): Web3Signer

  // TODO: add more methods off Signer ..

  getWalletContext(): Promise<WalletContext>
  getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]>

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void)

  commands: WalletCommands
}

export class Wallet implements WalletProvider {
  public commands: WalletCommands

  private config: ProviderConfig
  private session: WalletSession | null

  private provider: Web3Provider
  private jsonRpcRouter?: JsonRpcRouter
  private cachedProvider?: CachedProvider
  private publicProvider?: PublicProvider
  private allowProvider?: JsonRpcMiddleware

  private windowTransportProvider?: WindowMessageProvider
  // TODO: ProxyMessageProvider ..?

  private networks: NetworkConfig[]
  private sidechainProviders: { [id: number] : Web3Provider }

  constructor(config?: ProviderConfig) { // TODO: perhaps allow Partial<ProviderConfig> and we use defaults where undefined?
    this.config = config
    if (!this.config) {
      this.config = { ...DefaultProviderConfig }
    }
    this.commands = new WalletCommands(this)
    this.init()
  }
  
  private init = () => {
    const config = this.config

    // Setup provider
    switch (config.type) {
      case 'Window': {

        // .....
        this.allowProvider = allowProviderMiddleware((): boolean => {
          const isLoggedIn = this.isLoggedIn()
          if (!isLoggedIn) {
            throw new Error('Sequence: not logged in')
          }
          return isLoggedIn
        })

        // Provider proxy to support middleware stack of logging, caching and read-only rpc calls
        this.cachedProvider = new CachedProvider()

        // ..
        this.publicProvider = new PublicProvider()

        // ..
        this.windowTransportProvider = new WindowMessageProvider(this.config.walletAppURL)

        // TODO: jsonRpcRouter needs to have multi-chain support..
        // and cache needs to be segmented by the chainId of the network..
        this.jsonRpcRouter = new JsonRpcRouter(this.windowTransportProvider, [
          loggingProviderMiddleware,
          this.allowProvider,
          this.cachedProvider,
          this.publicProvider
        ])

        this.provider = new Web3Provider(
          this.jsonRpcRouter,
          // this.config.walletContext,
          // 'any'
        )

        this.windowTransportProvider.on('network', network => {
          this.useNetwork(network)
          this.saveSession(this.session)
        })
        this.windowTransportProvider.on('logout', () => {
          this.logout()
        })

        break
      }

      case 'Web3Global': {
        // TODO: check if window.web3.currentProvider or window.ethereum exists or is set, otherwise return error
        // TODO: call window.ethereum.enable() or .connect()

        // this.provider = new Web3Provider((window as any).ethereum, 'unspecified') // TODO: check the network argument
        break
      }

      default: {
        throw new Error('unsupported provider type, must be one of ${WalletProviderType}')
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
        await this.openWallet('', { login: true }) // TODO: do we need the state thing? maybe/maybe not..
        const sessionPayload = await this.windowTransportProvider.waitUntilLoggedIn()
        this.useSession(sessionPayload)
        this.saveSession(sessionPayload)

        // setTimeout(() => {
        //   this.externalWindowProvider.closeWallet()
        // }, 2000)

        break
      }

      case 'Web3Global': {
        // TODO: for Web3Global,
        // window.ethereum.enable() ..
        // this.getSession() .. saveSession() ..
        break
      }
    }

    return this.isLoggedIn()
  }

  logout(): void {
    window.localStorage.removeItem('@sequence.session')
    this.session = null
    this.cachedProvider?.resetCache()
  }

  getProviderConfig(): ProviderConfig {
    return this.config
  }

  isConnected(): boolean {
    if (this.windowTransportProvider) {
      return this.windowTransportProvider.isConnected()
    } else {
      return false
    }
  }

  isLoggedIn(): boolean {
    return this.session !== undefined && this.session !== null &&
      this.session.network !== undefined && this.session.network !== null &&
      this.session.accountAddress.startsWith('0x')
  }

  getSession = (): WalletSession | undefined => {
    if (!this.isLoggedIn()) {
      throw new Error('login first')
    }
    return this.session
  }

  getAddress = (): string => {
    const session = this.getSession()
    return session.accountAddress
  }

  getNetworks = async (): Promise<NetworkConfig[]> => {
    const session = this.getSession()
    if (!session.network) {
      throw new Error('network has not been set by session. login first.')
    }
    // TODO: get array of networks.. we need em all..........
    // however, there is a "sidechains" argument on it, we could identify one
    // as the MainChain, etc. etc.
    return [session.network]
  }

  // getChainId returns the default dapp chain
  getChainId = (): number => {
    const session = this.getSession()
    if (!session.network || !(session.network.chainId > 0)) {
      throw new Error('network has not been set by session. login first.')
    }
    return session.network.chainId
  }

  openWallet = async (path?: string, state?: any): Promise<boolean> => {
    if (state?.login !== true && !this.isLoggedIn()) {
      throw new Error('login first')
    }

    if (this.windowTransportProvider) {
      this.windowTransportProvider.openWallet(path, state)

      // TODO: handle case when popup is blocked, should return false, or throw exception
      //
      await this.windowTransportProvider.waitUntilConnected()

      return true
    }
    return false
  }

  closeWallet = (): void => {
    if (this.windowTransportProvider) {
      this.windowTransportProvider.closeWallet()
    }
  }

  getProvider(chainId?: ChainId): Web3Provider | undefined {
    // TODO: handle chainId ..
    return this.provider
  }

  // getMainProvider() ?

  getAuthProvider(): Web3Provider {
    const provider = this.sidechainProviders[this.getAuthNetwork().chainId]
    return provider ? provider : this.getProvider()
  }

  getAuthNetwork(): NetworkConfig {
    const net = this.networks.find((n) => n.isAuthChain)
    return net ? net : this.session.network
  }

  // TODO: just use getProvider(chainId) ...
  // or perhaps we keep this and consider structure of "sidechains" field in NetworkConfig ..?
  // "sidechains" seems redundant though, instead, need to know where bridges exist instead..
  getSidechainProvider(chainId: number): JsonRpcProvider | undefined {
    return this.sidechainProviders[chainId]
  }

  getSidechainProviders(): { [id: number] : Web3Provider } {
    return this.sidechainProviders
  }

  getSigner(chainId?: ChainId): Web3Signer {
    return this.getProvider(chainId).getSigner()
  }

  getAuthSigner(): Web3Signer {
    return this.getAuthProvider().getSigner()
  }

  getWalletConfig(): Promise<WalletConfig[]> {
    // TODO: sequence_getWalletConfig can be cached by provider middleware
    return this.getSigner().getWalletConfig()
  }

  getWalletContext(): Promise<WalletContext> {
    // TODO: sequence_getWalletContext can be cached by provider middleware
    // TODO: optionally, this can be forced to a diff value by the ProviderConfig
    return this.getSigner().getWalletContext()
  }

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    if (!this.windowTransportProvider) {
      return
    }
    this.windowTransportProvider.on(event, fn)
  }

  once(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    if (!this.windowTransportProvider) {
      return
    }
    this.windowTransportProvider.once(event, fn)
  }

  private loadSession = (): WalletSession | null => {
    const data = window.localStorage.getItem('@sequence.session')
    if (!data || data === '') {
      return null
    }
    const session = JSON.parse(data) as WalletSession
    return session
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
    this.cachedProvider.setCache(session.providerCache)
    this.cachedProvider.onUpdate(() => {
      this.session.providerCache = this.cachedProvider.getCache()
      this.saveSession(this.session)
    })

    // set network
    this.useNetwork(session.network)

    // confirm the session address matches the one with the signer
    const accountAddress = await this.getSigner().getAddress()
    if (session.accountAddress.toLowerCase() !== accountAddress.toLowerCase()) {
      throw new Error('wallet account address does not match the session')
    }
  }

  private useNetwork = (network: NetworkConfig) => {
    if (!this.session) {
      this.session = {}
    }

    // TODO/review comment below and remove it..
    // TODO: Ethers v4 ignores the RPC url provided if the network.name is provided
    // and since ethers doesn't know about mumbai or matic, it will throw an error
    // for unknown network. Setting the network to null ensures the RPC url is used 
    // for the JsonRpcProvivider generated. I don't think Ethers V5 fixes this, but
    // we will need to test once we migrated to it.
    // TODO: review and maybe always set network.name to null..?
    // if (network.name == 'mumbai' || network.name == 'matic') {
    //   network.name = null
    // }

    // TODO: with ethers v5, we can set network to 'any', then set network = null
    // anytime the network changes, and call detectNetwork(). We can reuse
    // that object instance instead of creating a new one as below.
    this.provider = new Web3Provider(
      this.jsonRpcRouter,
      // this.config.walletContext,
      // null
      // 'any'
    )
    

    // ..
    this.publicProvider.setRpcUrl(network.rpcUrl)

    // seed the session cache
    this.cachedProvider.setCacheValue('net_version:[]', `${network.chainId}`)
    this.cachedProvider.setCacheValue('eth_chainId:[]', ethers.utils.hexlify(network.chainId))

    // refresh our provider cache when the network changes
    if (this.session.network && this.session.network.chainId !== network.chainId) {
      this.cachedProvider.resetCache()
      this.provider.send('eth_accounts', [])
      this.provider.send('net_version', [])
      this.provider.send('eth_chainId', [])
    }

    // update network in session
    this.session.network = network

    // update sidechain providers
    this.useSidechainNetworks(network.sidechains ? network.sidechains : [])
  }

  private useSidechainNetworks = (networks: NetworkConfig[]) => {
    // Reconstruct sidechain providers
    this.sidechainProviders = networks.reduce((providers, network) => {
      const sideExternalWindowProvider = new SidechainProvider(
        this.windowTransportProvider,
        network.chainId
      )

      const cachedProvider = new CachedProvider()
      const publicProvider = new PublicProvider(network.rpcUrl)

      cachedProvider.setCacheValue('net_version:[]', `${network.chainId}`)
      cachedProvider.setCacheValue('eth_chainId:[]', ethers.utils.hexlify(network.chainId))
  
      const jsonRpcRouter = new JsonRpcRouter(sideExternalWindowProvider, [
        loggingProviderMiddleware,
        this.allowProvider,
        cachedProvider,
        publicProvider
      ])

      providers[network.chainId] = new Web3Provider(
        jsonRpcRouter,
        // this.config.walletContext,
        network
      )
      return providers
    }, {} as {[id: number]: Web3Provider})

    // Save raw networks
    this.networks = networks
  }
}

// TODO: allow dapp to specify the requested network and provide their own rpcUrl
// for a particular chain. Probably pass "networks: object"
export interface ProviderConfig {
  type: ProviderType

  // Sequence Wallet App URL, default: https://sequence.app
  walletAppURL: string

  // Sequence Wallet Modules Context
  walletContext: WalletContext

  // Global web3 provider (optional)
  web3Provider?: ExternalProvider

  // WindowProvider config (optional)
  windowTransport?: {
    // ..
    // timeout?: number
  }

  // TODO .. we don't need this to be set, but can be provided for overrides..
  networks?: Networks // TODO: rename to networkConfig: NetworkConfig[] ?
  // and rename defaultNetwork to "network" ?

  // defaultNetwork
  defaultNetwork?: number | NetworkConfig
}

export type ProviderType = 'Web3Global' | 'Window' | 'Proxy' // TODO: combo..? ie, window+proxy ..

export const DefaultProviderConfig: ProviderConfig = {
  // TODO: check process.env for this if test or production, etc..
  walletAppURL: 'http://localhost:3333',

  walletContext: { ...sequenceContext },

  type: 'Window', // TODO: rename.. transports: []

  windowTransport: {
  }
}
