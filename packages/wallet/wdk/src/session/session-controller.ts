import { Envelope, Signers, State, Wallet } from '@0xsequence/wallet-core'
import {
  Attestation,
  Config,
  GenericTree,
  Payload,
  Signature as SequenceSignature,
  SessionConfig,
} from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider } from 'ox'
import { IdentitySigner } from '../identity/signer.js'

type SessionControllerConfiguration = {
  wallet: Wallet
  provider?: Provider.Provider
  identitySigner?: IdentitySigner
  stateProvider?: State.Provider
}

export class SessionController {
  private _manager: Signers.SessionManager
  private readonly _wallet: Wallet
  private readonly _identitySigner: IdentitySigner | null
  private readonly _stateProvider: State.Provider | null

  constructor(configuration: SessionControllerConfiguration) {
    this._manager = new Signers.SessionManager(configuration.wallet, {
      provider: configuration.provider,
    })
    this._wallet = configuration.wallet
    this._identitySigner = configuration.identitySigner ?? null
    this._stateProvider = configuration.stateProvider ?? null
  }

  async getTopology(): Promise<SessionConfig.SessionsTopology> {
    return this._manager.topology
  }

  async getImageHash(): Promise<Hex.Hex> {
    return this._manager.imageHash.then((imageHash) => {
      if (!imageHash) {
        throw new Error('Image hash not found')
      }
      return imageHash
    })
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
    const topology = await this.getTopology()
    const newTopology = SessionConfig.addExplicitSession(topology, {
      ...permissions,
      signer: signerAddress,
    })
    return await this.prepareUpdateConfiguration(newTopology)
  }

  async removeExplicitSession(signerAddress: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.removeExplicitSession(topology, signerAddress)
    if (!newTopology) {
      throw new Error('Session not found')
    }
    return await this.prepareUpdateConfiguration(newTopology)
  }

  async addBlacklistAddress(address: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.addToImplicitBlacklist(topology, address)
    return await this.prepareUpdateConfiguration(newTopology)
  }

  async removeBlacklistAddress(address: Address.Address): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.removeFromImplicitBlacklist(topology, address)
    return await this.prepareUpdateConfiguration(newTopology)
  }

  // Prepare the configuration update to use the new topology
  private async prepareUpdateConfiguration(
    topology: SessionConfig.SessionsTopology,
  ): Promise<Envelope.Envelope<Payload.ConfigUpdate>> {
    // Create a new manager with the new topology

    // Store the new configuration
    if (!this._stateProvider) {
      throw new Error('State provider not provided')
    }
    const tree = SessionConfig.sessionsTopologyToConfigurationTree(topology)
    await this._stateProvider.saveTree(tree)

    // Get the old wallet configuration
    const { configuration } = await this._wallet.getStatus()

    // Find the session manager in the old configuration
    const managerLeaf = Config.findSignerLeaf(configuration, this._manager.address)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      // FIXME: Just add it?
      throw new Error('Session manager not found in configuration')
    }

    // Update the configuration to use the new session manager image hash
    const newImageHash = GenericTree.hash(tree)
    managerLeaf.imageHash = newImageHash
    console.log('New session manager image hash:', newImageHash)

    // Increment the checkpoint
    configuration.checkpoint += 1n

    // Update the wallet configuration
    return await this._wallet.prepareUpdate(configuration)
  }

  // Complete the configuration update
  async completeUpdateConfiguration(envelope: Envelope.Signed<Payload.ConfigUpdate>): Promise<void> {
    const configuration = await this._stateProvider?.getConfiguration(envelope.payload.imageHash)
    if (!configuration) {
      throw new Error('Wallet configuration not found')
    }

    // Find the session manager in the new configuration
    const managerLeaf = Config.findSignerLeaf(configuration, this._manager.address)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      throw new Error('Session manager not found in configuration')
    }
    const sessionTree = await this._stateProvider?.getTree(managerLeaf.imageHash)
    if (!sessionTree) {
      throw new Error('Session tree not found')
    }
    const topology = SessionConfig.configurationTreeToSessionsTopology(sessionTree)
    console.log('completeUpdateConfiguration Topology:', topology)

    // Submit the update with the new topology
    console.log('Submitting update:', envelope.payload.imageHash)
    await this._wallet.submitUpdate(envelope)
  }
}
