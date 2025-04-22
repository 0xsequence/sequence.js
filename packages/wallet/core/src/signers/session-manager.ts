import {
  Config,
  Constants,
  Payload,
  SessionConfig,
  SessionSignature,
  Signature as SignatureTypes,
} from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hex, Provider } from 'ox'
import * as State from '../state/index.js'
import { Wallet } from '../wallet.js'
import { SapientSigner } from './index.js'
import { Explicit, Implicit } from './session/index.js'

export type SessionManagerOptions = {
  sessionManagerAddress: Address.Address
  stateProvider?: State.Provider
  implicitSigners: Implicit[]
  explicitSigners: Explicit[]
  provider?: Provider.Provider
}

export const DefaultSessionManagerOptions: SessionManagerOptions = {
  sessionManagerAddress: Constants.DefaultSessionManager,
  implicitSigners: [],
  explicitSigners: [],
}

export class SessionManager implements SapientSigner {
  public readonly stateProvider: State.Provider
  public readonly address: Address.Address

  private readonly _implicitSigners: Implicit[]
  private readonly _explicitSigners: Explicit[]
  private readonly _provider?: Provider.Provider

  constructor(
    readonly wallet: Wallet,
    options?: Partial<SessionManagerOptions>,
  ) {
    const combinedOptions = { ...DefaultSessionManagerOptions, ...options }
    this.stateProvider = combinedOptions.stateProvider ?? wallet.stateProvider
    this.address = combinedOptions.sessionManagerAddress
    this._implicitSigners = combinedOptions.implicitSigners
    this._explicitSigners = combinedOptions.explicitSigners
    this._provider = combinedOptions.provider
  }

  get imageHash(): Promise<Hex.Hex | undefined> {
    return this.getImageHash()
  }

  async getImageHash(): Promise<Hex.Hex | undefined> {
    const { configuration } = await this.wallet.getStatus()
    const sessionConfigLeaf = Config.findSignerLeaf(configuration, this.address)
    if (!sessionConfigLeaf || !Config.isSapientSignerLeaf(sessionConfigLeaf)) {
      return undefined
    }
    return sessionConfigLeaf.imageHash
  }

  get topology(): Promise<SessionConfig.SessionsTopology> {
    return this.getTopology()
  }

  async getTopology(): Promise<SessionConfig.SessionsTopology> {
    const imageHash = await this.imageHash
    if (!imageHash) {
      throw new Error(`Session configuration not found for image hash ${imageHash}`)
    }
    const tree = await this.stateProvider.getTree(imageHash)
    if (!tree) {
      throw new Error(`Session configuration not found for image hash ${imageHash}`)
    }
    return SessionConfig.configurationTreeToSessionsTopology(tree)
  }

  withProvider(provider: Provider.Provider): SessionManager {
    return new SessionManager(this.wallet, {
      sessionManagerAddress: this.address,
      stateProvider: this.stateProvider,
      implicitSigners: this._implicitSigners,
      explicitSigners: this._explicitSigners,
      provider,
    })
  }

  withImplicitSigner(signer: Implicit): SessionManager {
    const implicitSigners = [...this._implicitSigners, signer]
    return new SessionManager(this.wallet, {
      sessionManagerAddress: this.address,
      stateProvider: this.stateProvider,
      implicitSigners,
      explicitSigners: this._explicitSigners,
      provider: this._provider,
    })
  }

  withExplicitSigner(signer: Explicit): SessionManager {
    const explicitSigners = [...this._explicitSigners, signer]

    return new SessionManager(this.wallet, {
      sessionManagerAddress: this.address,
      stateProvider: this.stateProvider,
      implicitSigners: this._implicitSigners,
      explicitSigners,
      provider: this._provider,
    })
  }

