import { NetworkConfig, WalletContext, SequenceContext } from '@0xsequence/networks'
import { WalletConfig } from '@0xsequence/auth'
import { JsonRpcProvider, JsonRpcSigner, ExternalProvider } from '@ethersproject/providers'
import { ethers } from 'ethers'
import { ProviderEngine, JsonRpcMiddleware, CachedProvider, PublicProvider, loggingProviderMiddleware, allowProviderMiddleware } from './provider-engine'
import { Web3Provider } from './web3-provider'
import { SidechainProvider } from './sidechain-provider'
import { WindowMessageProvider } from './transports'
import { WalletSession, ProviderMessageEvent } from './types'

export interface WalletProvider extends WalletCommands {
  login(): Promise<boolean>
  logout(): void
  
  isConnected(): boolean
  isLoggedIn(): boolean
  getSession(): WalletSession | undefined
  getAddress(): string
  getNetwork(): NetworkConfig
  getChainId(): number

  openWallet(path?: string, state?: any): Promise<boolean>
  closeWallet(): void

  getProvider(): JsonRpcProvider
  getSigner(): JsonRpcSigner

  getWalletConfig(): WalletConfig
  getWalletContext(): WalletContext
  getWalletProviderConfig(): WalletProviderConfig

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  once(event: ProviderMessageEvent, fn: (...args: any[]) => void)
}


// TODO: move this to ./commands/index.ts
export interface WalletCommands {
  hi()
  // signMessage()
  // signTypedData()

  // sendTransaction()
  // sendTransactions()

  // sendETH()
  // sendToken()
  // callContract()

  // history()
  // getReceipt()
  // getLogs()
  // // ..

  // isWalletDeployed()
  // deployWallet()

  // validateSignature()
  // recoverWalletConfig()
}

export class Wallet implements WalletProvider {

  private config: WalletProviderConfig
  private walletConfig: WalletConfig

  private session: WalletSession | null

  private provider: Web3Provider
  private providerEngine?: ProviderEngine
  private cachedProvider?: CachedProvider
  private publicProvider?: PublicProvider
  private allowProvider?: JsonRpcMiddleware
  private windowTransportProvider?: WindowMessageProvider

  private networks: NetworkConfig[]
  private sidechainProviders: { [id: number] : Web3Provider }

  constructor(config?: WalletProviderConfig) {
    this.config = config
    if (!this.config) {
      this.config = { ...DefaultWalletProviderConfig }
    }
    this.init()
  }

  // TODO: remove..
  hi() {

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
            throw new Error('not logged in')
          }
          return isLoggedIn
        })

        // Provider proxy to support middleware stack of logging, caching and read-only rpc calls
        this.cachedProvider = new CachedProvider()

        // ..
        this.publicProvider = new PublicProvider()

        // ..
        this.windowTransportProvider = new WindowMessageProvider(this.config.windowTransport.walletAppURL)

        this.providerEngine = new ProviderEngine(this.windowTransportProvider, [
          loggingProviderMiddleware,
          this.allowProvider,
          this.cachedProvider,
          this.publicProvider
        ])

        // this.provider = this.providerEngine.createJsonRpcProvider()
        this.provider = new Web3Provider(
          this.config.walletContext,
          this.providerEngine,
          'unspecified'
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

  login = async (): Promise<boolean> => {
    if (this.isLoggedIn()) {
      return true
    }

    // authenticate
    const config = this.config

    switch (config.type) {
      case 'Window': {
        await this.openWallet('/', { login: true })
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
    this.session = null
    this.cachedProvider?.resetCache()
    window.localStorage.removeItem('_arcadeum.session')
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

  getNetwork = (): NetworkConfig => {
    const session = this.getSession()
    if (!session.network) {
      throw new Error('network has not been set by session. login first.')
    }
    return session.network
  }

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

  getProvider(): JsonRpcProvider {
    return this.provider
  }

  getAuthProvider(): JsonRpcProvider {
    const provider = this.sidechainProviders[this.getAuthNetwork().chainId]
    return provider ? provider : this.getProvider()
  }

  getAuthNetwork(): NetworkConfig {
    const net = this.networks.find((n) => n.isAuthChain)
    return net ? net : this.session.network
  }

  getSidechainProvider(chainId: number): JsonRpcProvider | undefined {
    return this.sidechainProviders[chainId]
  }

  getSidechainProviders(): { [id: number] : Web3Provider } {
    return this.sidechainProviders
  }

  getSigner(): JsonRpcSigner {
    return this.getProvider().getSigner()
  }

  getAuthSigner(): JsonRpcSigner {
    return this.getAuthProvider().getSigner()
  }

  getWalletConfig(): WalletConfig {
    return this.walletConfig
  }

  getWalletContext(): WalletContext {
    return this.config.walletContext
  }

  getWalletProviderConfig(): WalletProviderConfig {
    return this.config
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
    const data = window.localStorage.getItem('_arcadeum.session')
    if (!data || data === '') {
      return null
    }
    const session = JSON.parse(data) as WalletSession
    return session
  }

  private saveSession = (session: WalletSession) => {
    const data = JSON.stringify(session)
    window.localStorage.setItem('_arcadeum.session', data)
  }

  private useSession = async (session: WalletSession) => {
    if (!session.accountAddress || session.accountAddress === '') {
      throw new Error('session error, accountAddress is invalid')
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

    // TODO: Ethers v4 ignores the RPC url provided if the network.name is provided
    // and since ethers doesn't know about mumbai or matic, it will throw an error
    // for unknown network. Setting the network to null ensures the RPC url is used 
    // for the JsonRpcProvivider generated. I don't think Ethers V5 fixes this, but
    // we will need to test once we migrated to it.
    if (network.name == 'mumbai' || network.name == 'matic') {
      network.name = null
    }

    // TODO: with ethers v5, we can set network to 'any', then set network = null
    // anytime the network changes, and call detectNetwork(). We can reuse
    // that object instance instead of creating a new one as below.
    this.provider = new Web3Provider(
      this.config.walletContext,
      this.providerEngine,
      network.name
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
  
      const providerEngine = new ProviderEngine(sideExternalWindowProvider, [
        loggingProviderMiddleware,
        this.allowProvider,
        cachedProvider,
        publicProvider
      ])

      providers[network.chainId] = new Web3Provider(
        this.config.walletContext,
        providerEngine,
        network
      )
      return providers
    }, {} as {[id: number]: Web3Provider})

    // Save raw networks
    this.networks = networks
  }
}

export interface WalletProviderConfig {
  type: WalletProviderType

  // Global web3 provider (optional)
  web3Provider?: ExternalProvider

  // WindowProvider config (optional)
  windowTransport?: {
    // Wallet App url
    // default is https://wallet.arcadeum.net/
    walletAppURL?: string

    // ..
    // timeout?: number
  }

  // ..
  walletContext: WalletContext
}

export type WalletProviderType = 'Web3Global' | 'Window' | 'Proxy' // TODO: combo..? ie, window+proxy ..

export const DefaultWalletProviderConfig: WalletProviderConfig = {
  type: 'Window', // TODO: transports: []

  windowTransport: {
    walletAppURL: 'http://localhost:3333'
  },

  walletContext: SequenceContext
}
