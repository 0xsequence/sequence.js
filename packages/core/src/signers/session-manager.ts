import {
  Constants,
  GenericTree,
  Payload,
  SessionConfig,
  SessionSignature,
  Signature as SignatureTypes,
} from '@0xsequence/sequence-primitives'
import { AbiFunction, Address, Bytes, Hex, Provider } from 'ox'
import { SapientSigner } from '.'
import { Explicit, Implicit } from './session'
import { State } from '..'

type SessionManagerConfiguration = {
  topology: SessionConfig.SessionsTopology
  provider: Provider.Provider
  implicitSigners?: Implicit[]
  explicitSigners?: Explicit[]
  address?: Address.Address
}

export class SessionManager implements SapientSigner {
  private readonly _address: Address.Address
  private readonly _topology: SessionConfig.SessionsTopology
  private readonly _provider: Provider.Provider
  private readonly _implicitSigners: Implicit[]
  private readonly _explicitSigners: Explicit[]

  constructor(configuration: SessionManagerConfiguration) {
    this._address = configuration.address ?? Constants.DefaultSessionManager
    this._topology = configuration.topology
    this._provider = configuration.provider
    // FIXME: Validate that the implicit signers attestations are signed by the identity signer?
    this._implicitSigners = configuration.implicitSigners ?? []
    // FIXME: Validate that the configuration contains the explicit signers?
    this._explicitSigners = configuration.explicitSigners ?? []
  }

  static createEmpty(
    identitySignerAddress: Address.Address,
    configuration: Omit<SessionManagerConfiguration, 'topology'>,
  ): SessionManager {
    return new SessionManager({
      ...configuration,
      topology: SessionConfig.emptySessionsTopology(identitySignerAddress),
    })
  }

  static createFromConfigurationTree(
    configurationTree: GenericTree.Tree,
    configuration: Omit<SessionManagerConfiguration, 'topology'>,
  ): SessionManager {
    return new SessionManager({
      ...configuration,
      topology: SessionConfig.configurationTreeToSessionsTopology(configurationTree),
    })
  }

  static async createFromStorage(
    imageHash: Hex.Hex,
    stateProvider: State.Provider,
    configuration: Omit<SessionManagerConfiguration, 'topology'>,
  ): Promise<SessionManager> {
    const configurationTree = await stateProvider.getTree(imageHash)
    if (!configurationTree) {
      throw new Error('Configuration not found')
    }
    return SessionManager.createFromConfigurationTree(configurationTree, configuration)
  }

  get address(): Address.Address {
    return this._address
  }

  get topology(): SessionConfig.SessionsTopology {
    return this._topology
  }

  get imageHash(): Hex.Hex {
    const configurationTree = SessionConfig.sessionsTopologyToConfigurationTree(this._topology)
    return GenericTree.hash(configurationTree)
  }

  withProvider(provider: Provider.Provider): SessionManager {
    return new SessionManager({
      topology: this.topology,
      address: this.address,
      provider,
    })
  }

  withTopology(topology: SessionConfig.SessionsTopology): SessionManager {
    return new SessionManager({
      topology,
      address: this.address,
      provider: this._provider,
    })
  }

  withImplicitSigner(signer: Implicit): SessionManager {
    const implicitSigners = [...this._implicitSigners, signer]
    return new SessionManager({
      topology: this.topology,
      address: this.address,
      provider: this._provider,
      implicitSigners,
      explicitSigners: this._explicitSigners,
    })
  }

  withExplicitSigner(signer: Explicit): SessionManager {
    const explicitSigners = [...this._explicitSigners, signer]

    // Update the topology
    const topology = SessionConfig.addExplicitSession(this.topology, signer.sessionPermissions)

    return new SessionManager({
      topology,
      address: this.address,
      provider: this._provider,
      implicitSigners: this._implicitSigners,
      explicitSigners,
    })
  }

  withBlacklistAddress(address: Address.Address): SessionManager {
    const topology = SessionConfig.addToImplicitBlacklist(this.topology, address)
    return new SessionManager({
      topology,
      address: this.address,
      provider: this._provider,
      implicitSigners: this._implicitSigners,
      explicitSigners: this._explicitSigners,
    })
  }

  withoutBlacklistAddress(address: Address.Address): SessionManager {
    const topology = SessionConfig.removeFromImplicitBlacklist(this.topology, address)
    return new SessionManager({
      topology,
      address: this.address,
      provider: this._provider,
      implicitSigners: this._implicitSigners,
      explicitSigners: this._explicitSigners,
    })
  }

  async signSapient(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ): Promise<SignatureTypes.SignatureOfSapientSignerLeaf> {
    if (this.imageHash !== imageHash) {
      throw new Error('Unexpected image hash')
    }

    if (!Payload.isCalls(payload)) {
      throw new Error('Only calls are supported')
    }

    // Try to sign with each signer, prioritizing implicit signers
    const signers = [...this._implicitSigners, ...this._explicitSigners]
    const signatures = await Promise.all(
      //FIXME Run sync to support cumulative rules within a payload
      payload.calls.map(async (call) => {
        for (const signer of signers) {
          if (await signer.supportedCall(wallet, chainId, call, this._provider)) {
            const signature = await signer.signCall(wallet, chainId, call, payload, this._provider)
            return {
              ...signature,
              signer: signer.address,
            }
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
      data: SessionSignature.encodeSessionCallSignatures(signatures, this.topology, explicitSigners, implicitSigners),
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
    const encodedPayload = Payload.encodeSapient(chainId, payload)
    const encodedCallData = AbiFunction.encodeData(Constants.RECOVER_SAPIENT_SIGNATURE, [
      encodedPayload,
      Bytes.toHex(signature.data),
    ])
    try {
      const recoverSapientSignatureResult = await this._provider.request({
        method: 'eth_call',
        params: [{ from: wallet, to: this.address, data: encodedCallData }],
      })
      const resultImageHash = Hex.from(
        AbiFunction.decodeResult(Constants.RECOVER_SAPIENT_SIGNATURE, recoverSapientSignatureResult),
      )
      return resultImageHash === Hex.from(this.imageHash)
    } catch (error) {
      console.error('recoverSapientSignature error', error)
      return false
    }
  }
}
