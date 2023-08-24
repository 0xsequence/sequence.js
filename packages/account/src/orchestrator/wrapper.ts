import { commons } from '@0xsequence/core'
import { signers, Status } from '@0xsequence/signhub'
import { Wallet } from '@0xsequence/wallet'
import { ethers } from 'ethers'
import { Account } from '../account'

export type AccountWrapperDecorateMetadata = {
  chainId?: ethers.BigNumberish
}

// Implements a wrapper for using Sequence accounts as nested signers
// in the signhub orchestrator. It only works for nested signatures.
export class AccountOrchestratorWrapper implements signers.SapientSigner {
  constructor(public account: Account) {}

  async getAddress(): Promise<string> {
    return this.account.address
  }

  getChainIdFromMetadata(metadata: Object): ethers.BigNumberish {
    let { chainId } = metadata as AccountWrapperDecorateMetadata
    try {
      chainId = ethers.BigNumber.from(chainId)
    } catch (err) {
      // Invalid metadata object
      throw new Error('AccountOrchestratorWrapper only supports account status callbacks')
    }
    return chainId
  }

  async buildDeployTransaction(metadata: Object): Promise<commons.transaction.TransactionBundle | undefined> {
    const chainId = this.getChainIdFromMetadata(metadata)
    const status = await this.account.status(chainId)
    return this.account.buildBootstrapTransactions(status, chainId)
  }

  async predecorateTransactions(
    txs: commons.transaction.Transactionish,
    metadata: Object
  ): Promise<commons.transaction.Transactionish> {
    const chainId = this.getChainIdFromMetadata(metadata)
    const status = await this.account.status(chainId)
    return this.account.predecorateTransactions(txs, status, chainId)
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata: Object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    const chainId = this.getChainIdFromMetadata(metadata)
    const status = await this.account.status(chainId)
    return this.account.decorateTransactions(bundle, status)
  }

  async requestSignature(
    _id: string,
    message: ethers.utils.BytesLike,
    metadata: Object,
    callbacks: {
      onSignature: (signature: ethers.utils.BytesLike) => void
      onRejection: (error: string) => void
      onStatus: (situation: string) => void
    }
  ): Promise<boolean> {
    console.log('Signing digest for account orchestrator')
    if (!commons.isAccountSignRequestMetadata(metadata)) {
      throw new Error('AccountOrchestratorWrapper only supports account metadata requests')
    }

    const { chainId, decorate } = metadata
    // EIP-6492 not supported on nested signatures
    // Default to throw instead of ignore. Ignoring should be explicit
    const cantValidateBehavior = metadata.cantValidateBehavior ?? 'throw'

    // For Sequence nested signatures we must use `signDigest` and not `signMessage`
    // otherwise the account will hash the digest and the signature will be invalid.
    try {
      callbacks.onSignature(await this.account.signDigest(message, chainId, decorate, cantValidateBehavior))
    } catch (err) {
      callbacks.onRejection('Unable to sign account')
      return false
    }

    return true
  }

  notifyStatusChange(_i: string, _s: Status, _m: Object): void {}

  suffix(): ethers.utils.BytesLike {
    return [3]
  }
}
