import { Config, Constants, Extensions, GenericTree, Payload } from '@0xsequence/wallet-primitives'
import { Shared } from './manager.js'
import { Hex, Provider, RpcTransport } from 'ox'
import { Kinds, RecoverySigner } from './types/signer.js'
import { Envelope } from '@0xsequence/wallet-core'
import { QueuedRecoveryPayload } from './types/recovery.js'
import { Actions } from './types/index.js'
import { MnemonicHandler } from './handlers/mnemonic.js'

export interface RecoveryInterface {
  /**
   * Retrieves the list of configured recovery signers for a given wallet.
   *
   * Recovery signers are special-purpose keys (e.g., a secondary mnemonic or device) that can execute
   * transactions on a wallet's behalf after a mandatory time delay (timelock). This method reads the
   * wallet's current configuration, finds the recovery module, and returns a detailed list of these signers.
   *
   * @param wallet The on-chain address of the wallet to query.
   * @returns A promise that resolves to an array of `RecoverySigner` objects. If the wallet does not have
   *   the recovery module enabled, it returns `undefined`.
   * @see {RecoverySigner} for details on the returned object structure.
   */
  getSigners(wallet: Address.Address): Promise<RecoverySigner[] | undefined>

  /**
   * Initiates the process of queuing a recovery payload for future execution. This is the first of a two-part
   * process to use the recovery mechanism.
   *
   * This method creates a special signature request that can *only* be signed by one of the wallet's designated
   * recovery signers. It does **not** send a transaction to the blockchain.
   *
   * @param wallet The address of the wallet that will be recovered.
   * @param chainId The chain ID on which the recovery payload is intended to be valid.
   * @param payload The transaction calls to be executed after the recovery timelock.
   * @returns A promise that resolves to a unique `requestId` for the signature request. This ID is then used
   *   with the signing UI and `completePayload`.
   * @see {completePayload} for the next step.
   */
  queuePayload(wallet: Address.Address, chainId: bigint, payload: Payload.Calls): Promise<string>

  /**
   * Finalizes a queued recovery payload request and returns the transaction data needed to start the timelock on-chain.
   *
   * This method must be called after the `requestId` from `queuePayload` has been successfully signed by a
   * recovery signer. It constructs the calldata for a transaction to the Recovery contract.
   *
   * **Note:** This method does *not* send the transaction. It is the developer's responsibility to take the
   * returned `to` and `data` and submit it to the network.
   *
   * When the timelock has passed, the transaction can be sent using the Recovery handler. To do this, a transaction
   * with the same original payload must be constructed, and the Recovery handler will become available to sign.
   *
   * The Recovery handler has sufficient weight to sign the transaction by itself, but it will only do so after
   * the timelock has passed, and only if the payload being sent matches the original one that was queued.
   *
   * @param requestId The ID of the fulfilled signature request from `queuePayload`.
   * @returns A promise that resolves to an object containing the `to` (the Recovery contract address) and `data`
   *   (the encoded calldata) for the on-chain queuing transaction.
   * @throws An error if the `requestId` is invalid, not for a recovery action, or not fully signed.
   */
  completePayload(requestId: string): Promise<{ to: Address.Address; data: Hex.Hex }>

  /**
   * Initiates a configuration update to add a new mnemonic as a recovery signer for a wallet.
   * This mnemonic is intended for emergency use and is protected by the wallet's recovery timelock.
   *
   * This action requires a signature from the wallet's *primary* signers (e.g., login keys, devices),
   * not the recovery signers.
   *
   * @param wallet The address of the wallet to modify.
   * @param mnemonic The mnemonic phrase to add as a new recovery signer.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {completeUpdate} to finalize this change after it has been signed.
   */
  addMnemonic(wallet: Address.Address, mnemonic: string): Promise<string>

  /**
   * Initiates a configuration update to add any generic address as a recovery signer.
   *
   * This is useful for adding other wallets or third-party keys as recovery agents. Note that if you add a key
   * for which the WDK does not have a registered `Handler`, you will need to manually implement the signing
   * flow for that key when it's time to use it for recovery.
   *
   * This action requires a signature from the wallet's *primary* signers.
   *
   * @param wallet The address of the wallet to modify.
   * @param address The address of the new recovery signer to add.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {completeUpdate} to finalize this change after it has been signed.
   */
  addSigner(wallet: Address.Address, address: Address.Address): Promise<string>

