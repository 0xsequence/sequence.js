import { v1, commons as v2commons } from '@0xsequence/v2core'
import { State } from '@0xsequence/wallet-core'
import {
  Payload,
  Config as V3Config,
  Context as V3Context,
  Extensions as V3Extensions,
} from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hex } from 'ox'
import { UnsignedMigration, VersionedContext } from '../../types.js'
import { MigrationEncoder } from '../index.js'
import { createDefaultV3Topology } from '../v3/config.js'

// uint160(keccak256("org.sequence.sdk.migration.v1v3.space.nonce"))
export const MIGRATION_V1_V3_NONCE_SPACE = '0x9e4d5bdafd978baf1290aff23057245a2a62bef5'

export type ConvertOptions = {
  loginSigner: {
    address: Address.Address
    imageHash?: Hex.Hex
  }
  extensions?: V3Extensions.Extensions
}

export type PrepareOptions = {
  space?: bigint
}

export class MigrationEncoder_v1v3
  implements MigrationEncoder<v1.config.WalletConfig, V3Config.Config, ConvertOptions, PrepareOptions>
{
  fromVersion = 1
  toVersion = 3

  async convertConfig(fromConfig: v1.config.WalletConfig, options: ConvertOptions): Promise<V3Config.Config> {
    const signerLeaves: V3Config.SignerLeaf[] = fromConfig.signers.map((signer) => ({
      type: 'signer',
      address: Address.from(signer.address),
      weight: BigInt(signer.weight),
    }))
    const v1NestedTopology = V3Config.flatLeavesToTopology(signerLeaves)
    return {
      threshold: 1n,
      checkpoint: 0n,
      topology: [
        {
          type: 'nested',
          weight: 1n,
          threshold: BigInt(fromConfig.threshold),
          tree: v1NestedTopology,
        },
        {
          type: 'nested',
          weight: 1n,
          threshold: 2n,
          tree: createDefaultV3Topology(options.loginSigner, options.extensions),
        },
      ],
    }
  }

  async prepareMigration(
    walletAddress: Address.Address,
    contexts: VersionedContext,
    toConfig: V3Config.Config,
    options: PrepareOptions,
  ): Promise<UnsignedMigration> {
    const v3Context = contexts[3] || V3Context.Rc3
    if (!V3Context.isContext(v3Context)) {
      throw new Error('Invalid context')
    }

    const space = options?.space ?? BigInt(MIGRATION_V1_V3_NONCE_SPACE)
    const nonce = 0n // Nonce must be unused
    // const v2Nonce = v2commons.transaction.encodeNonce(space, nonce)

    // Update implementation to v3
    const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
    const updateImplementationTx: Payload.Call = {
      to: walletAddress,
      data: AbiFunction.encodeData(updateImplementationAbi, [v3Context.stage2]),
      value: 0n,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }
    // Update configuration to v3
    const toImageHash = Hex.fromBytes(V3Config.hashConfiguration(toConfig))
    const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')
    const updateImageHashTx: Payload.Call = {
      to: walletAddress,
      data: AbiFunction.encodeData(updateImageHashAbi, [toImageHash]),
      value: 0n,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }

    const payload: Payload.Calls = {
      type: 'call',
      space,
      nonce,
      calls: [updateImplementationTx, updateImageHashTx],
    }

    return {
      payload,
      fromVersion: this.fromVersion,
      toVersion: this.toVersion,
      toConfig,
    }
  }

  async toTransactionData(migration: State.Migration): Promise<{ to: Address.Address; data: Hex.Hex }> {
    const { payload, signature, chainId } = migration
    const walletAddress = payload.calls[0]!.to
    const v2Nonce = v2commons.transaction.encodeNonce(payload.space, payload.nonce)
    const transactions = payload.calls.map((tx) => ({
      to: tx.to,
      data: tx.data,
      gasLimit: tx.gasLimit,
      revertOnError: tx.behaviorOnError === 'revert',
    }))
    const digest = v2commons.transaction.digestOfTransactions(v2Nonce, transactions)
    const txBundle: v2commons.transaction.SignedTransactionBundle = {
      entrypoint: walletAddress,
      transactions,
      nonce: v2Nonce,
      chainId,
      signature,
      intent: {
        id: digest,
        wallet: walletAddress,
      },
    }
    const encodedData = v2commons.transaction.encodeBundleExecData(txBundle)
    Hex.assert(encodedData)
    return {
      to: walletAddress,
      data: encodedData,
    }
  }

  async decodePayload(payload: Payload.Calls): Promise<{
    address: Address.Address
    toImageHash: Hex.Hex
  }> {
    if (payload.calls.length !== 2) {
      throw new Error('Invalid calls')
    }
    const tx1 = payload.calls[0]!
    const tx2 = payload.calls[1]!
    if (tx1.to !== tx2.to) {
      throw new Error('Invalid to address')
    }
    const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
    AbiFunction.decodeData(updateImplementationAbi, tx1.data) // Check decoding works for update implementation
    const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')
    const updateImageHashArgs = AbiFunction.decodeData(updateImageHashAbi, tx2.data)
    return {
      address: tx1.to,
      toImageHash: updateImageHashArgs[0],
    }
  }
}
