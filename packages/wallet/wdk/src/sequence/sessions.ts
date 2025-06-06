import { Signers as CoreSigners, Envelope } from '@0xsequence/wallet-core'
import {
  Attestation,
  Config,
  Constants,
  GenericTree,
  Payload,
  Signature as SequenceSignature,
  SessionConfig,
} from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hash, Hex } from 'ox'
import { IdentityType } from '@0xsequence/identity-instrument'
import { AuthCodePkceHandler } from './handlers/authcode-pkce.js'
import { IdentityHandler, identityTypeToHex } from './handlers/identity.js'
import { ManagerOptionsDefaults, Shared } from './manager.js'
import { Actions } from './types/signature-request.js'

export type AuthorizeImplicitSessionArgs = {
  target: string
  applicationData?: Hex.Hex
}

export class Sessions {
  constructor(private readonly shared: Shared) {}

  async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    const { modules } = await this.shared.modules.wallets.getConfigurationParts(walletAddress)
    const managerLeaf = modules.find((leaf) => Address.isEqual(leaf.address, this.shared.sequence.extensions.sessions))
    if (!managerLeaf) {
      throw new Error('Session manager not found')
    }
    const imageHash = managerLeaf.imageHash
    const tree = await this.shared.sequence.stateProvider.getTree(imageHash)
    if (!tree) {
      throw new Error('Session topology not found')
    }
    return SessionConfig.configurationTreeToSessionsTopology(tree)
  }

  async prepareAuthorizeImplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    args: AuthorizeImplicitSessionArgs,
  ): Promise<string> {
    const topology = await this.getSessionTopology(walletAddress)
    const identitySignerAddress = SessionConfig.getIdentitySigner(topology)
    if (!identitySignerAddress) {
      throw new Error('No identity signer address found')
    }
    const identityKind = await this.shared.modules.signers.kindOf(walletAddress, identitySignerAddress)
    if (!identityKind) {
      throw new Error('No identity handler kind found')
    }
    const handler = this.shared.handlers.get(identityKind)
    if (!handler) {
      throw new Error('No identity handler found')
    }

    // Create the attestation to sign
    let identityType: IdentityType | undefined
    let issuerHash: Hex.Hex = '0x'
    let audienceHash: Hex.Hex = '0x'
    if (handler instanceof IdentityHandler) {
      identityType = handler.identityType
      if (handler instanceof AuthCodePkceHandler) {
        issuerHash = Hash.keccak256(Hex.fromString(handler.issuer))
        audienceHash = Hash.keccak256(Hex.fromString(handler.audience))
      }
    }
    const attestation: Attestation.Attestation = {
      approvedSigner: sessionAddress,
      identityType: Bytes.fromHex(identityTypeToHex(identityType), { size: 4 }),
      issuerHash: Bytes.fromHex(issuerHash, { size: 32 }),
      audienceHash: Bytes.fromHex(audienceHash, { size: 32 }),
      applicationData: Bytes.fromHex(args.applicationData ?? '0x'),
      authData: {
        redirectUrl: args.target,
      },
    }
    // Fake the configuration with the single required signer
    const configuration: Config.Config = {
      threshold: 1n,
      checkpoint: 0n,
      topology: {
        type: 'signer',
        address: identitySignerAddress,
        weight: 1n,
      },
    }
    const envelope: Envelope.Envelope<Payload.SessionImplicitAuthorize> = {
      payload: {
        type: 'session-implicit-authorize',
        sessionAddress,
        attestation,
      },
      wallet: walletAddress,
      chainId: 0n,
      configuration,
    }

    // Request the signature from the identity handler
    return this.shared.modules.signatures.request(envelope, 'session-implicit-authorize', {
      origin: args.target,
    })
  }

  async completeAuthorizeImplicitSession(requestId: string): Promise<{
    attestation: Attestation.Attestation
    signature: SequenceSignature.RSY
  }> {
    // Get the updated signature request
    const signatureRequest = await this.shared.modules.signatures.get(requestId)
    if (
      signatureRequest.action !== 'session-implicit-authorize' ||
      !Payload.isSessionImplicitAuthorize(signatureRequest.envelope.payload)
    ) {
      throw new Error('Invalid action')
    }

    if (!Envelope.isSigned(signatureRequest.envelope) || !Envelope.reachedThreshold(signatureRequest.envelope)) {
      throw new Error('Envelope not signed or threshold not reached')
    }

    // Find any valid signature
    const signature = signatureRequest.envelope.signatures[0]
    if (!signature || !Envelope.isSignature(signature)) {
      throw new Error('No valid signature found')
    }
    if (signature.signature.type !== 'hash') {
      // Should never happen
      throw new Error('Unsupported signature type')
    }

    await this.shared.modules.signatures.complete(requestId)

    return {
      attestation: signatureRequest.envelope.payload.attestation,
      signature: signature.signature,
    }
  }

  async addExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
    origin?: string,
  ): Promise<string> {
    const topology = await this.getSessionTopology(walletAddress)
    const newTopology = SessionConfig.addExplicitSession(topology, {
      ...permissions,
      signer: sessionAddress,
    })
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async removeExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    origin?: string,
  ): Promise<string> {
    const topology = await this.getSessionTopology(walletAddress)
    const newTopology = SessionConfig.removeExplicitSession(topology, sessionAddress)
    if (!newTopology) {
      throw new Error('Session not found')
    }
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async addBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const topology = await this.getSessionTopology(walletAddress)
    const newTopology = SessionConfig.addToImplicitBlacklist(topology, address)
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async removeBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const topology = await this.getSessionTopology(walletAddress)
    const newTopology = SessionConfig.removeFromImplicitBlacklist(topology, address)
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  private async prepareSessionUpdate(
    walletAddress: Address.Address,
    topology: SessionConfig.SessionsTopology,
    origin: string = 'wallet-webapp',
  ): Promise<string> {
    // Store the new configuration
    const tree = SessionConfig.sessionsTopologyToConfigurationTree(topology)
    await this.shared.sequence.stateProvider.saveTree(tree)
    const newImageHash = GenericTree.hash(tree)

    // Find the session manager in the old configuration
    const { modules } = await this.shared.modules.wallets.getConfigurationParts(walletAddress)
    const managerLeaf = modules.find((leaf) => Address.isEqual(leaf.address, this.shared.sequence.extensions.sessions))
    if (!managerLeaf) {
      // Missing. Add it
      modules.push({
        ...ManagerOptionsDefaults.defaultSessionsTopology,
        imageHash: newImageHash,
      })
    } else {
      // Update the configuration to use the new session manager image hash
      managerLeaf.imageHash = newImageHash
    }

    return this.shared.modules.wallets.requestConfigurationUpdate(
      walletAddress,
      {
        modules,
      },
      Actions.SessionUpdate,
      origin,
    )
  }

  async completeSessionUpdate(requestId: string) {
    const sigRequest = await this.shared.modules.signatures.get(requestId)
    if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(sigRequest.envelope.payload)) {
      throw new Error('Invalid action')
    }

    return this.shared.modules.wallets.completeConfigurationUpdate(requestId)
  }
}