  /**
   * Initiates a configuration update to remove a recovery signer from a wallet.
   *
   * This action requires a signature from the wallet's *primary* signers.
   *
   * @param wallet The address of the wallet to modify.
   * @param address The address of the recovery signer to remove.
   * @returns A promise that resolves to a `requestId` for the configuration update signature request.
   * @see {completeUpdate} to finalize this change after it has been signed.
   */
  removeSigner(wallet: Address.Address, address: Address.Address): Promise<string>

  /**
   * Finalizes and saves a pending recovery configuration update.
   *
   * This method should be called after a signature request from `addMnemonic`, `addSigner`, or `removeSigner`
   * has been fulfilled. It saves the new configuration to the state provider, queuing it to be included in
   * the wallet's next regular transaction.
   *
   * **Important:** Initiating a new recovery configuration change (e.g., calling `addSigner`) will automatically
   * cancel any other pending configuration update for the same wallet, including those from other modules like
   * sessions. Only the most recent configuration change request will remain active.
   *
   * @param requestId The unique ID of the fulfilled signature request.
   * @returns A promise that resolves when the update has been successfully processed and saved.
   * @throws An error if the request is not a valid recovery update or has insufficient signatures.
   */
  completeUpdate(requestId: string): Promise<void>

  /**
   * Fetches the on-chain state of all queued recovery payloads for all managed wallets and updates the local database.
   *
   * This is a crucial security function. It allows the WDK to be aware of any recovery attempts, including
   * potentially malicious ones. It is run periodically by a background job but can be called manually to
   * force an immediate refresh.
   *
   * @returns A promise that resolves when the update check is complete.
   * @see {onQueuedPayloadsUpdate} to listen for changes discovered by this method.
   */
  updateQueuedPayloads(): Promise<void>

  /**
   * Subscribes to changes in the list of queued recovery payloads for a specific wallet or all wallets.
   *
   * This is the primary method for building a UI that monitors pending recovery actions. The callback is fired
   * whenever `updateQueuedPayloads` detects a change in the on-chain state.
   *
   * @param wallet (Optional) The address of a specific wallet to monitor. If omitted, the callback will receive
   *   updates for all managed wallets.
   * @param cb The callback function to execute with the updated list of `QueuedRecoveryPayload` objects.
   * @param trigger (Optional) If `true`, the callback is immediately invoked with the current state.
   * @returns A function that, when called, unsubscribes the listener.
   */
  onQueuedPayloadsUpdate(
    wallet: Address.Address | undefined,
    cb: (payloads: QueuedRecoveryPayload[]) => void,
    trigger?: boolean,
  ): () => void
}

export class Recovery implements RecoveryInterface {
  constructor(private readonly shared: Shared) {}

  initialize() {
    this.shared.modules.cron.registerJob(
      'update-queued-recovery-payloads',
      5 * 60 * 1000, // 5 minutes
      async () => {
        this.shared.modules.logger.log('Running job: update-queued-recovery-payloads')
        await this.updateQueuedPayloads()
      },
    )
    this.shared.modules.logger.log('Recovery module initialized and job registered.')
  }

  private async updateRecoveryModule(
    modules: Config.SapientSignerLeaf[],
    transformer: (leaves: Extensions.Recovery.RecoveryLeaf[]) => Extensions.Recovery.RecoveryLeaf[],
  ) {
    const ext = this.shared.sequence.extensions.recovery
    const idx = modules.findIndex((m) => Address.isEqual(m.address, ext))
    if (idx === -1) {
      return
    }

    const sapientSigner = modules[idx]
    if (!sapientSigner) {
      throw new Error('recovery-module-not-found')
    }

    const genericTree = await this.shared.sequence.stateProvider.getTree(sapientSigner.imageHash)
    if (!genericTree) {
      throw new Error('recovery-module-tree-not-found')
    }

    const tree = Extensions.Recovery.fromGenericTree(genericTree)
    const { leaves, isComplete } = Extensions.Recovery.getRecoveryLeaves(tree)
    if (!isComplete) {
      throw new Error('recovery-module-tree-incomplete')
    }

    const nextTree = Extensions.Recovery.fromRecoveryLeaves(transformer(leaves))
    const nextGeneric = Extensions.Recovery.toGenericTree(nextTree)
    await this.shared.sequence.stateProvider.saveTree(nextGeneric)
    if (!modules[idx]) {
      throw new Error('recovery-module-not-found-(unreachable)')
    }

    modules[idx].imageHash = GenericTree.hash(nextGeneric)
  }

