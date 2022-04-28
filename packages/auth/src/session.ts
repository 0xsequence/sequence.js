import { SequenceAPIClient } from '@0xsequence/api'
import { addressOf, ConfigTracker, editConfig, WalletConfig, imageHash } from '@0xsequence/config'
import { ETHAuth, Proof } from '@0xsequence/ethauth'
import { Indexer, SequenceIndexerClient } from '@0xsequence/indexer'
import { SequenceMetadataClient } from '@0xsequence/metadata'
import { ChainIdLike, NetworkConfig, WalletContext, findNetworkConfig } from '@0xsequence/network'
import { jwtDecodeClaims } from '@0xsequence/utils'
import { Account } from '@0xsequence/wallet'
import { ethers, Signer as AbstractSigner, Wallet } from 'ethers'

export type SessionMeta = {
  // name of the app requesting the session, used with ETHAuth
  name: string

  // expiration in seconds for a session before it expires, used with ETHAuth
  expiration?: number
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

export function isSessionDumpV1(cand: SessionDumpV1 | SessionDump): cand is SessionDumpV1 {
  return (cand as any).version === undefined 
}

export function isSessionDump(cand: SessionDumpV1 | SessionDump): cand is SessionDump {
  return (
    (cand as any).version !== undefined &&
    (cand as any).version === SESSION_DUMP_VERSION
  )
}

export interface SessionDumpV1 {
  config: WalletConfig,
  context: WalletContext
  jwt?: SessionJWT
  metadata: SessionMeta
}

export interface SessionDump {
  version: number
  address: string
  context: WalletContext
  jwt?: SessionJWT
  metadata: SessionMeta
}

// Default session expiration of ETHAuth token (1 week)
export const DEFAULT_SESSION_EXPIRATION = 60 * 60 * 24 * 7

// Long session expiration of ETHAuth token (~1 year)
export const LONG_SESSION_EXPIRATION = 3e7

const EXPIRATION_JWT_MARGIN = 60 // seconds

const SESSION_DUMP_VERSION = 2

export class Session {
  private _initialAuthRequest: Promise<SequenceAPIClient>

  _jwt: SessionJWTPromise | undefined

  // proof strings are indexed by account address and app name, see getProofStringKey()
  private readonly proofStrings: Map<string, ProofStringPromise> = new Map()

  private onAuthCallbacks: ((result: PromiseSettledResult<void>) => void)[] = []

  private apiClient: SequenceAPIClient | undefined
  private metadataClient: SequenceMetadataClient | undefined
  private indexerClients: Map<number, Indexer> = new Map()

  constructor(
    public sequenceApiUrl: string,
    public sequenceMetadataUrl: string,
    private networks: NetworkConfig[],
    public context: WalletContext,
    public account: Account,
    public metadata: SessionMeta,
    jwt?: SessionJWT
  ) {
    if (jwt) {
      this._jwt = {
        token: Promise.resolve(jwt.token),
        expiration: jwt.expiration ?? getJWTExpiration(jwt.token)
      }
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

  async authComplete(): Promise<SequenceAPIClient | undefined> {
    return this._initialAuthRequest
  }

  async auth(maxTries: number = 5): Promise<SequenceAPIClient> {
    const url = this.sequenceApiUrl
    if (!url) throw Error('No sequence api url')

    let jwtAuth: string | undefined
    for (let i = 0; ; i++) {
      try {
        jwtAuth = (await this.getJWT(true)).token
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

  get isTestnetMode(): boolean | undefined {
    if (!this.networks || this.networks.length === 0) return
    return !!this.networks[0].testnet
  }

  async getAPIClient(tryAuth: boolean = true): Promise<SequenceAPIClient> {
    if (!this.apiClient) {
      const url = this.sequenceApiUrl
      if (!url) throw Error('No chaind url')

      const jwtAuth = (await this.getJWT(tryAuth)).token
      this.apiClient = new SequenceAPIClient(url, jwtAuth)
    }

    return this.apiClient
  }

  getMetadataClient(): SequenceMetadataClient {
    if (!this.metadataClient) {
      this.metadataClient = new SequenceMetadataClient(this.sequenceMetadataUrl)
    }

    return this.metadataClient
  }

  async getIndexerClient(chainId: ChainIdLike): Promise<Indexer> {
    const network = findNetworkConfig(this.networks, chainId)
    if (!network) {
      throw Error(`No network for chain ${chainId}`)
    }

    const jwtAuth = (await this.getJWT(true)).token

    if (!this.indexerClients.has(network.chainId)) {
      if (network.indexer) {
        this.indexerClients.set(network.chainId, network.indexer)
      } else if (network.indexerUrl) {
        this.indexerClients.set(network.chainId, new SequenceIndexerClient(network.indexerUrl, jwtAuth))
      } else {
        throw Error(`No indexer url for chain ${chainId}`)
      }
    }

    return this.indexerClients.get(network.chainId)!
  }

  private async getJWT(tryAuth: boolean): Promise<SessionJWT> {
    const url = this.sequenceApiUrl
    if (!url) throw Error('No chaind url')

    // check if we already have or are waiting for a token
    if (this._jwt) {
      const jwt = this._jwt
      const token = await jwt.token

      if (this.now() < jwt.expiration) {
        return { token, expiration: jwt.expiration }
      }

      // token expired, delete it and get a new one
      this._jwt = undefined
    }

    if (!tryAuth) {
      throw new Error('no auth token in memory')
    }

    const proofStringKey = this.getProofStringKey()
    const { proofString, expiration } = this.getProofString(proofStringKey)

    const jwt = {
      token: proofString
        .then(async proofString => {
          const api = new SequenceAPIClient(url)

          const authResp = await api.getAuthToken({ ewtString: proofString, testnetMode: this.isTestnetMode })

          if (authResp?.status === true && authResp.jwtToken.length !== 0) {
            return authResp.jwtToken
          } else {
            if (!(await this.isProofStringValid(proofString))) {
              this.proofStrings.delete(proofStringKey)
            }
            throw new Error('no auth token from server')
          }
        })
        .catch(reason => {
          this._jwt = undefined
          throw reason
        }),
      expiration
    }
    this._jwt = jwt

    jwt.token
      .then(() => {
        this.onAuthCallbacks.forEach(cb => {
          try {
            cb({ status: 'fulfilled', value: undefined })
          } catch {}
        })
      })
      .catch((reason: any) => {
        this.onAuthCallbacks.forEach(cb => {
          try {
            cb({ status: 'rejected', reason })
          } catch {}
        })
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
    proof.setExpiryIn(this.expiration)

    const ethAuth = new ETHAuth()
    const expiration = this.now() + this.expiration - EXPIRATION_JWT_MARGIN

    // Sign proof message using account
    const proofString = {
      proofString: this.account.signMessage(proof.messageDigest(), undefined, true, true).then((signature: string) => {
        proof.signature = signature
        return ethAuth.encodeProof(proof, true)
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
      // TODO: Check signatures accounting for presigned configurations

      // const ethAuth = new ETHAuth()
      // ethAuth.provider = this.authProvider

      // await ethAuth.decodeProof(proofString)

      return true
    } catch {
      return false
    }
  }

  async dump(): Promise<SessionDump> {
    let jwt: SessionJWT | undefined
    if (this._jwt) {
      try {
        const expiration = this._jwt.expiration
        jwt = { token: await this._jwt.token, expiration }
      } catch {}
    }

    return {
      version: SESSION_DUMP_VERSION,
      address: this.account.address,
      context: this.context,
      metadata: this.metadata,
      jwt
    }
  }

  private now(): number {
    return Math.floor(new Date().getTime() / 1000)
  }

  static async open(args: {
    address?: string
    configTracker: ConfigTracker
    sequenceApiUrl: string
    sequenceMetadataUrl: string
    context: WalletContext
    networks: NetworkConfig[]
    signers: { signer: AbstractSigner | string; weight: ethers.BigNumberish }[]
    threshold: ethers.BigNumberish
    metadata: SessionMeta,
    knownNetworks?: number[]
  }): Promise<Session> {
    const {
      address,
      sequenceApiUrl,
      sequenceMetadataUrl,
      context,
      networks,
      signers,
      threshold,
      metadata,
      configTracker,
      knownNetworks
    } = args

    // Prepare signers
    const solvedSigners = Promise.all(signers.map(async s => ({ ...s, address: typeof s.signer === 'string' ? s.signer : await s.signer.getAddress() })))
    const fullSigners =  signers.filter(s => typeof s.signer !== 'string').map(s => s.signer)

    let account: Account
    if (address) {
      // If address is provided we just import the account
      account = new Account({ address, configTracker, context, networks }, ...fullSigners)

      // Add new session key to configuration
      const config = await account.getWalletConfig()
      if (!config) throw Error(`No wallet configuration found for ${address}`)
      const newConfig = editConfig(config, { threshold, set: await solvedSigners })

      // If newConfig is different than config, update configuration
      if (imageHash(newConfig) !== imageHash(config)) {
        // Update configuration for all networks
        // (networks we aren't using, but we want to presign transactions anyway)
        await Promise.all(networks.map((n) => account.updateConfig(newConfig, n.chainId, knownNetworks ?? [])))
      }
    } else {
      // If not we have to create an initial configuration using the provided signers
      // and then create a new account from that configuration
      const config: WalletConfig = {
        threshold: ethers.BigNumber.from(threshold).toNumber(),
        signers: (await solvedSigners).map((s) => ({
          address: s.address,
          weight: ethers.BigNumber.from(s.weight).toNumber()
        }))
      }
      account = await Account.create({ configTracker, context, networks }, config, ...fullSigners)

      // We need to sign a witness message and store it, otherwise the account
      // can't be detected as created, prefix it with "0xSequence witness:"
      const witnessMessage = `0xSequence witness: ${ethers.utils.hexlify(ethers.utils.randomBytes(32))}`
      const witnessDigest = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(witnessMessage))
      const signed = await account.signMessage(witnessDigest, networks[0].chainId, undefined, true)
      await configTracker.saveWitness({ wallet: account.address, digest: witnessDigest, signatures: [{ signature: signed, chainId: networks[0].chainId }] })
    }

    // Create session instance
    const session = new Session(sequenceApiUrl, sequenceMetadataUrl, networks, context, account, metadata)
    if (sequenceApiUrl) {
      // Fire JWT requests when opening session
      session._initialAuthRequest = session.auth()
    } else {
      session._initialAuthRequest = Promise.reject('no sequence api url')
    }
    return session
  }

  static load(args: {
    sequenceApiUrl: string
    sequenceMetadataUrl: string
    dump: SessionDump | SessionDumpV1
    configTracker: ConfigTracker
    signers: AbstractSigner[]
    networks: NetworkConfig[]
  }): Session {
    const { sequenceApiUrl, sequenceMetadataUrl, dump, signers, networks, configTracker } = args

    // Get address from dump
    // old session dumps have the address encoded on the config
    const address = isSessionDumpV1(dump) ? addressOf(dump.config, dump.context) : dump.address

    return new Session(
      sequenceApiUrl,
      sequenceMetadataUrl,
      networks,
      dump.context,
      new Account(
        {
          address,
          context: dump.context,
          networks: networks,
          configTracker
        },
        ...signers
      ),
      dump.metadata,
      dump.jwt
    )
  }
}


function getJWTExpiration(jwt: string): number {
  return jwtDecodeClaims<{ exp: number }>(jwt).exp
}
