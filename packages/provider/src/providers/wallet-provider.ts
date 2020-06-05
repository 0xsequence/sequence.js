import { ethers } from 'ethers'
import { JsonRpcProvider, JsonRpcSigner, AsyncSendable } from 'ethers/providers'
import { Network } from 'ethers/utils'
import { ArcadeumWalletConfig, ArcadeumContext } from '../types'
import { ExternalWindowProvider } from './external-window-provider'
import { ProviderProxy, loggingProviderMiddleware, publicProviderMiddleware, ProviderCache } from './provider-proxy'


export interface IWalletProvider {
  login(): Promise<boolean>
  logout(): void
  
  isConnected(): boolean
  isLoggedIn(): boolean
  getSession(): Promise<WalletSession | null>
  getAccountAddress(): Promise<string>

  getNetwork(): Network
  getChainId(): number
  setNetwork(networkName?: string): Promise<Network>

  openWallet(path?: string): Promise<boolean>

  getProvider(): JsonRpcProvider
  getSigner(): JsonRpcSigner

  getWalletConfig(): ArcadeumWalletConfig
  getWalletContext(): ArcadeumContext

  getWalletProviderConfig(): WalletProviderConfig
}

export class WalletProvider implements IWalletProvider {
  private config: WalletProviderConfig
  private walletConfig: ArcadeumWalletConfig

  private provider: JsonRpcProvider
  private session: WalletSession | null

  private externalWindowProvider?: ExternalWindowProvider

  private providerProxy?: ProviderProxy
  private providerCache?: ProviderCache

  constructor(networkName: string, config?: WalletProviderConfig) {
    this.config = config
    if (!this.config) {
      this.config = { ...DefaultWalletProviderConfig }
    }
    this.config.networkName = networkName
    this.init()
  }

  private init = () => {
    const config = this.config

    // Setup provider
    switch (config.type) {
      case 'ExternalWindow': {
        // TODO: pass a networkURL to the EWP? which we can get from a session.. and it would update, and we could fetch it too..
        this.externalWindowProvider = new ExternalWindowProvider(this.config.externalWindowProvider.walletAppURL)

        // Provider proxy to support middleware stack of logging, caching and read-only rpc calls
        this.providerCache = new ProviderCache()

        this.providerProxy = new ProviderProxy(this.externalWindowProvider, [
          loggingProviderMiddleware,
          this.providerCache,

          // TODO: specify our own jsonrpc provider url.... with our own network list, in the config..
          publicProviderMiddleware(new JsonRpcProvider('https://rinkeby.infura.io/v3/da65ffd4d3c046b3bf08a30cbe521b2e'))
        ])

        this.provider = new ethers.providers.Web3Provider(this.providerProxy, config.networkName)
        break
      }
      default: {
        throw new Error('unsupported provider type, must be one of ${WalletProviderType}')
      }
    }

    // Load existing session from localStorage
    const session = this.loadSession()
    if (session) {
      this.session = session
    }
  }

  login = async (): Promise<boolean> => {
    // reset the session before hand
    this.logout()

    // authenticate
    let loggedIn = false
    const config = this.config

    switch (config.type) {
      case 'ExternalWindow': {
        await this.openWallet('/auth')
        await this.externalWindowProvider.waitUntilLoggedIn()
        
        const session = await this.getSession()
        if (session) {
          this.saveSession(session)
          loggedIn = true
          // TODO: close the window..
          // this.externalWindowProvider.closeWallet()
        }
        break
      }

      case 'Web3Global': {
        // TODO: for Web3Global,
        // window.ethereum.enable() ..
        // this.getSession() .. saveSession() ..
        break
      }
    }


    return loggedIn
  }

  logout(): void {
    this.session = null
    this.providerCache?.resetCache()
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
    return this.session !== undefined && this.session !== null
  }

  getSession = async (): Promise<WalletSession | null> => {
    if (this.session) {
      return this.session
    }

    const session: WalletSession = { accountAddress: '' }
    session.accountAddress = await this.getSigner().getAddress()

    return session
  }

  getAccountAddress = async (): Promise<string> => {
    if (this.isLoggedIn()) {
      throw new Error('login first')
    }

    if (this.session && this.session.accountAddress !== '') {
      return this.session.accountAddress
    }

    this.session.accountAddress = await this.getSigner().getAddress()
    return this.session.accountAddress
  }

  // TODO: this info should be based on what has been connected..
  getNetwork(): Network {
    return ethers.utils.getNetwork(this.config.networkName)
  }

  getChainId(): number {
    return this.getNetwork().chainId
  }

  setNetwork(networkName?: string): Promise<Network> {
    return null
  }

  openWallet = async (path?: string): Promise<boolean> => {
    if (this.externalWindowProvider) {
      this.externalWindowProvider.openWallet()

      // TODO: handle case when popup is blocked, should return false, or throw exception
      await this.externalWindowProvider.waitUntilConnected()

      return true
    }
    return false
  }

  getProvider(): JsonRpcProvider {
    return this.provider
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

  private saveSession = (updatedSession?: WalletSession) => {
    if (updatedSession) {
      this.session = updatedSession
    }
    this.session.providerCache = this.providerCache.getCache()
    const data = JSON.stringify(this.session)
    window.localStorage.setItem('_arcadeum.session', data)
  }

  private loadSession = (): WalletSession | null => {
    const data = window.localStorage.getItem('_arcadeum.session')
    if (!data || data === '') {
      return null
    }
    const session = JSON.parse(data) as WalletSession
    this.providerCache.setCache(session.providerCache)
    return session
  }
}


export interface WalletSession {
  // Account address of the wallet
  accountAddress: string

  // Network in use for the session
  network?: {
    name: string
    chainId: number
    url: string
  }

  // Caching provider responses for things such as account and chainId
  providerCache?: {[key: string]: any}
}

export interface WalletProviderConfig {
  type: WalletProviderType

  // Ethereum network id
  networkName?: string // ie. mainnet, rinkeby, ..
  chainId?: number

  // Custom Ethereum JSON-RPC network endpoint
  networkJsonRpcURL?: string

  // Global web3 provider (optional)
  web3Provider?: AsyncSendable

  // ExternalWindowProvider config (optional)
  externalWindowProvider?: {
    // Wallet App url
    // default is https://wallet.arcadeum.net/
    walletAppURL?: string

    // timeout?: number

    // redirect to the walletAppURL instead of opening up as a popup
    // redirectMode?: boolean
  }

  networks?: object

  walletContext: ArcadeumContext
}

export type WalletProviderType = 'Web3Global' | 'ExternalWindow'

export const DefaultWalletProviderConfig: WalletProviderConfig = {
  type: 'ExternalWindow',

  externalWindowProvider: {
    walletAppURL: 'http://localhost:3000'
  },

  // TODO: should be in a single file we maintain + import,
  // but, can be overriden via the config, however, we should import it to set it
  walletContext: {
    factory: '0x52f0F4258c69415567b21dfF085C3fd5505D5155',
    mainModule: '0x621821390a694d4cBfc5892C52145B8D93ACcdEE',
    mainModuleUpgradable: '0xC7cE8a07f69F226E52AEfF57085d8C915ff265f7'
  }
}