  public async initRecoveryModule(modules: Config.SapientSignerLeaf[], address: Address.Address) {
    if (this.hasRecoveryModule(modules)) {
      throw new Error('recovery-module-already-initialized')
    }

    const recoveryTree = Extensions.Recovery.fromRecoveryLeaves([
      {
        type: 'leaf' as const,
        signer: address,
        requiredDeltaTime: this.shared.sequence.defaultRecoverySettings.requiredDeltaTime,
        minTimestamp: this.shared.sequence.defaultRecoverySettings.minTimestamp,
      },
    ])

    const recoveryGenericTree = Extensions.Recovery.toGenericTree(recoveryTree)
    await this.shared.sequence.stateProvider.saveTree(recoveryGenericTree)

    const recoveryImageHash = GenericTree.hash(recoveryGenericTree)

    modules.push({
      type: 'sapient-signer',
      address: this.shared.sequence.extensions.recovery,
      weight: 255n,
      imageHash: recoveryImageHash,
    } as Config.SapientSignerLeaf)
  }

  hasRecoveryModule(modules: Config.SapientSignerLeaf[]): boolean {
    return modules.some((m) => Address.isEqual(m.address, this.shared.sequence.extensions.recovery))
  }

  async addRecoverySignerToModules(modules: Config.SapientSignerLeaf[], address: Address.Address) {
    if (!this.hasRecoveryModule(modules)) {
      throw new Error('recovery-module-not-enabled')
    }

    await this.updateRecoveryModule(modules, (leaves) => {
      if (leaves.some((l) => Address.isEqual(l.signer, address))) {
        return leaves
      }

      const filtered = leaves.filter((l) => !Address.isEqual(l.signer, Constants.ZeroAddress))

      return [
        ...filtered,
        {
          type: 'leaf',
          signer: address,
          requiredDeltaTime: this.shared.sequence.defaultRecoverySettings.requiredDeltaTime,
          minTimestamp: this.shared.sequence.defaultRecoverySettings.minTimestamp,
        },
      ]
    })
  }

  async removeRecoverySignerFromModules(modules: Config.SapientSignerLeaf[], address: Address.Address) {
    if (!this.hasRecoveryModule(modules)) {
      throw new Error('recovery-module-not-enabled')
    }

    await this.updateRecoveryModule(modules, (leaves) => {
      const next = leaves.filter((l) => l.signer !== address)
      if (next.length === 0) {
        return [
          {
            type: 'leaf',
            signer: Constants.ZeroAddress,
            requiredDeltaTime: 0n,
            minTimestamp: 0n,
          },
        ]
      }

      return next
    })
  }

  async addMnemonic(wallet: Address.Address, mnemonic: string) {
    const signer = MnemonicHandler.toSigner(mnemonic)
    if (!signer) {
      throw new Error('invalid-mnemonic')
    }

    await signer.witness(this.shared.sequence.stateProvider, wallet, {
      isForRecovery: true,
      signerKind: Kinds.LoginMnemonic,
    })

    return this.addSigner(wallet, signer.address)
  }

  async addSigner(wallet: Address.Address, address: Address.Address) {
    const { modules } = await this.shared.modules.wallets.getConfigurationParts(wallet)
    await this.addRecoverySignerToModules(modules, address)
    return this.shared.modules.wallets.requestConfigurationUpdate(
      wallet,
      {
        modules,
      },
      Actions.AddRecoverySigner,
      'wallet-webapp',
    )
  }

  async removeSigner(wallet: Address.Address, address: Address.Address) {
    const { modules } = await this.shared.modules.wallets.getConfigurationParts(wallet)
    await this.removeRecoverySignerFromModules(modules, address)
    return this.shared.modules.wallets.requestConfigurationUpdate(
      wallet,
      { modules },
      Actions.RemoveRecoverySigner,
      'wallet-webapp',
    )
  }

