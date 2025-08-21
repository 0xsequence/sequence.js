import {
  Config,
  Constants,
  Payload,
  SessionConfig,
  SessionSignature,
  Signature as SignatureTypes,
} from '@0xsequence/wallet-primitives'
import { GuardSigner } from '@0xsequence/guard'
import { AbiFunction, Address, Hex, Provider, TypedData } from 'ox'
import * as State from '../state/index.js'
import { Wallet } from '../wallet.js'
import * as Envelope from '../envelope.js'
import { SapientSigner } from './index.js'
import { Explicit, Implicit, isExplicitSessionSigner, SessionSigner, UsageLimit } from './session/index.js'

export type SessionManagerOptions = {
  sessionManagerAddress: Address.Address
  stateProvider?: State.Provider
  implicitSigners?: Implicit[]
  explicitSigners?: Explicit[]
  provider?: Provider.Provider
}

export class SessionManager implements SapientSigner {
  public readonly stateProvider: State.Provider
  public readonly address: Address.Address

  private readonly _implicitSigners: Implicit[]
  private readonly _explicitSigners: Explicit[]
  private readonly _provider?: Provider.Provider

  constructor(
    readonly wallet: Wallet,
    options: SessionManagerOptions,
  ) {
    this.stateProvider = options.stateProvider ?? wallet.stateProvider
    this.address = options.sessionManagerAddress
    this._implicitSigners = options.implicitSigners ?? []
    this._explicitSigners = options.explicitSigners ?? []
    this._provider = options.provider
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

  async findSignersForCalls(wallet: Address.Address, chainId: number, calls: Payload.Call[]): Promise<SessionSigner[]> {
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

    // Prioritize implicit signers
    const availableSigners = [...validImplicitSigners, ...validExplicitSigners]
    if (availableSigners.length === 0) {
      throw new Error('No signers match the topology')
    }

    // Find supported signers for each call
    const signers: SessionSigner[] = []
    for (const call of calls) {
      let supported = false
      for (const signer of availableSigners) {
        try {
          supported = await signer.supportedCall(wallet, chainId, call, this.address, this._provider)
        } catch (error) {
          console.error('findSignersForCalls error', error)
          continue
        }
        if (supported) {
          signers.push(signer)
          break
        }
      }
      if (!supported) {
        console.error('No signer supported for call', call)
        throw new Error('No signer supported for call')
      }
    }
    return signers
  }

  async prepareIncrement(
    wallet: Address.Address,
    chainId: number,
    calls: Payload.Call[],
  ): Promise<Payload.Call | null> {
    if (calls.length === 0) {
      throw new Error('No calls provided')
    }
    const signers = await this.findSignersForCalls(wallet, chainId, calls)

    // Create a map of signers to their associated calls
    const signerToCalls = new Map<SessionSigner, Payload.Call[]>()
    signers.forEach((signer, index) => {
      const call = calls[index]!
      const existingCalls = signerToCalls.get(signer) || []
      signerToCalls.set(signer, [...existingCalls, call])
    })

    // Prepare increments for each explicit signer with their associated calls
    const increments: UsageLimit[] = (
      await Promise.all(
        Array.from(signerToCalls.entries()).map(async ([signer, associatedCalls]) => {
          if (isExplicitSessionSigner(signer)) {
            return signer.prepareIncrements(wallet, chainId, associatedCalls, this.address, this._provider!)
          }
          return []
        }),
      )
    ).flat()

    if (increments.length === 0) {
      return null
    }

    // Error if there are repeated usage hashes
    const uniqueIncrements = increments.filter(
      (increment, index, self) => index === self.findIndex((t) => t.usageHash === increment.usageHash),
    )
    if (uniqueIncrements.length !== increments.length) {
      throw new Error('Repeated usage hashes')
    }

    const data = AbiFunction.encodeData(Constants.INCREMENT_USAGE_LIMIT, [increments])

    return {
      to: this.address,
      data,
      value: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
      gasLimit: 0n,
    }
  }

  async signSapient(
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ): Promise<SignatureTypes.SignatureOfSapientSignerLeaf> {
    if (!Address.isEqual(wallet, this.wallet.address)) {
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
    if (!Payload.isCalls(payload) || payload.calls.length === 0) {
      throw new Error('Only calls are supported')
    }

    const signers = await this.findSignersForCalls(wallet, chainId, payload.calls)
    if (signers.length !== payload.calls.length) {
      throw new Error('No signer supported for call')
    }
    const signatures = await Promise.all(
      signers.map(async (signer, i) => {
        const call = payload.calls[i]!
        try {
          return signer.signCall(wallet, chainId, call, payload, this.address, this._provider)
        } catch (error) {
          console.error('signSapient error', error)
          throw error
        }
      }),
    )

    // Check if the last call is an increment usage call
    const expectedIncrement = await this.prepareIncrement(wallet, chainId, payload.calls)
    if (expectedIncrement) {
      // This should equal the last call
      const lastCall = payload.calls[payload.calls.length - 1]!
      if (!Address.isEqual(expectedIncrement.to, lastCall.to) || !Hex.isEqual(expectedIncrement.data, lastCall.data)) {
        throw new Error('Expected increment mismatch')
      }
    }

    // Encode the signature
    const explicitSigners: Address.Address[] = []
    const implicitSigners: Address.Address[] = []
    await Promise.all(
      signers.map(async (signer) => {
        if (isExplicitSessionSigner(signer)) {
          explicitSigners.push(await signer.address)
        } else {
          implicitSigners.push(await signer.address)
        }
      }),
    )
    const encodedSignature = SessionSignature.encodeSessionCallSignatures(
      signatures,
      await this.topology,
      explicitSigners,
      implicitSigners,
    )

    return {
      type: 'sapient',
      address: this.address,
      data: Hex.from(encodedSignature),
    }
  }

  async signEnvelope(
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
    guard?: GuardSigner,
  ): Promise<(Envelope.SapientSignature | Envelope.Signature)[]> {
    const signature = await this.signSapient(wallet, chainId, payload, imageHash)
    const sapientSignature: Envelope.SapientSignature = {
      imageHash,
      signature,
    }
    const signatures: (Envelope.SapientSignature | Envelope.Signature)[] = [sapientSignature]

    // TODO: check whether guard signature is even needed for this wallet based on the topology
    if (guard) {
      // Important: guard is not a sapient signer, so we need to unparent the payload
      const unparentedPayload = {
        ...payload,
        parentWallets: undefined,
      }
      const digest = Payload.hash(wallet, chainId, unparentedPayload)
      const typedData = Payload.toTyped(wallet, chainId, unparentedPayload)
      const serialized = Hex.fromString(TypedData.serialize(typedData))

      try {
        const guardSignature = await guard.sign(wallet, chainId, digest, serialized)
        signatures.push({
          address: guard.address,
          signature: {
            type: 'hash',
            ...guardSignature,
          },
        })
      } catch (error) {
        // We don't throw here because we may have reached threshold with the sapient signature alone
        console.error('failed to sign with guard', error)
      }
    }
    return signatures
  }

  async isValidSapientSignature(
    wallet: Address.Address,
    chainId: number,
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
        params: [{ from: wallet, to: this.address, data: encodedCallData }, 'pending'],
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
