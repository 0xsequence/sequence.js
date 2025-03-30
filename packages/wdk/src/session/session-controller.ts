import { Envelope, Signers, State, Wallet } from '@0xsequence/sequence-core'
import {
  Attestation,
  Config,
  GenericTree,
  Payload,
  Signature as SequenceSignature,
  SessionConfig,
} from '@0xsequence/sequence-primitives'
import { Address, Hex, Provider } from 'ox'
import { IdentitySigner } from '../identity'

type SessionControllerConfiguration = {
  wallet: Wallet
  topology: SessionConfig.SessionsTopology
  provider?: Provider.Provider
  identitySigner?: IdentitySigner
  stateProvider?: State.Provider
}

export class SessionController {
  private _manager: Signers.SessionManager
  private readonly _wallet: Wallet
  private readonly _identitySigner: IdentitySigner | null
  private readonly _stateProvider: State.Provider | null

  private _pendingUpdate: {
    envelope: Envelope.Envelope<Payload.ConfigUpdate>
    topology: SessionConfig.SessionsTopology
  } | null = null

  constructor(configuration: SessionControllerConfiguration) {
    this._manager = new Signers.SessionManager({
      topology: configuration.topology,
      provider: configuration.provider,
    })
    this._wallet = configuration.wallet
    this._identitySigner = configuration.identitySigner ?? null
    this._stateProvider = configuration.stateProvider ?? null
  }

  static createEmpty(
    identitySignerAddress: Address.Address,
    configuration: Omit<SessionControllerConfiguration, 'topology'>,
  ): SessionController {
    return new SessionController({
      ...configuration,
      topology: SessionConfig.emptySessionsTopology(identitySignerAddress),
    })
  }

  static async createFromStorage(
    imageHash: Hex.Hex,
    configuration: Omit<SessionControllerConfiguration, 'topology'>,
  ): Promise<SessionController> {
    if (!configuration.stateProvider) {
      throw new Error('State provider not provided')
    }
    const configurationTree = await configuration.stateProvider.getTree(imageHash)
    if (!configurationTree) {
      throw new Error('Configuration not found')
    }
    return new SessionController({
      ...configuration,
      topology: SessionConfig.configurationTreeToSessionsTopology(configurationTree),
    })
  }

  get topology(): SessionConfig.SessionsTopology {
    return this._manager.topology
  }

  get imageHash(): Hex.Hex {
    const configurationTree = SessionConfig.sessionsTopologyToConfigurationTree(this._manager.topology)
    return GenericTree.hash(configurationTree)
  }

  withProvider(provider: Provider.Provider): SessionController {
    this._manager = this._manager.withProvider(provider)
    return this
  }

  async addImplicitSession(
    signerAddress: Address.Address,
    attestationParams: Signers.Session.AttestationParams,
  ): Promise<SequenceSignature.SignatureOfSignerLeafHash> {
    const attestation: Attestation.Attestation = {
      ...attestationParams,
      approvedSigner: signerAddress,
    }
    const attestationHash = Attestation.hash(attestation)
    // Return the signature to the client
    if (!this._identitySigner) {
      throw new Error('Identity signer not provided')
    }
    return await this._identitySigner.signDigest(attestationHash)
  }

  async addExplicitSession(
    signerAddress: Address.Address,
    permissions: Signers.Session.ExplicitParams,
  ): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = SessionConfig.addExplicitSession(this.topology, {
      ...permissions,
      signer: signerAddress,
    })
    return await this.prepareUpdateConfiguration(topology)
  }

  async removeExplicitSession(signerAddress: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = SessionConfig.removeExplicitSession(this.topology, signerAddress)
    if (!topology) {
      throw new Error('Session not found')
    }
    return await this.prepareUpdateConfiguration(topology)
  }

  async addBlacklistAddress(address: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = SessionConfig.addToImplicitBlacklist(this.topology, address)
    return await this.prepareUpdateConfiguration(topology)
  }

  async removeBlacklistAddress(address: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = SessionConfig.removeFromImplicitBlacklist(this.topology, address)
    return await this.prepareUpdateConfiguration(topology)
  }

  // Prepare the configuration update to use the new topology
  private async prepareUpdateConfiguration(
    topology: SessionConfig.SessionsTopology,
  ): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    // Create a new manager with the new topology

    // Store the new configuration
    await this._stateProvider?.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(topology))

    // Get the old wallet configuration
    const { configuration } = await this._wallet.getStatus()

    // Find the session manager in the old configuration
    const managerLeaf = Config.findSignerLeaf(configuration, this._manager.address)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      // FIXME: Just add it?
      throw new Error('Session manager not found in configuration')
    }

    // Update the configuration to use the new session manager image hash
    managerLeaf.imageHash = this.imageHash

    // Update the wallet configuration
    const envelope = await this._wallet.prepareUpdate(configuration)
    return envelope
  }

  // Complete the configuration update
  protected async completeUpdateConfiguration(envelope: Envelope.Signed<Payload.ConfigUpdate>): Promise<void> {
    // Verify this is the pending configuration update
    if (!this._pendingUpdate) {
      throw new Error('No pending configuration update')
    }
    if (this._pendingUpdate.envelope.payload.imageHash !== envelope.payload.imageHash) {
      throw new Error('Invalid configuration update')
    }

    // Update the manager and wallet with the new topology
    this._manager = this._manager.withTopology(this._pendingUpdate.topology)
    await this._wallet.submitUpdate(envelope)
  }
}
