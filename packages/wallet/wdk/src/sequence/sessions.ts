import { Signers as CoreSigners, Envelope, Wallet } from '@0xsequence/wallet-core'
import {
  Attestation,
  Config,
  GenericTree,
  Payload,
  Signature as SequenceSignature,
  SessionConfig,
} from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hex, Provider, RpcTransport } from 'ox'
import { IdentityType } from '../identity/index.js'
import { AuthCodePkceHandler } from './handlers/authcode-pkce.js'
import { IdentityHandler, identityTypeToHex } from './handlers/identity.js'
import { ManagerOptionsDefaults, Shared } from './manager.js'

export type AuthorizeImplicitSessionArgs = {
  target: string
  applicationData?: Hex.Hex
}

export class Sessions {
  private readonly _wallets: Map<Address.Address, Wallet> = new Map()
  private readonly _managers: Map<Address.Address, CoreSigners.SessionManager> = new Map()

  constructor(private readonly shared: Shared) {}

  getCoreWallet(walletAddress: Address.Address): Wallet {
    if (this._wallets.has(walletAddress)) {
      return this._wallets.get(walletAddress)!
    }
    const wallet = new Wallet(walletAddress, {
      context: this.shared.sequence.context,
      guest: this.shared.sequence.guest,
      stateProvider: this.shared.sequence.stateProvider,
    })
    this._wallets.set(walletAddress, wallet)
    return wallet
  }

  async getManagerForWallet(walletAddress: Address.Address, chainId?: bigint): Promise<CoreSigners.SessionManager> {
    if (this._managers.has(walletAddress)) {
      return this._managers.get(walletAddress)!
    }

    // Get the provider if available
    let provider: Provider.Provider | undefined
    if (chainId) {
      const network = this.shared.sequence.networks.find((network) => network.chainId === chainId)
      if (network) {
        provider = Provider.from(RpcTransport.fromHttp(network.rpc))
      }
    }

    // Create the controller
    const manager = new CoreSigners.SessionManager(this.getCoreWallet(walletAddress), {
      provider,
    })
    this._managers.set(walletAddress, manager)
    return manager
  }

  async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    const manager = await this.getManagerForWallet(walletAddress)
    return manager.topology
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
    const manager = await this.getManagerForWallet(walletAddress)
    const topology = await manager.topology
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
    const manager = await this.getManagerForWallet(walletAddress)
    const topology = await manager.topology
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
    const manager = await this.getManagerForWallet(walletAddress)
    const topology = await manager.topology
    const newTopology = SessionConfig.addToImplicitBlacklist(topology, address)
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async removeBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const manager = await this.getManagerForWallet(walletAddress)
    const topology = await manager.topology
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

    // Get the old wallet configuration
    const wallet = this.getCoreWallet(walletAddress)
    const { configuration } = await wallet.getStatus()
    let newConfiguration = Config.configFromJson(Config.configToJson(configuration)) // Clone the configuration

    // Find the session manager in the old configuration
    const { address: managerAddress } = await this.getManagerForWallet(walletAddress)
    const managerLeaf = Config.findSignerLeaf(newConfiguration, managerAddress)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      // Just add it
      const newManagerLeaf: Config.SapientSignerLeaf = {
        ...ManagerOptionsDefaults.defaultSessionsTopology,
        address: managerAddress,
        imageHash: newImageHash,
      }
      newConfiguration.topology = Config.mergeTopology(newConfiguration.topology, newManagerLeaf)
    } else {
      // Update the configuration to use the new session manager image hash
      managerLeaf.imageHash = newImageHash
    }

    // Increment the checkpoint
    newConfiguration.checkpoint += 1n

    // Update the wallet configuration
    const envelope = await wallet.prepareUpdate(newConfiguration)
    return await this.shared.modules.signatures.request(envelope, 'session-update', {
      origin,
    })
  }

  async completeSessionUpdate(walletAddress: Address.Address, requestId: string) {
    console.log('Completing session update for wallet:', walletAddress, 'requestId:', requestId)
    const sigRequest = await this.shared.modules.signatures.get(requestId)
    if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(sigRequest.envelope.payload)) {
      throw new Error('Invalid action')
    }
    const envelope = sigRequest.envelope as Envelope.Signed<Payload.ConfigUpdate>

    const configuration = await this.shared.sequence.stateProvider.getConfiguration(envelope.payload.imageHash)
    if (!configuration) {
      throw new Error('Wallet configuration not found')
    }

    // Find the session manager in the new configuration
    const { address: managerAddress } = await this.getManagerForWallet(walletAddress)
    const managerLeaf = Config.findSignerLeaf(configuration, managerAddress)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      throw new Error('Session manager not found in configuration')
    }
    const sessionTree = await this.shared.sequence.stateProvider.getTree(managerLeaf.imageHash)
    if (!sessionTree) {
      throw new Error('Session tree not found')
    }
    const topology = SessionConfig.configurationTreeToSessionsTopology(sessionTree)
    console.log('completeUpdateConfiguration Topology:', topology)

    // Submit the update with the new topology
    console.log('Submitting update:', envelope.payload.imageHash)
    await this.getCoreWallet(walletAddress).submitUpdate(envelope)
    return this.shared.modules.signatures.complete(requestId)
  }
}
