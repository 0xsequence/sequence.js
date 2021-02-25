import { editConfig, genConfig, SequenceUtilsFinder, WalletConfig } from "@0xsequence/config"
import { ETHAuth, Proof } from "@0xsequence/ethauth"
import { NetworkConfig, WalletContext, getAuthNetwork, findNetworkConfig } from "@0xsequence/network"
import { Account } from "@0xsequence/wallet"
import { ethers, Signer as AbstractSigner } from "ethers"
import { ArcadeumAPIClient } from '@0xsequence/api'

export type SessionMeta = {
  // name of the app requesting the session, used with ETHAuth
  name: string,

  // expiration in seconds for a session before it expires, used with ETHAuth
  expiration?: number
}

export type SessionJWT = { token: string, expiration: number }
export type SessionJWTs = { [url: string]: SessionJWT }

export interface SessionDump {
  config: WalletConfig
  context: WalletContext
  jwts: SessionJWTs
  metadata: SessionMeta
}

// Default session expiration of ETHAuth token (1 week)
export const DEFAULT_SESSION_EXPIRATION = 60*60*24*7

// Long session expiration of ETHAuth token (~1 year)
export const LONG_SESSION_EXPIRATION = 3e7

const EXPIRATION_JWT_MARGIN = 60 // seconds

export class Session implements SessionDump {
  public jwts: SessionJWTs
  public authPromises: { url: string, promise: Promise<void> }[] = []

  private onAuthCallbacks: (() => void)[] = []

  constructor(
    public config: WalletConfig,
    public context: WalletContext,
    public account: Account,
    public metadata: SessionMeta,
    jwts?: SessionJWTs,
  ) {
    this.jwts = jwts ? jwts : {}
  }

  get name(): string {
    return this.metadata.name
  }

  get expiration(): number {
    return this.metadata.expiration ? Math.max(this.metadata.expiration, 120) : DEFAULT_SESSION_EXPIRATION
  }

  onAuth(cb: () => void) {
    this.onAuthCallbacks.push(cb)
  }

  setAccount(account: Account) {
    this.account = account
  }

  setConfig(config: WalletConfig) {
    this.config = config
  }

  async auth(net: NetworkConfig | number, tries: number = 0, maxTries: number = 5): Promise<ArcadeumAPIClient> {
    const network = await this.getNetwork(net)
    const url = network.sequenceApiUrl
    if (!url) throw Error('No chaind url')

    // TODO: remove # of tries, shouldnt be necessary.

    const jwt = this.jwts[url]
    if (jwt && jwt.expiration > this.now()) {
      const api = new ArcadeumAPIClient(url)
      api.jwtAuth = jwt.token
      return api
    }

    const thisAuthPromises = this.authPromises.filter((p) => p.url === url)

    if (thisAuthPromises.length === 0) {
      if (tries >= maxTries) throw Error('Error getting JWT token')
      this.scheduleAuth(network)
      return this.auth(net, tries, maxTries)
    }

    await Promise.all(thisAuthPromises.map((p) => p.promise))
    this.authPromises = this.authPromises.filter((p) => thisAuthPromises.indexOf(p) === -1)

    return this.auth(net, tries + 1, maxTries)
  }

  scheduleAuth(net: NetworkConfig) {
    const url = net.sequenceApiUrl
    if (!url) return

    this.authPromises.push({
      url: url,
      promise: this.performAuthRequest(net)
    })
  }

  async getAPI(net: NetworkConfig | number, tryAuth = true): Promise<ArcadeumAPIClient> {
    const network = await this.getNetwork(net)
    const url = network.sequenceApiUrl

    if (!url) throw Error('No chaind url')

    const jwt = this.jwts[url]

    if (!jwt || jwt.expiration < this.now()) {
      if (tryAuth) return this.auth(net)
      throw Error('Not authenticated')
    }

    const api = new ArcadeumAPIClient(url)
    api.jwtAuth = jwt.token
    return api
  }

  async performAuthRequest(net: NetworkConfig | number): Promise<void> {
    const network = this.getNetwork(net)

    const ethAuth = new ETHAuth()
    const authWallet = this.account.authWallet()
  
    const proof = new Proof({
      address: this.account.address
    })
  
    proof.setIssuedAtNow()
    proof.setExpiryIn(this.expiration)

    const expiration = this.now() + this.expiration - EXPIRATION_JWT_MARGIN

    proof.claims.app = this.name
  
    proof.signature = await authWallet.wallet.signMessage(proof.messageDigest())
    const proofString = await ethAuth.encodeProof(proof, true)

    // TODO: ethauth.js v0.4.4:
    // const proofString = await ethAuth.encodeProof(proof, { skipValidation: true })

    const url = (await network).sequenceApiUrl
    if (!url) return

    const api = new ArcadeumAPIClient(url)

    try {
      const authResp = await api.getAuthToken({ ewtString: proofString })
      if (authResp?.status === true && authResp.jwtToken.length !== 0) {
        this.jwts[url] = {
          token: authResp.jwtToken,
          expiration: expiration
        }

        this.onAuthCallbacks.forEach((cb) => { try { cb() } catch {} })
      } else { }
    } catch {}
  }

