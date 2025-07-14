import { Config, Extensions, GenericTree, Payload } from '@0xsequence/wallet-primitives'
import { Shared } from './manager.js'
import { Address, Hex, Provider, RpcTransport } from 'ox'
import { Kinds, RecoverySigner } from './types/signer.js'
import { Envelope } from '@0xsequence/wallet-core'
import { QueuedRecoveryPayload } from './types/recovery.js'
import { Actions } from './types/index.js'
import { MnemonicHandler } from './handlers/mnemonic.js'

export class Recovery {
  constructor(private readonly shared: Shared) {}

  initialize() {
    this.shared.modules.cron.registerJob(
      'update-queued-recovery-payloads',
      5 * 60 * 1000, // 5 minutes
      async () => {
        this.shared.modules.logger.log('Running job: update-queued-recovery-payloads')
        await this.updateQueuedRecoveryPayloads()
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

      const filtered = leaves.filter((l) => !Address.isEqual(l.signer, '0x0000000000000000000000000000000000000000'))

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
            signer: '0x0000000000000000000000000000000000000000',
            requiredDeltaTime: 0n,
            minTimestamp: 0n,
          },
        ]
      }

      return next
    })
  }

  async addRecoveryMnemonic(wallet: Address.Address, mnemonic: string) {
    const signer = MnemonicHandler.toSigner(mnemonic)
    if (!signer) {
      throw new Error('invalid-mnemonic')
    }

    await signer.witness(this.shared.sequence.stateProvider, wallet, {
      isForRecovery: true,
      signerKind: Kinds.LoginMnemonic,
    })

    return this.addRecoverySigner(wallet, signer.address)
  }

  async addRecoverySigner(wallet: Address.Address, address: Address.Address) {
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

  async removeRecoverySigner(wallet: Address.Address, address: Address.Address) {
    const { modules } = await this.shared.modules.wallets.getConfigurationParts(wallet)
    await this.removeRecoverySignerFromModules(modules, address)
    return this.shared.modules.wallets.requestConfigurationUpdate(
      wallet,
      { modules },
      Actions.RemoveRecoverySigner,
      'wallet-webapp',
    )
  }

  async completeRecoveryUpdate(requestId: string) {
    const request = await this.shared.modules.signatures.get(requestId)
    if (request.action !== 'add-recovery-signer' && request.action !== 'remove-recovery-signer') {
      throw new Error('invalid-recovery-update-action')
    }

    return this.shared.modules.wallets.completeConfigurationUpdate(requestId)
  }

  async getRecoverySigners(address: Address.Address): Promise<RecoverySigner[] | undefined> {
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
      .filter((l) => !Address.isEqual(l.signer, '0x0000000000000000000000000000000000000000'))
      .map((l) => ({
        address: l.signer,
        kind: kos.find((s) => Address.isEqual(s.address, l.signer))?.kind || 'unknown',
        isRecovery: true,
        minTimestamp: l.minTimestamp,
        requiredDeltaTime: l.requiredDeltaTime,
      }))
  }

  async queueRecoveryPayload(wallet: Address.Address, chainId: bigint, payload: Payload.Calls) {
    const signers = await this.getRecoverySigners(wallet)
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
  async completeRecoveryPayload(requestId: string): Promise<{ to: Address.Address; data: Hex.Hex }> {
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

  onQueuedRecoveryPayloadsUpdate(
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

  async updateQueuedRecoveryPayloads(): Promise<void> {
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
      const signers = await this.getRecoverySigners(wallet.address)
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
            // for this, we check if the wallet 77nonce for the given space
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
