import { Signers, State, Wallet } from '@0xsequence/sequence-core'
import {
  Attestation,
  Config,
  GenericTree,
  Signature as SequenceSignature,
  SessionConfig,
} from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex, Provider } from 'ox'
import { IdentitySigner } from '../identity'

type SessionControllerConfiguration = {
  wallet: Wallet // FIXME Account?
  identitySigner: IdentitySigner
  topology: SessionConfig.SessionsTopology
  provider: Provider.Provider
  stateProvider?: State.Provider
}

export class SessionController {
  private _manager: Signers.SessionManager
  private readonly _wallet: Wallet
  private readonly _identitySigner: IdentitySigner
  private readonly _stateProvider: State.Provider | null

  constructor(configuration: SessionControllerConfiguration) {
    this._manager = new Signers.SessionManager({
      topology: configuration.topology,
      provider: configuration.provider,
    })
    this._wallet = configuration.wallet
    this._identitySigner = configuration.identitySigner
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

  get imageHash(): Bytes.Bytes {
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
    return await this._identitySigner.signDigest(attestationHash)
  }

  async addExplicitSession(signerAddress: Address.Address, permissions: Signers.Session.ExplicitParams): Promise<void> {
    const topology = SessionConfig.addExplicitSession(this.topology, {
      ...permissions,
      signer: signerAddress,
    })
    await this.updateConfiguration(topology)
  }

  async removeExplicitSession(signerAddress: Address.Address): Promise<void> {
    const topology = SessionConfig.removeExplicitSession(this.topology, signerAddress)
    if (!topology) {
      throw new Error('Session not found')
    }
    await this.updateConfiguration(topology)
  }

  async addBlacklistAddress(address: Address.Address): Promise<void> {
    const topology = SessionConfig.addToImplicitBlacklist(this.topology, address)
    await this.updateConfiguration(topology)
  }

  async removeBlacklistAddress(address: Address.Address): Promise<void> {
    const topology = SessionConfig.removeFromImplicitBlacklist(this.topology, address)
    await this.updateConfiguration(topology)
  }

  // Update the configuration to use the new topology
  private async updateConfiguration(topology: SessionConfig.SessionsTopology): Promise<void> {
    // Remove the old manager from the wallet
    this._wallet.removeSapientSigner(this._manager.address, this._manager.imageHash)

    // Update the manager with the new topology
    this._manager = this._manager.withTopology(topology)

    // Store the new configuration
    await this._stateProvider?.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(topology))

    // Add the new manager to the wallet
    this._wallet.setSapientSigner(this._manager, true)

    // Get the old wallet configuration
    const status = await this._wallet.getStatus()
    const oldConfiguration = status.configuration

    // Find the session manager in the old configuration
    const managerLeaf = Config.findSignerLeaf(oldConfiguration, this._manager.address)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      // FIXME: Just add it?
      throw new Error('Session manager not found in configuration')
    }

    // Update the configuration to use the new session manager image hash
    managerLeaf.imageHash = this.imageHash

    // Update the wallet configuration
    await this._wallet.setConfiguration(oldConfiguration)
  }
}
