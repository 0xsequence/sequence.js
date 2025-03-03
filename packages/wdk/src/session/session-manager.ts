import { Signer as SignerInterface, Signers } from '@0xsequence/sequence-core'
import {
  Attestation,
  Config,
  Payload,
  SessionConfig,
  SessionSignature,
  Signature as SignatureTypes,
} from '@0xsequence/sequence-primitives'
import { Address, Provider, Secp256k1 } from 'ox'
import { IdentitySigner } from '../identity'

type SessionManagerConfiguration = {
  topology: SessionConfig.SessionsTopology
  provider: Provider.Provider
  address?: Address.Address
}

const DEFAULT_SESSION_MANAGER_ADDRESS: Address.Address = '0x1D23F28a45769693b4C462f7628A204389388E3B'

export class SessionManager implements SignerInterface {
  readonly address: Address.Address
  private _topology: SessionConfig.SessionsTopology
  private _provider: Provider.Provider

  private _implicitSigners: Signers.Session.Implicit[] = []
  private _explicitSigners: Signers.Session.Explicit[] = []
  constructor(configuration: SessionManagerConfiguration) {
    this.address = configuration.address ?? DEFAULT_SESSION_MANAGER_ADDRESS
    this._topology = configuration.topology
    this._provider = configuration.provider
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

  get topology(): SessionConfig.SessionsTopology {
    return this._topology
  }

  get imageHash() {
    const configurationTree = SessionConfig.sessionsTopologyToConfigurationTree(this._topology)
    return Config.hashConfigurationTree(configurationTree)
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

  async createImplicitSession(
    identitySigner: IdentitySigner,
    attestationParams: Signers.Session.AttestationParams,
  ): Promise<Signers.Session.Implicit> {
    const attestation: Attestation.Attestation = {
      ...attestationParams,
      approvedSigner: identitySigner.address,
    }
    const attestationHash = Attestation.hash(attestation)
    const identitySignature = await identitySigner.signDigest(attestationHash)
    if (identitySignature.type !== 'hash') {
      // Unreachable
      throw new Error('Identity signature must be a hash')
    }

    const privateKey = Secp256k1.randomPrivateKey()
    const signer = new Signers.Session.Implicit(privateKey, attestation, identitySignature, this.address)
    this._implicitSigners.push(signer)
    return signer
  }

  async createExplicitSession(permissions: Signers.Session.ExplicitParams): Promise<Signers.Session.Explicit> {
    const privateKey = Secp256k1.randomPrivateKey()
    const signer = new Signers.Session.Explicit(privateKey, permissions)
    this._explicitSigners.push(signer)

    // Update configuration
    const topology = SessionConfig.addExplicitSession(this.topology, signer.sessionPermissions)
    this._topology = topology

    return signer
  }

  async removeExplicitSession(signerAddress: Address.Address): Promise<void> {
    const topology = SessionConfig.removeExplicitSession(this.topology, signerAddress)
    if (!topology) {
      throw new Error('Session not found')
    }
    this._explicitSigners = this._explicitSigners.filter((signer) => signer.address !== signerAddress)
    this._topology = topology
  }

  async addBlacklistAddress(address: Address.Address): Promise<void> {
    const topology = SessionConfig.addToImplicitBlacklist(this.topology, address)
    this._topology = topology
  }

  async removeBlacklistAddress(address: Address.Address): Promise<void> {
    const topology = SessionConfig.removeFromImplicitBlacklist(this.topology, address)
    this._topology = topology
  }

  async signSapient(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
  ): Promise<SignatureTypes.SignatureOfSapientSignerLeaf> {
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
            const signature = await signer.signCall(wallet, chainId, call, this._provider)
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
}