  dump(): SessionDump {
    return {
      config: this.config,
      context: this.context,
      jwts: this.jwts,
      metadata: this.metadata
    }
  }

  private async getNetwork(net: NetworkConfig | number): Promise<NetworkConfig> {
    const networks = await this.account.getNetworks()
    
    // TODO: ..
    let network: NetworkConfig | undefined
    if (typeof net === 'number') {
      network = networks.find((n) => n.chainId === net)
    } else {
      network = networks.find((n) => n.chainId === net.chainId) ? net : undefined
    }
    // TODO: should be able to use, however running into an issue
    // with the network config from this.account.getNetworks()
    // which does not have chaindUrl set..
    // const network = findNetworkConfig(networks, net)
    
    if (!network) throw Error('Network not found')
    return network
  }

  private now(): number {
    return Math.floor(new Date().getTime() / 1000)
  }

  static async open(args: {
    context: WalletContext,
    networks: NetworkConfig[],
    referenceSigner: string,
    signers: { signer: AbstractSigner, weight: ethers.BigNumberish }[],
    thershold: ethers.BigNumberish,
    metadata: SessionMeta,
    deepSearch?: boolean,
    knownConfigs?: WalletConfig[],
    noIndex?: boolean
  }): Promise<Session> {
    const {
      context,
      networks,
      referenceSigner,
      signers,
      thershold,
      deepSearch,
      knownConfigs,
      noIndex,
      metadata
    } = args

    const authChain = getAuthNetwork(networks)
    if (!authChain) throw Error('Auth chain not found')
  
    const authProvider = authChain.provider ? authChain.provider : new ethers.providers.JsonRpcProvider(authChain.rpcUrl)
    const configFinder = new SequenceUtilsFinder(authProvider)
  
    const solvedSigners = Promise.all(signers.map(async (s) => ({ ...s, address: await s.signer.getAddress() })))
  
    const existingWallet = (await configFinder.findLastWalletOfInitialSigner({
      signer: referenceSigner,
      context: context,
      provider: authProvider,
      requireIndex: deepSearch ? false : true
    })).wallet

    if (existingWallet) {
      // existing account

      // Find prev configuration
      const config = (await configFinder.findCurrentConfig({
        address: existingWallet,
        provider: authProvider,
        context: context,
        knownConfigs
      })).config
  
      if (!config) throw Error('Wallet config not found')
  
      // Load prev account
      const account = new Account({
        initialConfig: config,
        networks: networks,
        context: context
      }, ...signers.map((s) => s.signer))
  
      const session = new Session(
        config,
        context,
        account,
        metadata 
      )

      // Fire JWT requests before opening session. The server-side will have to
      // be smart enough to try a few times if it fails on the first block, as in
      // our case we're adding a new session in parallel.
      networks.map((n) => session.scheduleAuth(n))

      // Update wallet config on-chain on the authChain
      const [newConfig] = await account.updateConfig(
        editConfig(config, {
          threshold: thershold,
          set: await solvedSigners
        }), noIndex ? false : true
      )

      // Session is ready, lets update
      session.setConfig(newConfig)
      session.setAccount(new Account({
        initialConfig: newConfig,
        networks: networks,
        context: context
      }, ...signers.map((s) => s.signer)))

      // Fire JWT requests again, but with new config
      // MAYBE This is not neccesary, we can rely on the first request?
      // TODO: lets remove this one we no longer depend on session
      // key from this new auth request to gain an auth token
      networks.forEach((n) => session.scheduleAuth(n))

      return session

    } else {
      // fresh account
      const config = genConfig(thershold, await solvedSigners)
    
      const account = new Account({
        initialConfig: config,
        networks: networks,
        context: context
      }, ...signers.map((s) => s.signer))
    
      await account.publishConfig(noIndex ? false : true)
    
      const session = new Session(config, context, account, metadata)
      networks.forEach((n) => session.scheduleAuth(n))
      return session
    }
  }

  static load(args: { 
    dump: SessionDump,
    signers: AbstractSigner[],
    networks: NetworkConfig[]
  }): Session {
    const { dump, signers, networks } = args
    return new Session(
      dump.config,
      dump.context,
      new Account({
        initialConfig: dump.config,
        context: dump.context,
        networks: networks
      }, ...signers),
      dump.metadata,
      dump.jwts
    )
  }
}
