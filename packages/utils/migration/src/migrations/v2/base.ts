import { commons as v2commons } from '@0xsequence/v2core'
import { State } from '@0xsequence/wallet-core'
import { Payload, Config as V3Config } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hex } from 'ox'
import { UnsignedMigration } from '../../types.js'

export type PrepareOptions = {
  space?: bigint
}

// V1 and V2 share the same interfaces
export abstract class BaseMigrationEncoder_v1v2 {
  abstract fromVersion: number
  toVersion = 3

  protected async prepareMigrationToImplementation(
    walletAddress: Address.Address,
    toImplementation: Address.Address,
    toConfig: V3Config.Config,
    options: PrepareOptions,
  ): Promise<UnsignedMigration> {
    const space = options?.space ?? 0n
    const nonce = 0n // Nonce must be unused

    // Update implementation to v3
    const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
    const updateImplementationTx: Payload.Call = {
      to: walletAddress,
      data: AbiFunction.encodeData(updateImplementationAbi, [toImplementation]),
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
