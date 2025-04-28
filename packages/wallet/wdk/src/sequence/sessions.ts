import { Signers as CoreSigners, Envelope, Wallet } from '@0xsequence/wallet-core'
import { Attestation, Payload, SessionConfig, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hex, Provider, RpcTransport } from 'ox'
import { SessionController } from '../session/index.js'
import { IdentityHandler, identityTypeToHex } from './handlers/identity.js'
import { Shared } from './manager.js'
import { AuthCodePkceHandler } from './handlers/authcode-pkce.js'
import { IdentityType } from '../identity/index.js'
import { isSignature } from '../../../core/dist/envelope.js'

export type AuthorizeImplicitSessionArgs = {
  target: string
  applicationData?: Hex.Hex
}

export class Sessions {
  private readonly _sessionControllers: Map<Address.Address, SessionController> = new Map()

  constructor(private readonly shared: Shared) {}

  getCoreWallet(walletAddress: Address.Address): Wallet {
    return new Wallet(walletAddress, {
      context: this.shared.sequence.context,
      guest: this.shared.sequence.guest,
      stateProvider: this.shared.sequence.stateProvider,
    })
  }

  async getControllerForWallet(walletAddress: Address.Address, chainId?: bigint): Promise<SessionController> {
    if (this._sessionControllers.has(walletAddress)) {
      return this._sessionControllers.get(walletAddress)!
    }

    // Construct the wallet
    const wallet = this.getCoreWallet(walletAddress)

    // Get the provider if available
    let provider: Provider.Provider | undefined
    if (chainId) {
      const network = this.shared.sequence.networks.find((network) => network.chainId === chainId)
      if (network) {
        provider = Provider.from(RpcTransport.fromHttp(network.rpc))
      }
    }

    // Create the controller
    const controller = new SessionController({
      wallet,
      provider,
      stateProvider: this.shared.sequence.stateProvider,
    })
    this._sessionControllers.set(walletAddress, controller)
    return controller
  }

  async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    const controller = await this.getControllerForWallet(walletAddress)
    return controller.getTopology()
  }

  async authorizeImplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    args: AuthorizeImplicitSessionArgs,
  ): Promise<{
    attestation: Attestation.Attestation
    signature: SequenceSignature.RSY
  }> {
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

    // Create the digest to sign
    let identityType: IdentityType | undefined
    let issuerHash: Hex.Hex = '0x'
    let audienceHash: Hex.Hex = '0x'
    if (handler instanceof IdentityHandler) {
      identityType = handler.identityType
      if (handler instanceof AuthCodePkceHandler) {
        Hex.assert(handler.issuer)
        Hex.assert(handler.audience)
        issuerHash = handler.issuer
        audienceHash = handler.audience
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
    const attestationHash = Attestation.hash(attestation)
    const walletStatus = await this.getCoreWallet(walletAddress).getStatus()
    const envelope: Envelope.Envelope<Payload.Digest> = {
      payload: {
        type: 'digest',
        digest: Hex.fromBytes(attestationHash),
      },
      wallet: walletAddress,
      chainId: 0n,
      configuration: walletStatus.configuration,
    }

    // Request the signature from the identity handler
    const requestId = await this.shared.modules.signatures.request(envelope, 'sign-digest', {
      origin: args.target,
    })
    let signatureRequest = await this.shared.modules.signatures.get(requestId)
    const identitySigner = signatureRequest.signers.find((s) => s.address === identitySignerAddress)
    if (!identitySigner || (identitySigner.status !== 'actionable' && identitySigner.status !== 'ready')) {
      throw new Error(`Identity signer not found or not ready: ${identitySigner?.status}`)
    }
    const handled = await identitySigner.handle()
    if (!handled) {
      throw new Error('Failed to handle identity handler')
    }
    // Get the updated signature request. Then delete it, we don't need it anymore
    signatureRequest = await this.shared.modules.signatures.get(requestId)
    await this.shared.modules.signatures.cancel(requestId)
    // Find the handler signature
    const signatures = signatureRequest.envelope.signatures.filter(
      (sig) => isSignature(sig) && sig.address === identitySignerAddress,
    )
    if (signatures.length === 0) {
      throw new Error('No signatures found')
    }
    const signature = signatures[0]
    if (!signature) {
      throw new Error('No signature found')
    }
    if (signature.signature.type !== 'hash') {
      // Should never happen
      throw new Error('Unsupported signature type')
    }

    return {
      attestation,
      signature: signature.signature,
    }
  }

  async addExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.addExplicitSession(sessionAddress, permissions)
    return this.prepareSessionUpdate(envelope, origin)
  }

  async removeExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.removeExplicitSession(sessionAddress)
    return this.prepareSessionUpdate(envelope, origin)
  }

  async addBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.addBlacklistAddress(address)
    return this.prepareSessionUpdate(envelope, origin)
  }

  async removeBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const controller = await this.getControllerForWallet(walletAddress)
    const envelope = await controller.removeBlacklistAddress(address)
    return this.prepareSessionUpdate(envelope, origin)
  }

  private async prepareSessionUpdate(
    envelope: Envelope.Envelope<Payload.ConfigUpdate>,
    origin: string = 'wallet-webapp',
  ): Promise<string> {
    return await this.shared.modules.signatures.request(envelope, 'session-update', {
      origin,
    })
  }

  async completeSessionUpdate(walletAddress: Address.Address, requestId: string) {
    const controller = await this.getControllerForWallet(walletAddress)
    const sigRequest = await this.shared.modules.signatures.get(requestId)
    const envelope = sigRequest.envelope
    if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(envelope.payload)) {
      throw new Error('Invalid action')
    }
    console.log('Completing session update:', requestId)
    await controller.completeUpdateConfiguration(envelope as Envelope.Signed<Payload.ConfigUpdate>)
    return this.shared.modules.signatures.complete(requestId)
  }
}
