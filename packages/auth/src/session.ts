
import { NetworkConfig, ChainIdLike, findNetworkConfig } from '@0xsequence/network'
import { jwtDecodeClaims } from '@0xsequence/utils'
import { Account } from '@0xsequence/account'
import { ethers } from 'ethers'
import { tracker } from '@0xsequence/sessions'
import { Orchestrator } from '@0xsequence/signhub'
import { migrator } from '@0xsequence/migration'
import { commons, v1 } from '@0xsequence/core'
import { SequenceAPIClient } from '@0xsequence/api'
import { SequenceMetadataClient } from '@0xsequence/metadata'
import { Indexer, SequenceIndexerClient } from '@0xsequence/indexer'
import { ETHAuth, Proof } from '@0xsequence/ethauth'

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

export interface SessionDumpV1 {
  config: Omit<v1.config.WalletConfig, 'version'> & { address?: string },
  jwt?: SessionJWT
  metadata: SessionMeta
}

export interface SessionDumpV2 {
  version: 2,
  address: string,
  jwt?: SessionJWT
  metadata: SessionMeta
}

export function isSessionDumpV1(obj: any): obj is SessionDumpV1 {
  return obj.config && obj.metadata && obj.version === undefined
}

export function isSessionDumpV2(obj: any): obj is SessionDumpV2 {
  return obj.version === 2 && obj.address && obj.metadata
}

// Default session expiration of ETHAuth token (1 week)
export const DEFAULT_SESSION_EXPIRATION = 60 * 60 * 24 * 7

// Long session expiration of ETHAuth token (~1 year)
export const LONG_SESSION_EXPIRATION = 3e7

const EXPIRATION_JWT_MARGIN = 60 // seconds

export type SessionSettings = {
  contexts: commons.context.VersionedContext
  sequenceApiUrl: string
  sequenceMetadataUrl: string
  networks: NetworkConfig[]
  tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  orchestrator: Orchestrator
}

export class Session {
  _initialAuthRequest: Promise<SequenceAPIClient>
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
    public networks: NetworkConfig[],
    public contexts: commons.context.VersionedContext,
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

  setAccount(account: Account) {
    this.account = account
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

  async getAPIClient(tryAuth: boolean = true): Promise<SequenceAPIClient> {
    if (!this.apiClient) {
      const url = this.sequenceApiUrl
      if (!url) throw Error('No sequence api url')

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

  private now(): number {
    return Math.floor(Date.now() / 1000)
  }

  private async getJWT(tryAuth: boolean): Promise<SessionJWT> {
    const url = this.sequenceApiUrl
    if (!url) throw Error('No sequence api url')

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

          const authResp = await api.getAuthToken({ ewtString: proofString })

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

    const proofString = {
      proofString: this.account.signDigest(proof.messageDigest(), 0).then((s) => {
        proof.signature = s
        return ethAuth.encodeProof(proof, true)
      }).catch((reason) => {
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
      const provider = this.networks.find((n) => n.provider)?.provider
      if (!provider) throw Error('No provider found')
      ethAuth.provider = provider

      await ethAuth.decodeProof(proofString)

      return true
    } catch {
      return false
    }
  }

  async dump(): Promise<SessionDumpV2> {
    let jwt: SessionJWT | undefined
    if (this._jwt) {
      try {
        const expiration = this._jwt.expiration
        jwt = { token: await this._jwt.token, expiration }
      } catch {}
    }

    return {
      version: 2,
      address: this.account.address,
      metadata: this.metadata,
      jwt
    }
  }

  static async open(args: {
    settings: SessionSettings,
    addSigners: commons.config.SimpleSigner[],
    referenceSigner: string
    threshold: ethers.BigNumberish
    metadata: SessionMeta,
    selectWallet: (wallets: string[]) => Promise<string | undefined>
  }): Promise<Session> {
    const { referenceSigner, threshold, metadata, addSigners, selectWallet, settings } = args
    const { sequenceApiUrl, sequenceMetadataUrl, contexts, networks, tracker, orchestrator } = settings

    const referenceChainId = networks.find((n) => n.chainId === 1)?.chainId ?? networks[0].chainId
    if (!referenceChainId) throw Error('No reference chain found')

    const foundWallets = await tracker.walletsOfSigner({ signer: referenceSigner })
    const selectedWallet = await selectWallet(foundWallets.map((w) => w.wallet))

    let account: Account

    if (selectedWallet) {
      // existing account, lets update it
      account = new Account({
        address: selectedWallet,
        tracker,
        networks,
        contexts,
        orchestrator
      })

      // Account may not have been migrated yet, so we need to check
      // if it has been migrated and if not, migrate it (in all chains)
      let isFullyMigrated = await account.isMigratedAllChains()
      if (!isFullyMigrated) {
        await account.signAllMigrations()
        isFullyMigrated = await account.isMigratedAllChains()
        if (!isFullyMigrated) throw Error('Failed to migrate account')
      }

      // Get the latest configuration of the wallet (on the reference chain)
      // now this configuration should be of the latest version, so we can start
      // manipulating it.

      // NOTICE: We are performing the wallet update on a single chain, assuming that
      // all other networks have the same configuration. This is not always true.
      const prevConfig = await account.status(referenceChainId).then((s) => s.config)
      const newConfig = account.coders.config.editConfig(prevConfig, {
        add: addSigners,
        checkpoint: account.coders.config.checkpointOf(prevConfig).add(1),
        threshold
      })

      await account.updateConfig(newConfig)
    } else {
      // fresh account
      account = await Account.new({
        config: { threshold, checkpoint: 0, signers: addSigners },
        tracker,
        contexts,
        orchestrator,
        networks
      })

      // sign a digest and send it to the tracker
      // otherwise the tracker will not know about this account
      await account.publishWitness()
    }

    const session = new Session(sequenceApiUrl, sequenceMetadataUrl, networks, contexts, account, metadata)

    if (sequenceApiUrl) {
      // Fire JWT requests after updating config
      session._initialAuthRequest = session.auth()
    } else {
      session._initialAuthRequest = Promise.reject('no sequence api url')
    }

    return session
  }

  static async load(args: {
    settings: SessionSettings,
    dump: SessionDumpV1 | SessionDumpV2
  }): Promise<Session> {
    const { dump, settings } = args
    const { sequenceApiUrl, sequenceMetadataUrl, contexts, networks, tracker, orchestrator } = settings

    let account: Account

    if (isSessionDumpV1(dump)) {
      // Old configuration format used to also contain an "address" field
      // but if it doesn't, it means that it was a "counter-factual" account
      // not yet updated, so we need to compute the address
      const oldAddress = dump.config.address || commons.context.addressOf(
        contexts[1],
        v1.config.ConfigCoder.imageHashOf({ ...dump.config, version: 1 })
      )

      account = new Account({
        address: oldAddress,
        tracker,
        networks,
        contexts,
        orchestrator
      })

      if (!(await account.isMigratedAllChains())) {
        await account.signAllMigrations()
        if (!(await account.isMigratedAllChains())) throw Error('Failed to migrate account')
      }
    } else if (isSessionDumpV2(dump)) {
      account = new Account({
        address: dump.address,
        tracker,
        networks,
        contexts,
        orchestrator
      })
    } else {
      throw Error('Invalid dump format')
    }

    return new Session(
      sequenceApiUrl,
      sequenceMetadataUrl,
      networks,
      contexts,
      account,
      dump.metadata,
      dump.jwt
    )
  }
}

function getJWTExpiration(jwt: string): number {
  return jwtDecodeClaims<{ exp: number }>(jwt).exp
}
