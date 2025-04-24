import { Config, Extensions, GenericTree, Payload } from '@0xsequence/wallet-primitives'
import { Shared } from './manager.js'
import { Address, Hex } from 'ox'
import { RecoverySigner } from './types/signer.js'
import { Envelope } from '@0xsequence/wallet-core'

export class Recovery {
  constructor(private readonly shared: Shared) {}

  private async updateRecoveryModule(
    modules: Config.SapientSignerLeaf[],
    transformer: (leaves: Extensions.Recovery.RecoveryLeaf[]) => Extensions.Recovery.RecoveryLeaf[],
  ) {
    const ext = this.shared.sequence.extensions.recovery
    const idx = modules.findIndex((m) => m.address === ext)
    if (idx === -1) {
      return
    }

    const genericTree = await this.shared.sequence.stateProvider.getTree(ext)
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
    return modules.some((m) => m.address === this.shared.sequence.extensions.recovery)
  }

  async addRecoverySignerToModules(modules: Config.SapientSignerLeaf[], address: Address.Address) {
    if (!this.hasRecoveryModule(modules)) {
      throw new Error('recovery-module-not-enabled')
    }

    await this.updateRecoveryModule(modules, (leaves) => {
      if (leaves.some((l) => l.signer === address)) {
        return leaves
      }

      const filtered = leaves.filter((l) => l.signer !== '0x0000000000000000000000000000000000000000')

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

  async getRecoverySigners(address: Address.Address): Promise<RecoverySigner[] | undefined> {
    const { raw } = await this.shared.modules.wallets.getConfiguration({ wallet: address })
    const recovertLeaf = raw.modules.find((m) => m.address === this.shared.sequence.extensions.recovery)
    if (!recovertLeaf) {
      return undefined
    }

    const recoveryGenericTree = await this.shared.sequence.stateProvider.getTree(recovertLeaf.address)
    if (!recoveryGenericTree) {
      throw new Error('recovery-module-tree-not-found')
    }

    const recoveryTree = Extensions.Recovery.fromGenericTree(recoveryGenericTree)
    const { leaves, isComplete } = Extensions.Recovery.getRecoveryLeaves(recoveryTree)
    if (!isComplete) {
      throw new Error('recovery-module-tree-incomplete')
    }

    return leaves
      .filter((l) => l.signer !== '0x0000000000000000000000000000000000000000')
      .map((l) => ({
        address: l.signer,
        kind: 'recovery',
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
}
