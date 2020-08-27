import { JsonRpcProvider, JsonRpcSigner, AsyncSendable } from 'ethers/providers'
import { ArcadeumWalletConfig, ArcadeumContext, NetworkConfig } from '../types'
import { ExternalWindowProvider } from './external-window-provider'
import { ProviderEngine, loggingProviderMiddleware, allowProviderMiddleware, CachedProvider, PublicProvider, JsonRpcMiddleware } from './provider-engine'
import { WalletContext } from '../context'
import { SidechainProvider } from './sidechain-provider'
import { ArcadeumWeb3Provider } from './arcadeum-web3-provider'
import { ethers } from 'ethers'

export interface IWalletProvider {
  login(): Promise<boolean>
  logout(): void
  
  isConnected(): boolean
  isLoggedIn(): boolean
  getSession(): WalletSession | undefined
  getAddress(): string
  getNetwork(): Promise<string>
  getChainId(): Promise<number>

  openWallet(path?: string, state?: any): Promise<boolean>
  closeWallet(): void

  getProvider(): JsonRpcProvider
  getSigner(): JsonRpcSigner

  getWalletConfig(): ArcadeumWalletConfig
  getWalletContext(): ArcadeumContext
  getWalletProviderConfig(): WalletProviderConfig

  on(event: WalletProviderEventType, fn: (...args: any[]) => void)
  once(event: WalletProviderEventType, fn: (...args: any[]) => void)

  // utils: ProviderUtils
}

interface ProviderUtils {
  signMessage()
  signTypedData()

  sendTransaction()
  sendTransactions()

  sendETH()
  sendToken()
  callContract()

  history()
  getReceipt()
  getLogs()
  // ..

  isWalletDeployed()
  deployWallet()

  validateSignature()
  recoverWalletConfig()
}

export type WalletProviderEventType =  'connected' | 'disconnected' | 'login' | 'logout' | 'network'

export class WalletProvider implements IWalletProvider {
  private config: WalletProviderConfig
  private walletConfig: ArcadeumWalletConfig

  private session: WalletSession | null

  private provider: ArcadeumWeb3Provider
  private providerEngine?: ProviderEngine
  private cachedProvider?: CachedProvider
  private publicProvider?: PublicProvider
  private externalWindowProvider?: ExternalWindowProvider
  private allowProvider?: JsonRpcMiddleware

  private sidechainProviders: { [id: number] : ArcadeumWeb3Provider }

  constructor(config?: WalletProviderConfig) {
    this.config = config
    if (!this.config) {
      this.config = { ...DefaultWalletProviderConfig }
    }
    this.init()
  }

  private init = () => {
    const config = this.config

    // Setup provider
    switch (config.type) {
      case 'ExternalWindow': {

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
        this.externalWindowProvider = new ExternalWindowProvider(this.config.externalWindowProvider.walletAppURL)

        this.providerEngine = new ProviderEngine(this.externalWindowProvider, [
          loggingProviderMiddleware,
          this.allowProvider,
          this.cachedProvider,
          this.publicProvider
        ])

        // this.provider = this.providerEngine.createJsonRpcProvider()
        this.provider = new ArcadeumWeb3Provider(
          this.config.walletContext,
          this.providerEngine,
          'unspecified'
        )

        this.externalWindowProvider.on('network', network => {
          this.useNetwork(network)
          this.saveSession(this.session)
        })
        this.externalWindowProvider.on('logout', () => {
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
      case 'ExternalWindow': {
        await this.openWallet('/', { login: true })
        const sessionPayload = await this.externalWindowProvider.waitUntilLoggedIn()
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
    if (this.externalWindowProvider) {
      return this.externalWindowProvider.isConnected()
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

  getNetwork = async (): Promise<string> => {
    const session = this.getSession()
    if (!session.network || session.network.name === '') {
      throw new Error('network has not been set by session. login first.')
    }
    return session.network.name
  }

  getChainId = async (): Promise<number> => {
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

    if (this.externalWindowProvider) {
      this.externalWindowProvider.openWallet(path, state)

      // TODO: handle case when popup is blocked, should return false, or throw exception
      await this.externalWindowProvider.waitUntilConnected()

      return true
    }
    return false
  }

  closeWallet = (): void => {
    if (this.externalWindowProvider) {
      this.externalWindowProvider.closeWallet()
    }
  }

  getProvider(): JsonRpcProvider {
    return this.provider
  }

  getSidechainProvider(chainId: number): JsonRpcProvider | undefined {
    return this.sidechainProviders[chainId]
  }

  getSidechainProviders(): { [id: number] : ArcadeumWeb3Provider } {
    return this.sidechainProviders
  }

  getSigner(): JsonRpcSigner {
    return this.getProvider().getSigner()
  }

  getWalletConfig(): ArcadeumWalletConfig {
    return this.walletConfig
  }

  getWalletContext(): ArcadeumContext {
    return this.config.walletContext
  }

  getWalletProviderConfig(): WalletProviderConfig {
    return this.config
  }

  on(event: WalletProviderEventType, fn: (...args: any[]) => void) {
    if (!this.externalWindowProvider) {
      return
    }
    this.externalWindowProvider.on(event, fn)
  }

  once(event: WalletProviderEventType, fn: (...args: any[]) => void) {
    if (!this.externalWindowProvider) {
      return
    }
    this.externalWindowProvider.once(event, fn)
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

    // TODO: with ethers v5, we can set network to 'any', then set network = null
    // anytime the network changes, and call detectNetwork(). We can reuse
    // that object instance instead of creating a new one as below.
    this.provider = new ArcadeumWeb3Provider(
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
        this.externalWindowProvider,
        network.chainId
      )

      const cachedProvider = new CachedProvider()
      const publicProvider = new PublicProvider(network.rpcUrl)

      const providerEngine = new ProviderEngine(sideExternalWindowProvider, [
        loggingProviderMiddleware,
        this.allowProvider,
        cachedProvider,
        publicProvider
      ])

      providers[network.chainId] = new ArcadeumWeb3Provider(
        this.config.walletContext,
        providerEngine,
        network
      )
      return providers
    }, {} as {[id: number]: ArcadeumWeb3Provider})
  }
}


export interface WalletSession {
  // Account address of the wallet
  accountAddress?: string

  // Network in use for the session
  network?: NetworkConfig

  // Caching provider responses for things such as account and chainId
  providerCache?: {[key: string]: any}
}

export interface WalletProviderConfig {
  type: WalletProviderType

  // Global web3 provider (optional)
  web3Provider?: AsyncSendable

  // ExternalWindowProvider config (optional)
  externalWindowProvider?: {
    // Wallet App url
    // default is https://wallet.arcadeum.net/
    walletAppURL?: string

    // redirect to the walletAppURL instead of opening up as a popup
    // redirectMode?: boolean

    // ..
    // timeout?: number
  }

  // ..
  walletContext: ArcadeumContext
}

export type WalletProviderType = 'Web3Global' | 'ExternalWindow'

export const DefaultWalletProviderConfig: WalletProviderConfig = {
  type: 'ExternalWindow',

  externalWindowProvider: {
    walletAppURL: 'http://localhost:3333'
  },

  walletContext: WalletContext
}
