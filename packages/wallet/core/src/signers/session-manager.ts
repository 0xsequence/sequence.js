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
import { Explicit, Implicit, isExplicitSessionSigner, SessionSigner, UsageLimit } from './session/index.js'

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

  async findSignersForCalls(wallet: Address.Address, chainId: bigint, calls: Payload.Call[]): Promise<SessionSigner[]> {
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
    chainId: bigint,
    calls: Payload.Call[],
  ): Promise<Payload.Call | null> {
    if (calls.length === 0) {
      throw new Error('No calls provided')
    }
    const signers = await this.findSignersForCalls(wallet, chainId, calls)

    // Prepare increments for each explicit signer
    const increments: UsageLimit[] = (
      await Promise.all(
        signers.map((s, i) => {
          if (isExplicitSessionSigner(s)) {
            return s.prepareIncrements(wallet, chainId, calls[i]!, this.address, this._provider!)
          }
          return []
        }),
      )
    ).flat()
    if (increments.length === 0) {
      return null
    }

    //FIXME Handle this in prepareIncrements
    // Error if there are repeated usage hashes
    const uniqueIncrements = increments.filter(
      (increment, index, self) => index === self.findIndex((t) => t.usageHash === increment.usageHash),
    )
    if (uniqueIncrements.length !== increments.length) {
      throw new Error('Repeated usage hashes')
    }

    const data = AbiFunction.encodeData(Constants.INCREMENT_USAGE_LIMIT, [uniqueIncrements])

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
    if (!Payload.isCalls(payload) || payload.calls.length === 0) {
      throw new Error('Only calls are supported')
    }

    //FIXME Needed?
    let calls = payload.calls
    const lastCall = payload.calls[payload.calls.length - 1]!
    if (
      Address.isEqual(lastCall.to, this.address) &&
      Hex.isEqual(Hex.slice(lastCall.data, 0, 4), AbiFunction.getSelector(Constants.INCREMENT_USAGE_LIMIT))
    ) {
      // Do not sign increment usage calls
      calls = calls.slice(0, -1)
    }

    const signers = await this.findSignersForCalls(wallet, chainId, calls)
    if (signers.length !== calls.length) {
      throw new Error('No signer supported for call')
    }
    const signatures = await Promise.all(
      signers.map(async (signer, i) => {
        const call = calls[i]!
        try {
          return signer.signCall(wallet, chainId, call, payload, this.address, this._provider)
        } catch (error) {
          console.error('signSapient error', error)
          throw error
        }
      }),
    )

    // Check if the last call is an increment usage call
    const expectedIncrement = await this.prepareIncrement(wallet, chainId, calls)
    if (expectedIncrement) {
      // This should equal the last call
      if (!Address.isEqual(expectedIncrement.to, lastCall.to) || !Hex.isEqual(expectedIncrement.data, lastCall.data)) {
        throw new Error('Expected increment mismatch')
      }
      // Sign the increment usage call with any explicit signer
      const incrementSigner = signers.find((s) => isExplicitSessionSigner(s))
      if (!incrementSigner) {
        throw new Error('No explicit signer found')
      }
      const incrementSignature = await incrementSigner.signCall(
        wallet,
        chainId,
        expectedIncrement,
        payload,
        this.address,
        this._provider,
      )
      signatures.push(incrementSignature)
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
