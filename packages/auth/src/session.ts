import { editConfig, genConfig, SequenceUtilsFinder, WalletConfig } from "@0xsequence/config"
import { ETHAuth, Proof } from "@0xsequence/ethauth"
import { NetworkConfig, WalletContext } from "@0xsequence/network"
import { Account } from "@0xsequence/wallet"
import { ethers, Signer } from "ethers"
import { ArcadeumAPIClient } from '@0xsequence/api'

export type SessionMeta = {
  name: string,
  expiration?: number
}

export type SessionDump = {
  config: WalletConfig,
  context: WalletContext,
  jwts:  { [url: string]: string },
  metadata: SessionMeta
}
export class Session implements SessionDump {
  public jwts: { [url: string]: string }
  public authPromises: { url: string, jwt: Promise<string | undefined> }[] = []

  private onAuthCallbacks: (() => void)[] = []

  constructor(
    public config: WalletConfig,
    public context: WalletContext,
    public account: Account,
    public metadata: SessionMeta,
    jwts?: { [url: string]: string },
  ) {
    this.jwts = jwts ? jwts : {}
  }

  get name(): string {
    return this.metadata.name
  }

  get expiration(): number {
    return this.metadata.expiration ? this.metadata.expiration : 3e7
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

  static async open(args: {
    context: WalletContext,
    networks: NetworkConfig[],
    referenceSigner: string,
    signers: { signer: Signer, weight: ethers.BigNumberish }[],
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

    const authChain = networks.find((n) => n.isAuthChain)
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

      // Fire JWT requests before opening session
      networks.map((n) => session.scheduleAuth(n))

      const [newConfig] = await account.updateConfig(
        editConfig(config, {
          threshold: thershold,
          set: await solvedSigners
        }), noIndex ? false : true
      )

      session.setConfig(newConfig)
      session.setAccount(new Account({
        initialConfig: newConfig,
        networks: networks,
        context: context
      }, ...signers.map((s) => s.signer)))

      // Fire JWT requests again, but with new config
      // MAYBE This is not neccesary, we can rely on the first request?
      networks.forEach((n) => session.scheduleAuth(n))

      return session
    }
  
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

  static load(args: { 
    dump: SessionDump,
    signers: Signer[],
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

  async auth(net: NetworkConfig | number, tries: number = 0, maxTries: number = 5): Promise<ArcadeumAPIClient> {
    const network = await this.getNetwork(net)
    const url = network.chaindUrl
    if (!url) throw Error('No chaind url')

    const jwt = this.jwts[url]
    if (jwt) {
      const api = new ArcadeumAPIClient(url)
      api.jwtAuth = jwt
      return api
    }

    const thisAuthPromises = this.authPromises.filter((p) => p.url === url)

    if (thisAuthPromises.length === 0) {
      if (tries >= maxTries) throw Error('Error getting JWT token')
      this.scheduleAuth(network)
      return this.auth(net, tries, maxTries)
    }

    await Promise.all(thisAuthPromises.map((p) => p.jwt))
    this.authPromises = this.authPromises.filter((p) => thisAuthPromises.indexOf(p) === -1)

    return this.auth(net, tries + 1, maxTries)
  }

  scheduleAuth(net: NetworkConfig): Promise<void> {
    const url = net.chaindUrl
    if (!url) return

    this.authPromises.push({
      url: url,
      jwt: this.tryAuth(net)
    })
  }

  async getAPI(net: NetworkConfig | number, tryAuth = true): Promise<ArcadeumAPIClient> {
    const network = await this.getNetwork(net)
    const url = network.chaindUrl

    if (!url) throw Error('No chaind url')

    const jwt = this.jwts[url]

    // TODO: Check for jwt expiration

    if (!jwt) {
      if (tryAuth) return this.auth(net)
      throw Error('Not authenticated')
    }

    const api = new ArcadeumAPIClient(url)
    api.jwtAuth = jwt
    return api
  }

  async tryAuth(net: NetworkConfig | number): Promise<string | undefined> {
    const network = this.getNetwork(net)

    const ethAuth = new ETHAuth()
    const authWallet = this.account.authWallet()
  
    ethAuth.configValidators(async () => ({ isValid: true }))

    const proof = new Proof({
      address: this.account.address
    })
  
    proof.setIssuedAtNow()
    proof.setExpiryIn(this.expiration)
    proof.claims.app = this.name
  
    proof.signature = await authWallet.wallet.signMessage(proof.messageDigest())
    const proofString = await ethAuth.encodeProof(proof)
  
    const url = (await network).chaindUrl
    if (!url) return undefined

    const api = new ArcadeumAPIClient(url)

    try {
      const authResp = await api.getAuthToken({ ewtString: proofString })
      if (authResp?.status === true && authResp.jwtToken.length !== 0) {
        this.jwts[url] = authResp.jwtToken
        this.onAuthCallbacks.forEach((cb) => { try { cb() } catch {} })
        return authResp.jwtToken
      } else {
        return undefined
      }
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

  private async getNetwork(net: NetworkConfig | number): Promise<NetworkConfig> {
    const networks = await this.account.getNetworks()
    let network: NetworkConfig | undefined

    if (typeof net === 'number') {
      network = networks.find((n) => n.chainId === net)
    } else {
      network = networks.find((n) => n.chainId === net.chainId) ? net : undefined
    }

    if (!network) throw Error('Network not found')
    return network
  }
}
