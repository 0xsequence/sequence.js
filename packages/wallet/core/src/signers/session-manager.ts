import {
  Config,
  Constants,
  Extensions,
  Payload,
  SessionConfig,
  SessionSignature,
  Signature as SignatureTypes,
} from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hex, Provider } from 'ox'
import * as State from '../state/index.js'
import { Wallet } from '../wallet.js'
import { SapientSigner } from './index.js'
import {
  Explicit,
  Implicit,
  isExplicitSessionSigner,
  SessionSigner,
  SessionSignerInvalidReason,
  isImplicitSessionSigner,
  UsageLimit,
} from './session/index.js'

export type SessionManagerOptions = {
  sessionManagerAddress: Address.Address
  stateProvider?: State.Provider
  implicitSigners?: Implicit[]
  explicitSigners?: Explicit[]
  provider?: Provider.Provider
}

const MAX_SPACE = 2n ** 80n - 1n

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

  async listSignerValidity(
    chainId: number,
  ): Promise<{ signer: Address.Address; isValid: boolean; invalidReason?: SessionSignerInvalidReason }[]> {
    const topology = await this.topology
    const signerStatus = new Map<Address.Address, { isValid: boolean; invalidReason?: SessionSignerInvalidReason }>()
    for (const signer of this._implicitSigners) {
      signerStatus.set(signer.address, signer.isValid(topology, chainId))
    }
    for (const signer of this._explicitSigners) {
      signerStatus.set(signer.address, signer.isValid(topology, chainId))
    }
    return Array.from(signerStatus.entries()).map(([signer, { isValid, invalidReason }]) => ({
      signer,
      isValid,
      invalidReason,
    }))
  }

  async findSignersForCalls(wallet: Address.Address, chainId: number, calls: Payload.Call[]): Promise<SessionSigner[]> {
    // Only use signers that match the topology
    const topology = await this.topology
    const identitySigners = SessionConfig.getIdentitySigners(topology)
    if (identitySigners.length === 0) {
      throw new Error('Identity signers not found')
    }
    const validImplicitSigners = this._implicitSigners.filter((signer) => signer.isValid(topology, chainId).isValid)
    const validExplicitSigners = this._explicitSigners.filter((signer) => signer.isValid(topology, chainId).isValid)

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

    // Check space
    if (payload.space > MAX_SPACE) {
      throw new Error(`Space ${payload.space} is too large`)
    }

    const signers = await this.findSignersForCalls(wallet, chainId, payload.calls)
    if (signers.length !== payload.calls.length) {
      throw new Error('No signer supported for call')
    }
    const signatures = await Promise.all(
      signers.map(async (signer, i) => {
        try {
          return signer.signCall(wallet, chainId, payload, i, this.address, this._provider)
        } catch (error) {
          console.error('signSapient error', error)
          throw error
        }
      }),
    )

    // Check if the last call is an increment usage call
    const expectedIncrement = await this.prepareIncrement(wallet, chainId, payload.calls)
    if (expectedIncrement) {
      let actualIncrement: Payload.Call
      if (
        Address.isEqual(this.address, Extensions.Dev1.sessions) ||
        Address.isEqual(this.address, Extensions.Dev2.sessions)
      ) {
        // Last call
        actualIncrement = payload.calls[payload.calls.length - 1]!
        //FIXME Maybe this should throw since it's exploitable..?
      } else {
        // First call
        actualIncrement = payload.calls[0]!
      }
      if (
        !Address.isEqual(expectedIncrement.to, actualIncrement.to) ||
        !Hex.isEqual(expectedIncrement.data, actualIncrement.data)
      ) {
        throw new Error('Actual increment call does not match expected increment call')
      }
    }

    // Encode the signature
    const explicitSigners: Address.Address[] = []
    const implicitSigners: Address.Address[] = []
    let identitySigner: Address.Address | undefined
    await Promise.all(
      signers.map(async (signer) => {
        const address = await signer.address
        if (isExplicitSessionSigner(signer)) {
          if (!explicitSigners.find((a) => Address.isEqual(a, address))) {
            explicitSigners.push(address)
          }
        } else if (isImplicitSessionSigner(signer)) {
          if (!implicitSigners.find((a) => Address.isEqual(a, address))) {
            implicitSigners.push(address)
            if (!identitySigner) {
              identitySigner = signer.identitySigner
            } else if (!Address.isEqual(identitySigner, signer.identitySigner)) {
              throw new Error('Multiple implicit signers with different identity signers')
            }
          }
        }
      }),
    )

    const encodedSignature = SessionSignature.encodeSessionCallSignatures(
      signatures,
      await this.topology,
      explicitSigners,
      implicitSigners,
      identitySigner,
    )

    return {
      type: 'sapient',
      address: this.address,
      data: Hex.from(encodedSignature),
    }
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