  async completeUpdate(requestId: string) {
    const request = await this.shared.modules.signatures.get(requestId)
    if (request.action !== 'add-recovery-signer' && request.action !== 'remove-recovery-signer') {
      throw new Error('invalid-recovery-update-action')
    }

    return this.shared.modules.wallets.completeConfigurationUpdate(requestId)
  }

  async getSigners(address: Address.Address): Promise<RecoverySigner[] | undefined> {
    const { raw } = await this.shared.modules.wallets.getConfiguration(address)
    const recoveryLeaf = raw.modules.find((m) => Address.isEqual(m.address, this.shared.sequence.extensions.recovery))
    if (!recoveryLeaf) {
      return undefined
    }

    const recoveryGenericTree = await this.shared.sequence.stateProvider.getTree(recoveryLeaf.imageHash)
    if (!recoveryGenericTree) {
      throw new Error('recovery-module-tree-not-found')
    }

    const recoveryTree = Extensions.Recovery.fromGenericTree(recoveryGenericTree)
    const { leaves, isComplete } = Extensions.Recovery.getRecoveryLeaves(recoveryTree)
    if (!isComplete) {
      throw new Error('recovery-module-tree-incomplete')
    }

    const kos = await this.shared.modules.signers.resolveKinds(
      address,
      leaves.map((l) => l.signer),
    )

    return leaves
      .filter((l) => !Address.isEqual(l.signer, Constants.ZeroAddress))
      .map((l) => ({
        address: l.signer,
        kind: kos.find((s) => Address.isEqual(s.address, l.signer))?.kind || 'unknown',
        isRecovery: true,
        minTimestamp: l.minTimestamp,
        requiredDeltaTime: l.requiredDeltaTime,
      }))
  }

  async queuePayload(wallet: Address.Address, chainId: bigint, payload: Payload.Calls) {
    const signers = await this.getSigners(wallet)
    if (!signers) {
      throw new Error('recovery-signers-not-found')
    }

    const recoveryPayload = Payload.toRecovery(payload)
    const simulatedTopology = Config.flatLeavesToTopology(
      signers.map((s) => ({
        type: 'signer',
        address: s.address,
        weight: 1n,
      })),
    )

    // Save both versions of the payload in parallel
    await Promise.all([
      this.shared.sequence.stateProvider.savePayload(wallet, payload, chainId),
      this.shared.sequence.stateProvider.savePayload(wallet, recoveryPayload, chainId),
    ])

    const requestId = await this.shared.modules.signatures.request(
      {
        wallet,
        chainId,
        configuration: {
          threshold: 1n,
          checkpoint: 0n,
          topology: simulatedTopology,
        },
        payload: recoveryPayload,
      },
      'recovery',
    )

    return requestId
  }

  // TODO: Handle this transaction instead of just returning the to and data
  async completePayload(requestId: string): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const signature = await this.shared.modules.signatures.get(requestId)
    if (signature.action !== 'recovery' || !Payload.isRecovery(signature.envelope.payload)) {
      throw new Error('invalid-recovery-payload')
    }

    if (!Envelope.isSigned(signature.envelope)) {
      throw new Error('recovery-payload-not-signed')
    }

    const { weight, threshold } = Envelope.weightOf(signature.envelope)
    if (weight < threshold) {
      throw new Error('recovery-payload-insufficient-weight')
    }

    // Find any valid signature
    const validSignature = signature.envelope.signatures[0]
    if (Envelope.isSapientSignature(validSignature)) {
      throw new Error('recovery-payload-sapient-signatures-not-supported')
    }

    if (!validSignature) {
      throw new Error('recovery-payload-no-valid-signature')
    }

    const calldata = Extensions.Recovery.encodeCalldata(
      signature.wallet,
      signature.envelope.payload,
      validSignature.address,
      validSignature.signature,
    )

