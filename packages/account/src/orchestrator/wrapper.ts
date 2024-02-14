import { commons } from '@0xsequence/core'
import { signers, Status } from '@0xsequence/signhub'
import { ethers } from 'ethers'
import { Account } from '../account'

export type MetadataWithChainId = {
  chainId: ethers.BigNumberish
}

// Implements a wrapper for using Sequence accounts as nested signers in the signhub orchestrator.
export class AccountOrchestratorWrapper implements signers.SapientSigner {
  constructor(public account: Account) {}

  async getAddress(): Promise<string> {
    return this.account.address
  }

  getChainIdFromMetadata(metadata: object): bigint {
    try {
      const { chainId } = metadata as MetadataWithChainId
      return BigInt(chainId)
    } catch (err) {
      // Invalid metadata object
      throw new Error('AccountOrchestratorWrapper only supports metadata with chain id')
    }
  }

  async buildDeployTransaction(metadata: object): Promise<commons.transaction.TransactionBundle | undefined> {
    const chainId = this.getChainIdFromMetadata(metadata)
    const status = await this.account.status(chainId)
    return this.account.buildBootstrapTransactions(status, chainId)
  }

  async predecorateSignedTransactions(metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
    const chainId = this.getChainIdFromMetadata(metadata)
    const status = await this.account.status(chainId)
    return this.account.predecorateSignedTransactions(status, chainId)
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata: object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    const chainId = this.getChainIdFromMetadata(metadata)
    const status = await this.account.status(chainId)
    return this.account.decorateTransactions(bundle, status)
  }

  sign(message: ethers.BytesLike, metadata: object): Promise<ethers.BytesLike> {
    if (!commons.isWalletSignRequestMetadata(metadata)) {
      throw new Error('AccountOrchestratorWrapper only supports wallet metadata requests')
    }

    const { chainId, decorate } = metadata
    // EIP-6492 not supported on nested signatures
    // Default to throw instead of ignore. Ignoring should be explicit
    const cantValidateBehavior = metadata.cantValidateBehavior ?? 'throw'

    // For Sequence nested signatures we must use `signDigest` and not `signMessage`
    // otherwise the account will hash the digest and the signature will be invalid.
    return this.account.signDigest(message, chainId, decorate, cantValidateBehavior, metadata)
  }

  notifyStatusChange(_i: string, _s: Status, _m: object): void {}

  suffix(): ethers.BytesLike {
    return new Uint8Array([3])
  }
}
