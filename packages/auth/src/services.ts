import { Account } from '@0xsequence/account'
import { SequenceAPIClient } from '@0xsequence/api'
import { ETHAuth, Proof } from '@0xsequence/ethauth'
import { Indexer, SequenceIndexer, SequenceIndexerGateway } from '@0xsequence/indexer'
import { SequenceMetadata } from '@0xsequence/metadata'
import { ChainIdLike, findNetworkConfig } from '@0xsequence/network'
import { getFetchRequest } from '@0xsequence/utils'
import { ethers } from 'ethers'

export type SessionMeta = {
  // name of the app requesting the session, used with ETHAuth
  name: string

  // expiration in seconds for a session before it expires, used with ETHAuth
  expiration?: number
}

export type ServicesSettings = {
  metadata: SessionMeta
  sequenceApiUrl: string
  sequenceApiChainId: ethers.BigNumberish
  sequenceMetadataUrl: string
  sequenceIndexerGatewayUrl: string
}

export type SessionJWT = {
  token: string
  expiration: number
}

export type SessionJWTPromise = {
  token: Promise<string>
  expiration: number
}

export type ProofStringPromise = {
  proofString: Promise<string>
  expiration: number
}

// Default session expiration of ETHAuth token (1 week)
export const DEFAULT_SESSION_EXPIRATION = 60 * 60 * 24 * 7

// Long session expiration of ETHAuth token (~1 year)
export const LONG_SESSION_EXPIRATION = 3e7

const EXPIRATION_JWT_MARGIN = 60 // seconds

export class Services {
  _initialAuthRequest: Promise<SequenceAPIClient>

  // proof strings are indexed by account address and app name, see getProofStringKey()
  private readonly proofStrings: Map<string, ProofStringPromise> = new Map()

  private onAuthCallbacks: ((result: PromiseSettledResult<string>) => void)[] = []

  private apiClient: SequenceAPIClient | undefined
  private metadataClient: SequenceMetadata | undefined
  private indexerClients: Map<number, Indexer> = new Map()
  private indexerGateway: SequenceIndexerGateway | undefined

  private projectAccessKey?: string

  constructor(
    public readonly account: Account,
    public readonly settings: ServicesSettings,
    public readonly status: {
      jwt?: SessionJWTPromise
      metadata?: SessionMeta
    } = {},
    projectAccessKey?: string
  ) {
    this.projectAccessKey = projectAccessKey
  }

  private now(): number {
    return Math.floor(Date.now() / 1000)
  }

  get expiration(): number {
    return Math.max(this.settings.metadata.expiration ?? DEFAULT_SESSION_EXPIRATION, 120)
  }

  onAuth(cb: (result: PromiseSettledResult<string>) => void) {
    this.onAuthCallbacks.push(cb)
    return () => (this.onAuthCallbacks = this.onAuthCallbacks.filter(c => c !== cb))
  }

  async dump(): Promise<{
    jwt?: SessionJWT
    metadata?: SessionMeta
  }> {
    if (!this.status.jwt) return { metadata: this.settings.metadata }

    return {
      jwt: {
        token: await this.status.jwt.token,
        expiration: this.status.jwt.expiration
      },
      metadata: this.status.metadata
    }
  }

  auth(maxTries: number = 5): Promise<SequenceAPIClient> {
    if (this._initialAuthRequest) return this._initialAuthRequest

    this._initialAuthRequest = (async () => {
      const url = this.settings.sequenceApiUrl
      if (!url) throw Error('No sequence api url')

      let jwtAuth: string | undefined
      for (let i = 1; ; i++) {
        try {
          jwtAuth = (await this.getJWT(true)).token
          break
        } catch (error) {
          if (i === maxTries) {
            console.error(`couldn't authenticate after ${maxTries} attempts`, error)
            throw error
          }
        }
      }

      return new SequenceAPIClient(url, undefined, jwtAuth)
    })()

    return this._initialAuthRequest
  }

