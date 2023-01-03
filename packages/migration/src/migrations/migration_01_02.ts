import { commons, v1, v2 } from "@0xsequence/core"
import { ethers } from "ethers"

import { Migration } from "."
import { walletContracts } from "../../../0xsequence/src/abi"
import { VersionedContext } from "../context"

export class Migration_v1v2 implements Migration<
  v1.config.WalletConfig,
  v2.config.WalletConfig
> {
  version = 2

  configCoder = v2.config.ConfigCoder
  signatureCoder = v2.signature.SignatureCoder

  buildTransaction(
    address: string,
    contexts: VersionedContext,
    newConfig: v1.config.WalletConfig | v2.config.WalletConfig
  ): commons.transaction.TransactionBundle {
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
    const contract = new ethers.utils.Interface(walletContracts.mainModule.abi)

    // WARNING: v1 wallets CAN NOT use v2 configurations so we ALWAYS need to update
    // both the implementation and the configuration at the same time

    const updateBundle = v2.config.ConfigCoder.update.buildTransaction(address, newConfig, context, 'first')

    return {
      entrypoint: address,
      transactions: [
        {
          to: address,
          value: 0,
          gasLimit: 0,
          revertOnError: true,
          delegateCall: false,
          data: contract.encodeFunctionData(contract.getFunction('updateImplementation'), [
            context.mainModuleUpgradable
          ])
        },
        ...updateBundle.transactions
      ]
    }
  }

  decodeTransaction(
    tx: commons.transaction.TransactionBundle,
    contexts: VersionedContext
  ): {
    address: string,
    newConfig: v2.config.WalletConfig
  } {
    const address = tx.entrypoint

    if (tx.transactions.length < 2) {
      throw new Error('Invalid transaction bundle size')
    }

    if(
      tx.transactions[0].to !== address ||
      tx.transactions[1].to !== address ||
      tx.transactions[0].delegateCall ||
      tx.transactions[1].delegateCall ||
      !tx.transactions[0].revertOnError ||
      !tx.transactions[1].revertOnError ||
      (tx.transactions[0].value && !ethers.constants.Zero.eq(tx.transactions[0].value)) ||
      (tx.transactions[1].value && !ethers.constants.Zero.eq(tx.transactions[1].value)) ||
      (tx.transactions[0].gasLimit && !ethers.constants.Zero.eq(tx.transactions[0].gasLimit)) ||
      (tx.transactions[1].gasLimit && !ethers.constants.Zero.eq(tx.transactions[1].gasLimit))
    ) {
      throw new Error('Invalid transaction bundle format')
    }

    const context = contexts[2]
    const contract = new ethers.utils.Interface(walletContracts.mainModule.abi)

    const data1 = ethers.utils.hexlify(tx.transactions[0].data || [])
    const expectData1 = ethers.utils.hexlify(
      contract.encodeFunctionData(contract.getFunction('updateImplementation'), [
        context.mainModuleUpgradable
      ])
    )

    if (data1 !== expectData1) {
      throw new Error('Invalid new implementation on transaction')
    }

    const decoded2 = v2.config.ConfigCoder.update.decodeTransaction({ entrypoint: address, transactions: [tx.transactions[1]] })
    if (decoded2.address !== address) {
      throw new Error('Invalid transaction bundle address')
    }

    return {
      address,
      newConfig: decoded2.newConfig
    }
  }
}
