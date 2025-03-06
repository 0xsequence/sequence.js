import { SapientSigner, Signers } from '@0xsequence/sequence-core'
import {
  Attestation,
  Constants,
  Payload,
  SessionConfig,
  SessionSignature,
  Signature as SignatureTypes,
  GenericTree,
} from '@0xsequence/sequence-primitives'
import { AbiFunction, Address, Bytes, Hex, Provider, Secp256k1 } from 'ox'
import { IdentitySigner } from '../identity'

type SessionManagerConfiguration = {
  topology: SessionConfig.SessionsTopology
  provider: Provider.Provider
  address?: Address.Address
}

const DEFAULT_SESSION_MANAGER_ADDRESS: Address.Address = '0x0D3b3497f4B7E99239aE748Fc45216F45431B105'

export class SessionManager implements SapientSigner {
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

  get imageHash(): Hex.Hex {
    const configurationTree = SessionConfig.sessionsTopologyToConfigurationTree(this._topology)
    return Hex.fromBytes(GenericTree.hash(configurationTree))
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
    const implicitPrivateKey = Secp256k1.randomPrivateKey()
    const implicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: implicitPrivateKey }))
    const attestation: Attestation.Attestation = {
      ...attestationParams,
      approvedSigner: implicitAddress,
    }
    const attestationHash = Attestation.hash(attestation)
    const identitySignature = await identitySigner.signDigest(attestationHash)
    if (identitySignature.type !== 'hash') {
      // Unreachable
      throw new Error('Identity signature must be a hash')
    }

    const signer = new Signers.Session.Implicit(implicitPrivateKey, attestation, identitySignature, this.address)
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
    const encodedCallData = AbiFunction.encodeData(Constants.IS_VALID_SAPIENT_SIGNATURE, [
      encodedPayload,
      Bytes.toHex(signature.data),
    ])
    const isValidSapientSignatureResult = await this._provider.request({
      method: 'eth_call',
      params: [{ from: wallet, to: this.address, data: encodedCallData }],
    })
    const resultImageHash = Hex.from(
      AbiFunction.decodeResult(Constants.IS_VALID_SAPIENT_SIGNATURE, isValidSapientSignatureResult),
    )
    return resultImageHash === Hex.from(this.imageHash)
  }
}
