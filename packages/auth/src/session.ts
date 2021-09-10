import { SequenceAPIClient } from '@0xsequence/api'
import { ConfigFinder, editConfig, genConfig, SequenceUtilsFinder, WalletConfig } from "@0xsequence/config"
import { ETHAuth, Proof } from "@0xsequence/ethauth"
import { NetworkConfig, WalletContext, getAuthNetwork } from "@0xsequence/network"
import { Account } from "@0xsequence/wallet"
import { ethers, Signer as AbstractSigner } from "ethers"
import { jwtDecodeClaims } from '@0xsequence/utils'

export type SessionMeta = {
  // name of the app requesting the session, used with ETHAuth
  name: string,

  // expiration in seconds for a session before it expires, used with ETHAuth
  expiration?: number
}

export type SessionJWTs = {
  [url: string]: SessionJWT
}

export type SessionJWT = {
  token: string
  expiration: number
}

type SessionJWTPromise = {
  token: Promise<string>
  expiration: number
}

type ProofStringPromise = {
  proofString: Promise<string>
  expiration: number
}

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

export class Session {
  _initialAuthRequests: Promise<SequenceAPIClient>[]

  // JWTs are indexed by API host
  readonly _jwts: Map<string, SessionJWTPromise> = new Map()

  // proof strings are indexed by account address and app name, see getProofStringKey()
  private readonly proofStrings: Map<string, ProofStringPromise> = new Map()

  private onAuthCallbacks: ((result: PromiseSettledResult<void>) => void)[] = []

  constructor(
    public config: WalletConfig,
    public context: WalletContext,
    public account: Account,
    public metadata: SessionMeta,
    private readonly authProvider: ethers.providers.JsonRpcProvider,
    jwts?: SessionJWTs,
  ) {
    if (jwts) {
      Object.entries(jwts).forEach(([url, jwt]) => {
        this._jwts.set(url, {
          token: Promise.resolve(jwt.token),
          expiration: jwt.expiration ?? getJWTExpiration(jwt.token)
        })
      })
    }
  }

  get name(): string {
    return this.metadata.name
  }

  get expiration(): number {
    return this.metadata.expiration ? Math.max(this.metadata.expiration, 120) : DEFAULT_SESSION_EXPIRATION
  }

  onAuth(cb: (result: PromiseSettledResult<void>) => void) {
    this.onAuthCallbacks.push(cb)
  }

  setAccount(account: Account) {
    this.account = account
  }

  setConfig(config: WalletConfig) {
    this.config = config
  }

  async auth(net: NetworkConfig | number, maxTries: number = 5): Promise<SequenceAPIClient> {
    const network = await this.getNetwork(net)

    const url = network.sequenceApiUrl
    if (!url) throw Error('No chaind url')

    let jwtAuth: string | undefined
    for (let i = 0; ; i++) {
      try {
        jwtAuth = (await this.getJWT(network, true)).token
        break
      } catch (error) {
        if (i === maxTries - 1) {
          console.error(`couldn't authenticate after ${maxTries} attempts`, error)
          throw error
        }
      }
    }

    return new SequenceAPIClient(url, jwtAuth)
  }

  async getAPI(net: NetworkConfig | number, tryAuth = true): Promise<SequenceAPIClient> {
    const network = await this.getNetwork(net)

    const url = network.sequenceApiUrl
    if (!url) throw Error('No chaind url')

    const jwtAuth = (await this.getJWT(network, tryAuth)).token

    return new SequenceAPIClient(url, jwtAuth)
  }

  private async getJWT(network: NetworkConfig, tryAuth: boolean): Promise<SessionJWT> {
    const url = network.sequenceApiUrl
    if (!url) throw Error('No chaind url')

    // check if we already have or are waiting for a token
    if (this._jwts.has(url)) {
      const jwt = this._jwts.get(url)!

      const token = await jwt.token

      if (this.now() < jwt.expiration) {
        return { token, expiration: jwt.expiration }
      }

      // token expired, delete it and get a new one
      this._jwts.delete(url)
    }

    if (!tryAuth) {
      throw new Error('no auth token in memory')
    }

    const proofStringKey = this.getProofStringKey()
    const { proofString, expiration } = this.getProofString(proofStringKey)

    const jwt = {
      token: proofString.then(async proofString => {
        const api = new SequenceAPIClient(url)

        const authResp = await api.getAuthToken({ ewtString: proofString })

        if (authResp?.status === true && authResp.jwtToken.length !== 0) {
          return authResp.jwtToken
        } else {
          if (!await this.isProofStringValid(proofString)) {
            this.proofStrings.delete(proofStringKey)
          }
          throw new Error('no auth token from server')
        }
      }).catch(reason => {
        this._jwts.delete(url)
        throw reason
      }),
      expiration
    }
    this._jwts.set(url, jwt)

    jwt.token.then(() => {
      this.onAuthCallbacks.forEach(cb => { try { cb({ status: 'fulfilled', value: undefined }) } catch {} })
    }).catch((reason: any) => {
      this.onAuthCallbacks.forEach(cb => { try { cb({ status: 'rejected', reason }) } catch {} })
    })

    const token = await jwt.token
    return { token, expiration }
  }

