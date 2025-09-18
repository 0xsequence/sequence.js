import { Signers as CoreSigners, Envelope } from '@0xsequence/wallet-core'
import {
  Attestation,
  Config,
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
import { Kinds, Module } from './types/index.js'
import { Handler } from './handlers/index.js'

export type AuthorizeImplicitSessionArgs = {
  target: string
  applicationData?: Hex.Hex
}

export interface SessionsInterface {
  /**
   * Retrieves the raw, detailed session topology for a given wallet.
   *
   * The session topology is a tree-like data structure that defines all session-related configurations for a wallet.
   * This includes the identity signer (the primary credential that authorizes sessions), the list of explicit
   * session keys with their permissions, and the blacklist of contracts forbidden from using implicit sessions.
   *
   * This method is useful for inspecting the low-level structure of the sessions extension.
   *
   * @param walletAddress The on-chain address of the wallet.
   * @returns A promise that resolves to the wallet's `SessionsTopology` object.
   * @throws An error if the wallet is not configured with a session manager or if the topology cannot be found.
   */
  getTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology>

  /**
   * Initiates the authorization of an "implicit session".
   *
   * An implicit session allows a temporary key (`sessionAddress`) to sign on behalf of the wallet for specific,
   * pre-approved smart contracts without requiring an on-chain configuration change. This is achieved by having the
   * wallet's primary identity signer (e.g., a passkey, or the identity instrument) sign an "attestation".
   *
   * This method prepares the attestation and creates a signature request for the identity signer.
   * The returned `requestId` must be used to get the signature from the user.
   *
   * @param walletAddress The address of the wallet authorizing the session.
   * @param sessionAddress The address of the temporary key that will become the implicit session signer.
   * @param args The authorization arguments.
   * @param args.target A string, typically a URL, identifying the application or service (the "audience")
   *   that is being granted this session. This is a critical security parameter.
   * @param args.applicationData (Optional) Extra data that can be included in the attestation.
   * @returns A promise that resolves to a `requestId` for the signature request.
   * @see {completeAuthorizeImplicitSession} to finalize the process after signing.
   */
  prepareAuthorizeImplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    args: AuthorizeImplicitSessionArgs,
  ): Promise<string>

  /**
   * Completes the authorization of an implicit session.
   *
   * This method should be called after the signature request from `prepareAuthorizeImplicitSession` has been
   * fulfilled by the user's identity signer. It finalizes the process and returns the signed attestation.
   *
   * The returned attestation and its signature are the credentials needed to initialize an `Implicit`
   * session signer, which can then be used by a dapp to interact with approved contracts.
   *
   * @param requestId The unique ID of the signature request returned by `prepareAuthorizeImplicitSession`.
   * @returns A promise that resolves to an object containing the signed `attestation` and the `signature` from the identity signer.
   * @throws An error if the signature request is not found or has not been successfully signed.
   */
  completeAuthorizeImplicitSession(requestId: string): Promise<{
    attestation: Attestation.Attestation
    signature: SequenceSignature.RSY
  }>

  /**
   * Initiates an on-chain configuration update to add an "explicit session".
   *
   * An explicit session grants a specified key (`sessionAddress`) on-chain signing rights for the
   * wallet, constrained by a set of defined permissions. This gives the session key the ability to send
   * transactions on the wallet's behalf as long as they comply with the rules.
   *
   * This process is more powerful than creating an implicit session but requires explicit authorization.
   * This method prepares the configuration update and returns a `requestId` that must be signed and then
   * completed using the `complete` method.
   *
   * @param walletAddress The address of the wallet to modify.
   * @param sessionAddress The address of the key to be added as a session signer.
   * @param permissions The set of rules and limits that will govern this session key's capabilities.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {complete} to finalize the update after it has been signed.
   */
  addExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
  ): Promise<string>

  /**
   * Initiates an on-chain configuration update to modify an existing "explicit session".
   *
   * This method atomically replaces the permissions for a given session key. If the session
   * key does not already exist, it will be added. This is the recommended way to update
   * permissions for an active session.
   *
   * Like adding a session, this requires a signed configuration update.
   *
   * @param walletAddress The address of the wallet to modify.
   * @param sessionAddress The address of the session signer to modify.
   * @param permissions The new, complete set of rules and limits for this session key.
   * @param origin Optional string to identify the source of the request.
   * @returns A promise that resolves to a `requestId` for the configuration update.
   * @see {complete} to finalize the update after it has been signed.
   */
  modifyExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
    origin?: string,
  ): Promise<string>

  /**
   * Initiates an on-chain configuration update to remove an explicit session key.
   *
   * This revokes all on-chain permissions for the specified `sessionAddress`, effectively disabling it.
   * Like adding a session, this requires a signed configuration update.
   *
   * @param walletAddress The address of the wallet to modify.
   * @param sessionAddress The address of the session signer to remove.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {complete} to finalize the update after it has been signed.
   */
  removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address): Promise<string>

  /**
   * Initiates an on-chain configuration update to add a contract address to the implicit session blacklist.
   *
   * Once blacklisted, a contract cannot be the target of transactions signed by any implicit session key for this wallet.
   *
   * @param walletAddress The address of the wallet to modify.
   * @param address The contract address to add to the blacklist.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {complete} to finalize the update after it has been signed.
   */
  addBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string>

  /**
   * Initiates an on-chain configuration update to remove a contract address from the implicit session blacklist.
   *
   * @param walletAddress The address of the wallet to modify.
   * @param address The contract address to remove from the blacklist.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {complete} to finalize the update after it has been signed.
   */
  removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string>

  /**
   * Finalizes and saves a pending  session configuration update.
   *
   * This method should be called after a signature request generated by `addExplicitSession`,
   * `removeExplicitSession`, `addBlacklistAddress`, or `removeBlacklistAddress` has been
   * successfully signed and has met its weight threshold. It takes the signed configuration
   * and saves it to the state provider, making it the new pending configuration for the wallet.
   * The next regular transaction will then automatically include this update.
   *
   * **Important:** Calling any of the four modification methods (`addExplicitSession`, etc.) will
   * automatically cancel any other pending configuration update for the same wallet. This is to
   * prevent conflicts and ensure only the most recent intended state is applied. For example, if you
   * call `addExplicitSession` and then `removeExplicitSession` before completing the first request,
   * the first signature request will be cancelled, and only the second one will remain active.
   *
   * @param requestId The unique ID of the fulfilled signature request.
   * @returns A promise that resolves when the update has been successfully processed and saved.
   * @throws An error if the request is not a 'session-update' action, is not found, or has insufficient signatures.
   */
  complete(requestId: string): Promise<void>
}