  async signSapient(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ): Promise<SignatureTypes.SignatureOfSapientSignerLeaf> {
    if (wallet !== this.wallet.address) {
      throw new Error('Wallet address mismatch')
    }
    if ((await this.imageHash) !== imageHash) {
      throw new Error('Unexpected image hash')
    }
    //FIXME Test chain id
    // if (this._provider) {
    //   const providerChainId = await this._provider.request({
    //     method: 'eth_chainId',
    //   })
    //   if (providerChainId !== Hex.fromNumber(chainId)) {
    //     throw new Error(`Provider chain id mismatch, expected ${Hex.fromNumber(chainId)} but got ${providerChainId}`)
    //   }
    // }
    if (!Payload.isCalls(payload)) {
      throw new Error('Only calls are supported')
    }

    // Only use signers that match the topology
    const topology = await this.topology
    const identitySigner = SessionConfig.getIdentitySigner(topology)
    if (!identitySigner) {
      throw new Error('Identity signer not found')
    }
    const blacklist = SessionConfig.getImplicitBlacklist(topology)
    const validImplicitSigners = this._implicitSigners.filter(
      (signer) =>
        Address.isEqual(signer.identitySigner, identitySigner) &&
        // Blacklist must exist for implicit signers to be used
        blacklist &&
        !blacklist.some((b) => Address.isEqual(b, signer.address)),
    )
    const topologyExplicitSigners = SessionConfig.getExplicitSigners(topology)
    const validExplicitSigners = this._explicitSigners.filter((signer) =>
      topologyExplicitSigners.some((s) => Address.isEqual(s, signer.address)),
    )

    // Try to sign with each signer, prioritizing implicit signers
    const signers = [...validImplicitSigners, ...validExplicitSigners]
    if (signers.length === 0) {
      throw new Error('No signers match the topology')
    }

    const signatures = await Promise.all(
      //FIXME Run sync to support cumulative rules within a payload
      payload.calls.map(async (call) => {
        for (const signer of signers) {
          try {
            if (await signer.supportedCall(wallet, chainId, call, this._provider)) {
              const signature = await signer.signCall(wallet, chainId, call, payload, this._provider)
              return {
                ...signature,
                signer: signer.address,
              }
            }
          } catch (error) {
            console.error('signSapient error', error)
          }
        }
        throw new Error('No signer supported')
      }),
    )

    const explicitSigners = signatures
      .filter((sig) => SessionSignature.isExplicitSessionCallSignature(sig))
      .map((sig) => sig.signer)

    const implicitSigners = signatures
      .filter((sig) => SessionSignature.isImplicitSessionCallSignature(sig))
      .map((sig) => sig.signer)

    return {
      type: 'sapient',
      address: this.address,
      data: Hex.from(
        SessionSignature.encodeSessionCallSignatures(signatures, topology, explicitSigners, implicitSigners),
      ),
    }
  }

  async isValidSapientSignature(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signature: SignatureTypes.SignatureOfSapientSignerLeaf,
  ): Promise<boolean> {
    if (!Payload.isCalls(payload)) {
      // Only calls are supported
      return false
    }

    if (!this._provider) {
      throw new Error('Provider not set')
    }
    //FIXME Test chain id
    // const providerChainId = await this._provider.request({
    //   method: 'eth_chainId',
    // })
    // if (providerChainId !== Hex.fromNumber(chainId)) {
    //   throw new Error(
    //     `Provider chain id mismatch, expected ${Hex.fromNumber(chainId)} but got ${providerChainId}`,
    //   )
    // }

    const encodedPayload = Payload.encodeSapient(chainId, payload)
    const encodedCallData = AbiFunction.encodeData(Constants.RECOVER_SAPIENT_SIGNATURE, [
      encodedPayload,
      signature.data,
    ])
    try {
      const recoverSapientSignatureResult = await this._provider.request({
        method: 'eth_call',
        params: [{ from: wallet, to: this.address, data: encodedCallData }],
      })
      const resultImageHash = Hex.from(
        AbiFunction.decodeResult(Constants.RECOVER_SAPIENT_SIGNATURE, recoverSapientSignatureResult),
      )
      return resultImageHash === (await this.imageHash)
    } catch (error) {
      console.error('recoverSapientSignature error', error)
      return false
    }
  }
}
