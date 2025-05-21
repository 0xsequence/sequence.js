import { Signers } from '@0xsequence/wallet-core'
import { Attestation, Config, GenericTree, SessionConfig } from '@0xsequence/wallet-primitives'
import { ManagerOptionsDefaults } from '../sequence/manager.js'
export class SessionController {
  _manager
  _wallet
  _identitySigner
  _stateProvider
  constructor(configuration) {
    this._manager = new Signers.SessionManager(configuration.wallet, {
      provider: configuration.provider,
    })
    this._wallet = configuration.wallet
    this._identitySigner = configuration.identitySigner ?? null
    this._stateProvider = configuration.stateProvider ?? null
  }
  async getTopology() {
    return this._manager.topology
  }
  async getImageHash() {
    return this._manager.imageHash.then((imageHash) => {
      if (!imageHash) {
        throw new Error('Image hash not found')
      }
      return imageHash
    })
  }
  withProvider(provider) {
    this._manager = this._manager.withProvider(provider)
    return this
  }
  async addImplicitSession(signerAddress, attestationParams) {
    const attestation = {
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
  async addExplicitSession(signerAddress, permissions) {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.addExplicitSession(topology, {
      ...permissions,
      signer: signerAddress,
    })
    return await this.prepareUpdateConfiguration(newTopology)
  }
  async removeExplicitSession(signerAddress) {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.removeExplicitSession(topology, signerAddress)
    if (!newTopology) {
      throw new Error('Session not found')
    }
    return await this.prepareUpdateConfiguration(newTopology)
  }
  async addBlacklistAddress(address) {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.addToImplicitBlacklist(topology, address)
    return await this.prepareUpdateConfiguration(newTopology)
  }
  async removeBlacklistAddress(address) {
    const topology = await this.getTopology()
    const newTopology = SessionConfig.removeFromImplicitBlacklist(topology, address)
    return await this.prepareUpdateConfiguration(newTopology)
  }
  // Prepare the configuration update to use the new topology
  async prepareUpdateConfiguration(topology) {
    // Create a new manager with the new topology
    // Store the new configuration
    if (!this._stateProvider) {
      throw new Error('State provider not provided')
    }
    const tree = SessionConfig.sessionsTopologyToConfigurationTree(topology)
    await this._stateProvider.saveTree(tree)
    const newImageHash = GenericTree.hash(tree)
    // Get the old wallet configuration
    const { configuration } = await this._wallet.getStatus()
    let newConfiguration = Config.configFromJson(Config.configToJson(configuration))
    // Find the session manager in the old configuration
    const managerLeaf = Config.findSignerLeaf(newConfiguration, this._manager.address)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      // Just add it
      const newManagerLeaf = {
        ...ManagerOptionsDefaults.defaultSessionsTopology,
        address: this._manager.address,
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
    return await this._wallet.prepareUpdate(newConfiguration)
  }
  // Complete the configuration update
  async completeUpdateConfiguration(envelope) {
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