export class Sessions implements SessionsInterface {
  constructor(private readonly shared: Shared) {}

  async getTopology(walletAddress: Address.Address, fixMissing = false): Promise<SessionConfig.SessionsTopology> {
    const { loginTopology, devicesTopology, modules } =
      await this.shared.modules.wallets.getConfigurationParts(walletAddress)
    const managerModule = modules.find((m) =>
      Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.sessions),
    )
    if (!managerModule) {
      if (fixMissing) {
        // Create the default session manager leaf
        const authorizedSigners = [...Config.topologyToFlatLeaves([devicesTopology, loginTopology])].filter(
          Config.isSignerLeaf,
        )
        if (authorizedSigners.length === 0) {
          throw new Error('No signer leaves found')
        }
        let sessionsTopology = SessionConfig.emptySessionsTopology(authorizedSigners[0]!.address)
        for (let i = 1; i < authorizedSigners.length; i++) {
          sessionsTopology = SessionConfig.addIdentitySigner(sessionsTopology, authorizedSigners[i]!.address)
        }
        const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology)
        this.shared.sequence.stateProvider.saveTree(sessionsConfigTree)
        const imageHash = GenericTree.hash(sessionsConfigTree)
        const leaf: Config.SapientSignerLeaf = {
          ...ManagerOptionsDefaults.defaultSessionsTopology,
          address: this.shared.sequence.extensions.sessions,
          imageHash,
        }
        modules.push({
          sapientLeaf: leaf,
          weight: 255n,
        })
        return SessionConfig.configurationTreeToSessionsTopology(sessionsConfigTree)
      }
      throw new Error('Session manager not found')
    }
    const imageHash = managerModule.sapientLeaf.imageHash
    const tree = await this.shared.sequence.stateProvider.getTree(imageHash)
    if (!tree) {
      throw new Error('Session topology not found')
    }
    return SessionConfig.configurationTreeToSessionsTopology(tree)
  }

  private async updateSessionModule(
    modules: Module[],
    transformer: (topology: SessionConfig.SessionsTopology) => SessionConfig.SessionsTopology,
  ) {
    const ext = this.shared.sequence.extensions.sessions
    const idx = modules.findIndex((m) => Address.isEqual(m.sapientLeaf.address, ext))
    if (idx === -1) {
      return
    }

    const sessionModule = modules[idx]
    if (!sessionModule) {
      throw new Error('session-module-not-found')
    }

    const genericTree = await this.shared.sequence.stateProvider.getTree(sessionModule.sapientLeaf.imageHash)
    if (!genericTree) {
      throw new Error('session-module-tree-not-found')
    }

    const topology = SessionConfig.configurationTreeToSessionsTopology(genericTree)
    const nextTopology = transformer(topology)
    const nextTree = SessionConfig.sessionsTopologyToConfigurationTree(nextTopology)
    await this.shared.sequence.stateProvider.saveTree(nextTree)
    if (!modules[idx]) {
      throw new Error('session-module-not-found-(unreachable)')
    }

    modules[idx].sapientLeaf.imageHash = GenericTree.hash(nextTree)
  }

  hasSessionModule(modules: Module[]): boolean {
    return modules.some((m) => Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.sessions))
  }

  async initSessionModule(modules: Module[], identitySigners: Address.Address[], guardTopology?: Config.NestedLeaf) {
    if (this.hasSessionModule(modules)) {
      throw new Error('session-module-already-initialized')
    }

    if (identitySigners.length === 0) {
      throw new Error('No identity signers provided')
    }

    // Calculate image hash with the identity signers
    const sessionsTopology = SessionConfig.emptySessionsTopology(
      identitySigners as [Address.Address, ...Address.Address[]],
    )
    // Store this tree in the state provider
    const sessionsConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology)
    this.shared.sequence.stateProvider.saveTree(sessionsConfigTree)
    // Prepare the configuration leaf
    const sessionsImageHash = GenericTree.hash(sessionsConfigTree)
    const signer = {
      ...ManagerOptionsDefaults.defaultSessionsTopology,
      address: this.shared.sequence.extensions.sessions,
      imageHash: sessionsImageHash,
    }
    modules.push({
      sapientLeaf: signer,
      weight: 255n,
      guardLeaf: guardTopology,
    })
  }

  async addIdentitySignerToModules(modules: Module[], address: Address.Address) {
    if (!this.hasSessionModule(modules)) {
      throw new Error('session-module-not-enabled')
    }

    await this.updateSessionModule(modules, (topology) => {
      const existingSigners = SessionConfig.getIdentitySigners(topology)
      if (existingSigners?.some((s) => Address.isEqual(s, address))) {
        return topology
      }

      return SessionConfig.addIdentitySigner(topology, address)
    })
  }

  async removeIdentitySignerFromModules(modules: Module[], address: Address.Address) {
    if (!this.hasSessionModule(modules)) {
      throw new Error('session-module-not-enabled')
    }

    await this.updateSessionModule(modules, (topology) => {
      const newTopology = SessionConfig.removeIdentitySigner(topology, address)
      if (!newTopology) {
        // Can't remove the last identity signer
        throw new Error('Cannot remove the last identity signer')
      }
      return newTopology
    })
  }

  async prepareAuthorizeImplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    args: AuthorizeImplicitSessionArgs,
  ): Promise<string> {
    const topology = await this.getTopology(walletAddress)
    const identitySigners = SessionConfig.getIdentitySigners(topology)
    if (!identitySigners) {
      throw new Error('No identity signers found')
    }
    let handler: Handler | undefined
    let identitySignerAddress: Address.Address | undefined
    for (const identitySigner of identitySigners) {
      const identityKind = await this.shared.modules.signers.kindOf(walletAddress, identitySigner)
      if (!identityKind) {
        console.warn('No identity handler kind found for', identitySigner)
        continue
      }
      if (identityKind === Kinds.LoginPasskey) {
        console.warn('Implicit sessions do not support passkeys', identitySigner)
        continue
      }
      const iHandler = this.shared.handlers.get(identityKind)
      if (iHandler) {
        handler = iHandler
        identitySignerAddress = identitySigner
        break
      }
    }

    if (!handler || !identitySignerAddress) {
      throw new Error('No identity handler or address found')
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
        issuedAt: BigInt(Math.floor(Date.now() / 1000)),
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
      chainId: 0,
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
    const topology = await this.getTopology(walletAddress, true)
    const newTopology = SessionConfig.addExplicitSession(topology, {
      ...permissions,
      signer: sessionAddress,
    })
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async modifyExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
    origin?: string,
  ): Promise<string> {
    // This will add the session manager if it's missing
    const topology = await this.getTopology(walletAddress, true)
    const intermediateTopology = SessionConfig.removeExplicitSession(topology, sessionAddress)
    if (!intermediateTopology) {
      throw new Error('Incomplete session topology')
    }
    const newTopology = SessionConfig.addExplicitSession(intermediateTopology, {
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
    const topology = await this.getTopology(walletAddress)
    const newTopology = SessionConfig.removeExplicitSession(topology, sessionAddress)
    if (!newTopology) {
      throw new Error('Incomplete session topology')
    }
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async addBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const topology = await this.getTopology(walletAddress, true)
    const newTopology = SessionConfig.addToImplicitBlacklist(topology, address)
    return this.prepareSessionUpdate(walletAddress, newTopology, origin)
  }

  async removeBlacklistAddress(
    walletAddress: Address.Address,
    address: Address.Address,
    origin?: string,
  ): Promise<string> {
    const topology = await this.getTopology(walletAddress)
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
    const managerModule = modules.find((m) =>
      Address.isEqual(m.sapientLeaf.address, this.shared.sequence.extensions.sessions),
    )
    if (!managerModule) {
      // Missing. Add it
      modules.push({
        sapientLeaf: {
          ...ManagerOptionsDefaults.defaultSessionsTopology,
          address: this.shared.sequence.extensions.sessions,
          imageHash: newImageHash,
        },
        weight: 255n,
      })
    } else {
      // Update the configuration to use the new session manager image hash
      managerModule.sapientLeaf.imageHash = newImageHash
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

  async complete(requestId: string) {
    const sigRequest = await this.shared.modules.signatures.get(requestId)
    if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(sigRequest.envelope.payload)) {
      throw new Error('Invalid action')
    }

    return this.shared.modules.wallets.completeConfigurationUpdate(requestId)
  }
}