  private getProofString(key: string): ProofStringPromise {
    // check if we already have or are waiting for a proof string
    if (this.proofStrings.has(key)) {
      const proofString = this.proofStrings.get(key)!

      if (this.now() < proofString.expiration) {
        return proofString
      }

      // proof string expired, delete it and make a new one
      this.proofStrings.delete(key)
    }

    const proof = new Proof({
      address: this.account.address
    })
    proof.claims.app = this.name
    proof.setIssuedAtNow()
    proof.setExpiryIn(this.expiration)

    const ethAuth = new ETHAuth()
    const configFinder = new SequenceUtilsFinder(this.authProvider)
    const authWallet = this.account.authWallet()
    const expiration = this.now() + this.expiration - EXPIRATION_JWT_MARGIN

    const proofString = {
      // Fetch latest config 
      // TODO: Should only search for latest config if necessary to be more efficient.
      //       Perhaps compare local config hash with on-chain hash before doing
      //       the search through the logs. Should do this accross sequence.js
      proofString: configFinder.findCurrentConfig({
        address: authWallet.wallet.address,
        provider: this.authProvider,
        context: authWallet.wallet.context,
        knownConfigs: [authWallet.wallet.config]
      }).then(val => {
        if (!val.config) throw Error("Can't find latest config")
        return authWallet.wallet.useConfig(val.config!).sign(proof.messageDigest()).then(signature => {
          proof.signature = signature
          return ethAuth.encodeProof(proof, true)
        })
      }).catch(reason => {
        this.proofStrings.delete(key)
        throw reason
      }),
      expiration
    }
    this.proofStrings.set(key, proofString)
    return proofString
  }

  private getProofStringKey(): string {
    return `${this.account.address} - ${this.name}`
  }

  private async isProofStringValid(proofString: string): Promise<boolean> {
    try {
      const ethAuth = new ETHAuth()
      ethAuth.provider = this.authProvider

      await ethAuth.decodeProof(proofString)

      return true
    } catch {
      return false
    }
  }

  async dump(): Promise<SessionDump> {
    const jwts: { [index: string]: SessionJWT } = {}

    ;(await Promise.allSettled(
      Array.from(this._jwts.entries()).map(
        ([url, jwt]) => jwt.token.then(
          token => [url, { token, expiration: jwt.expiration }] as [string, SessionJWT]
        )
      )
    )).forEach(result => {
      if (result.status === 'fulfilled') {
        const [url, jwt] = result.value
        jwts[url] = jwt
      }
    })

    return {
      config: this.config,
      context: this.context,
      metadata: this.metadata,
      jwts
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
    signers: { signer: AbstractSigner | string, weight: ethers.BigNumberish }[],
    thershold: ethers.BigNumberish,
    metadata: SessionMeta,
    deepSearch?: boolean,
    knownConfigs?: WalletConfig[],
    noIndex?: boolean,
    configFinder?: ConfigFinder
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

    const authProvider = getAuthProvider(networks)
    const configFinder = args.configFinder ? args.configFinder : new SequenceUtilsFinder(authProvider)

    const solvedSigners = Promise.all(
      signers.map(async s => ({ ...s, address: typeof(s.signer) === 'string' ? s.signer : await s.signer.getAddress() }))
    )

    const fullSigners = signers.filter(s => typeof(s.signer) !== 'string').map(s => s.signer)

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
      }, ...fullSigners)

      const session = new Session(config, context, account, metadata, authProvider)

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
      }, ...fullSigners))

      // Fire JWT requests after updating config
      session._initialAuthRequests = networks.map(n => session.auth(n))

      return session

    } else {
      // fresh account
      const config = genConfig(thershold, await solvedSigners)

      const account = new Account({
        initialConfig: config,
        networks: networks,
        context: context
      }, ...fullSigners)

      // send referenceSigner as "requireFreshSigners"
      // this ensures the user doesn't end up with multiple accounts if there is a race condition during login

      await account.publishConfig(noIndex ? false : true, [referenceSigner])

      const session = new Session(config, context, account, metadata, authProvider)

      // Fire JWT requests when opening session
      session._initialAuthRequests = networks.map(n => session.auth(n))

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
      getAuthProvider(networks),
      dump.jwts
    )
  }
}

function getAuthProvider(networks: NetworkConfig[]): ethers.providers.JsonRpcProvider {
  const authChain = getAuthNetwork(networks)
  if (!authChain) throw Error('Auth chain not found')
  return authChain.provider ?? new ethers.providers.JsonRpcProvider(authChain.rpcUrl)
}

function getJWTExpiration(jwt: string): number {
  return jwtDecodeClaims<{ exp: number }>(jwt).exp
}
