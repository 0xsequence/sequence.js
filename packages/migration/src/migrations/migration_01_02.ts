import { commons, v1, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'

import { Migration, MIGRATION_NONCE_SPACE } from '.'
import { walletContracts } from '@0xsequence/abi'
import { UnsignedMigration } from '../migrator'

export class Migration_v1v2 implements Migration<v1.config.WalletConfig, v2.config.WalletConfig> {
  version = 2

  configCoder = v2.config.ConfigCoder
  signatureCoder = v2.signature.SignatureCoder

  buildTransaction(
    address: string,
    contexts: commons.context.VersionedContext,
    newConfig: v1.config.WalletConfig | v2.config.WalletConfig
  ): UnsignedMigration {
    // If new config is not v2, then we need to convert it to v2
    if (!v2.config.ConfigCoder.isWalletConfig(newConfig)) {
      const v2Config = v2.config.toWalletConfig({
        threshold: newConfig.threshold,
        members: newConfig.signers,
        checkpoint: 0
      })

      return this.buildTransaction(address, contexts, v2Config)
    }

    const context = contexts[2]
    const contract = new ethers.Interface(walletContracts.mainModule.abi)

    // WARNING: v1 wallets CAN NOT use v2 configurations so we ALWAYS need to update
    // both the implementation and the configuration at the same time

    const updateBundle = v2.config.ConfigCoder.update.buildTransaction(address, newConfig, context, 'first')

    const tx = {
      entrypoint: address,
      nonce: commons.transaction.encodeNonce(MIGRATION_NONCE_SPACE, 0),
      transactions: [
        {
          to: address,
          value: 0,
          gasLimit: 0,
          revertOnError: true,
          delegateCall: false,
          data: contract.encodeFunctionData(contract.getFunction('updateImplementation')!, [context.mainModuleUpgradable])
        },
        ...updateBundle.transactions
      ]
    }

    return {
      tx,
      fromVersion: this.version - 1,
      toVersion: this.version,
      toConfig: newConfig
    }
  }

  decodeTransaction(
    tx: commons.transaction.TransactionBundle,
    contexts: commons.context.VersionedContext
  ): {
    address: string
    newImageHash: string
  } {
    const address = tx.entrypoint

    if (tx.transactions.length < 2) {
      throw new Error('Invalid transaction bundle size')
    }

    if (!tx.nonce || commons.transaction.encodeNonce(MIGRATION_NONCE_SPACE, 0) !== BigInt(tx.nonce)) {
      throw new Error('Invalid transaction bundle nonce')
    }

    if (
      tx.transactions[0].to !== address ||
      tx.transactions[1].to !== address ||
      tx.transactions[0].delegateCall ||
      tx.transactions[1].delegateCall ||
      !tx.transactions[0].revertOnError ||
      !tx.transactions[1].revertOnError ||
      (tx.transactions[0].value && BigInt(tx.transactions[0].value) !== 0n) ||
      (tx.transactions[1].value && BigInt(tx.transactions[1].value) !== 0n) ||
      (tx.transactions[0].gasLimit && BigInt(tx.transactions[0].gasLimit) !== 0n) ||
      (tx.transactions[1].gasLimit && BigInt(tx.transactions[1].gasLimit) !== 0n)
    ) {
      throw new Error('Invalid transaction bundle format')
    }

    const context = contexts[2]
    const contract = new ethers.Interface(walletContracts.mainModule.abi)

    const data1 = ethers.hexlify(tx.transactions[0].data || new Uint8Array())
    const expectData1 = ethers.hexlify(
      contract.encodeFunctionData(contract.getFunction('updateImplementation')!, [context.mainModuleUpgradable])
    )

    if (data1 !== expectData1) {
      throw new Error('Invalid new implementation on transaction')
    }

    const decoded2 = v2.config.ConfigCoder.update.decodeTransaction({ entrypoint: address, transactions: [tx.transactions[1]] })
    if (decoded2.address !== address) {
      throw new Error('Invalid transaction bundle address')
    }

    return decoded2
  }
}