  private async getJWT(tryAuth: boolean): Promise<SessionJWT> {
    const url = this.settings.sequenceApiUrl
    if (!url) throw Error('No sequence api url')

    // check if we already have or are waiting for a token
    if (this.status.jwt) {
      const jwt = this.status.jwt
      const token = await jwt.token

      if (this.now() < jwt.expiration) {
        return { token, expiration: jwt.expiration }
      }

      // token expired, delete it and get a new one
      this.status.jwt = undefined
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
          this.status.jwt = undefined
          throw reason
        }),
      expiration
    }

    this.status.jwt = jwt

    jwt.token
      .then(token => {
        this.onAuthCallbacks.forEach(cb => {
          try {
            cb({ status: 'fulfilled', value: token })
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

  private getProofStringKey(): string {
    return `${this.account.address} - ${this.settings.metadata.name}`
  }

  private async isProofStringValid(proofString: string): Promise<boolean> {
    try {
      const ethAuth = new ETHAuth()
      const chainId = BigInt(this.settings.sequenceApiChainId)
      const found = findNetworkConfig(this.account.networks, chainId)
      if (!found) {
        throw Error('No network found')
      }
      ethAuth.chainId = Number(chainId)

      const network = new ethers.Network(found.name, chainId)

      // TODO: Modify ETHAuth so it can take a provider instead of a url
      // -----
      // Can't pass jwt here since this is used for getting the jwt
      ethAuth.provider = new ethers.JsonRpcProvider(getFetchRequest(found.rpcUrl, this.projectAccessKey), network, {
        staticNetwork: network
      })

      await ethAuth.decodeProof(proofString)

      return true
    } catch {
      return false
    }
  }

  async getAPIClient(tryAuth: boolean = true): Promise<SequenceAPIClient> {
    if (!this.apiClient) {
      const url = this.settings.sequenceApiUrl
      if (!url) throw Error('No sequence api url')

      const jwtAuth = (await this.getJWT(tryAuth)).token
      this.apiClient = new SequenceAPIClient(url, undefined, jwtAuth)
    }

    return this.apiClient
  }

  async getMetadataClient(tryAuth: boolean = true): Promise<SequenceMetadata> {
    if (!this.metadataClient) {
      const jwtAuth = (await this.getJWT(tryAuth)).token
      this.metadataClient = new SequenceMetadata(this.settings.sequenceMetadataUrl, undefined, jwtAuth)
    }

    return this.metadataClient
  }

  async getIndexerClient(chainId: ChainIdLike, tryAuth: boolean = true): Promise<Indexer> {
    const network = findNetworkConfig(this.account.networks, chainId)
    if (!network) {
      throw Error(`No network for chain ${chainId}`)
    }

    if (!this.indexerClients.has(network.chainId)) {
      if (network.indexer) {
        this.indexerClients.set(network.chainId, network.indexer)
      } else if (network.indexerUrl) {
        const jwtAuth = (await this.getJWT(tryAuth)).token
        this.indexerClients.set(network.chainId, new SequenceIndexer(network.indexerUrl, undefined, jwtAuth))
      } else {
        throw Error(`No indexer url for chain ${chainId}`)
      }
    }

    return this.indexerClients.get(network.chainId)!
  }

  async getIndexerGateway(tryAuth: boolean = true): Promise<SequenceIndexerGateway> {
    if (!this.indexerGateway) {
      const jwtAuth = (await this.getJWT(tryAuth)).token
      this.indexerGateway = new SequenceIndexerGateway(this.settings.sequenceIndexerGatewayUrl, undefined, jwtAuth)
    }

    return this.indexerGateway
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

    proof.claims.app = this.settings.metadata.name
    if (typeof window === 'object') {
      proof.claims.ogn = window.location.origin
    }
    proof.setExpiryIn(this.expiration)

    const ethAuth = new ETHAuth()
    const chainId = BigInt(this.settings.sequenceApiChainId)
    const found = findNetworkConfig(this.account.networks, chainId)
    if (!found) {
      throw Error('No network found')
    }
    ethAuth.chainId = Number(chainId)

    const network = new ethers.Network(found.name, chainId)

    // TODO: Modify ETHAuth so it can take a provider instead of a url
    // -----
    // Can't pass jwt here since this is used for getting the jwt
    ethAuth.provider = new ethers.JsonRpcProvider(getFetchRequest(found.rpcUrl, this.projectAccessKey), network, {
      staticNetwork: network
    })

    const expiration = this.now() + this.expiration - EXPIRATION_JWT_MARGIN

    const proofString = {
      proofString: Promise.resolve(
        // NOTICE: TODO: Here we ask the account to sign the message
        // using whatever configuration we have ON-CHAIN, this means
        // that the account will still use the v1 wallet, even if the migration
        // was signed.
        //
        // This works for Sequence webapp v1 -> v2 because all v1 configurations share the same formula
        // (torus + guard), but if we ever decide to allow cross-device login, then it will not work, because
        // those other signers may not be part of the configuration.
        //
        this.account.signDigest(proof.messageDigest(), this.settings.sequenceApiChainId, true, 'eip6492')
      )
        .then(s => {
          proof.signature = s
          return ethAuth.encodeProof(proof, true)
        })
        .catch(reason => {
          this.proofStrings.delete(key)
          throw reason
        }),
      expiration
    }

    this.proofStrings.set(key, proofString)
    return proofString
  }
}