    return {
      to: this.shared.sequence.extensions.recovery,
      data: calldata,
    }
  }

  async getQueuedRecoveryPayloads(wallet?: Address.Address): Promise<QueuedRecoveryPayload[]> {
    const all = await this.shared.databases.recovery.list()
    if (wallet) {
      return all.filter((p) => Address.isEqual(p.wallet, wallet))
    }

    return all
  }

  onQueuedPayloadsUpdate(
    wallet: Address.Address | undefined,
    cb: (payloads: QueuedRecoveryPayload[]) => void,
    trigger?: boolean,
  ) {
    if (trigger) {
      this.getQueuedRecoveryPayloads(wallet).then(cb)
    }

    return this.shared.databases.recovery.addListener(() => {
      this.getQueuedRecoveryPayloads(wallet).then(cb)
    })
  }

  async updateQueuedPayloads(): Promise<void> {
    const wallets = await this.shared.modules.wallets.list()
    if (wallets.length === 0) {
      return
    }

    // Create providers for each network
    const providers = this.shared.sequence.networks.map((network) => ({
      chainId: network.chainId,
      provider: Provider.from(RpcTransport.fromHttp(network.rpc)),
    }))

    const seenInThisRun = new Set<string>()

    for (const wallet of wallets) {
      // See if they have any recover signers
      const signers = await this.getSigners(wallet.address)
      if (!signers || signers.length === 0) {
        continue
      }

      // Now we need to fetch, for each signer and network, any queued recovery payloads
      // TODO: This may benefit from multicall, but it is not urgent, as this happens in the background
      for (const signer of signers) {
        for (const { chainId, provider } of providers) {
          const totalPayloads = await Extensions.Recovery.totalQueuedPayloads(
            provider,
            this.shared.sequence.extensions.recovery,
            wallet.address,
            signer.address,
          )

          for (let i = 0n; i < totalPayloads; i++) {
            const payloadHash = await Extensions.Recovery.queuedPayloadHashOf(
              provider,
              this.shared.sequence.extensions.recovery,
              wallet.address,
              signer.address,
              i,
            )

            const timestamp = await Extensions.Recovery.timestampForQueuedPayload(
              provider,
              this.shared.sequence.extensions.recovery,
              wallet.address,
              signer.address,
              payloadHash,
            )

            const payload = await this.shared.sequence.stateProvider.getPayload(payloadHash)

            // If ready, we need to check if it was executed already
            // for this, we check if the wallet nonce for the given space
            // is greater than the nonce in the payload
            if (timestamp < Date.now() / 1000 && payload && Payload.isCalls(payload.payload)) {
              const nonce = await this.shared.modules.wallets.getNonce(chainId, wallet.address, payload.payload.space)
              if (nonce > i) {
                continue
              }
            }

            // The id is the index + signer address + chainId + wallet address
            const id = `${i}-${signer.address}-${chainId}-${wallet.address}`

            // Create a new payload
            const payloadEntry: QueuedRecoveryPayload = {
              id,
              index: i,
              recoveryModule: this.shared.sequence.extensions.recovery,
              wallet: wallet.address,
              signer: signer.address,
              chainId,
              startTimestamp: timestamp,
              endTimestamp: timestamp + signer.requiredDeltaTime,
              payloadHash,
              payload: payload?.payload,
            }

            await this.shared.databases.recovery.set(payloadEntry)
            seenInThisRun.add(payloadEntry.id)
          }
        }
      }

      // Delete any unseen queued payloads as they are no longer relevant
      const allQueuedPayloads = await this.shared.databases.recovery.list()
      for (const payload of allQueuedPayloads) {
        if (!seenInThisRun.has(payload.id)) {
          await this.shared.databases.recovery.del(payload.id)
        }
      }
    }
  }

  async encodeRecoverySignature(imageHash: Hex.Hex, signer: Address.Address) {
    const genericTree = await this.shared.sequence.stateProvider.getTree(imageHash)
    if (!genericTree) {
      throw new Error('recovery-module-tree-not-found')
    }

    const tree = Extensions.Recovery.fromGenericTree(genericTree)
    const allSigners = Extensions.Recovery.getRecoveryLeaves(tree).leaves.map((l) => l.signer)

    if (!allSigners.includes(signer)) {
      throw new Error('signer-not-found-in-recovery-module')
    }

    const trimmed = Extensions.Recovery.trimTopology(tree, signer)
    return Extensions.Recovery.encodeTopology(trimmed)
  }
}
