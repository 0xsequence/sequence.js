import { commons } from '@0xsequence/core'
import { signers, Status } from '@0xsequence/signhub'
import { ethers } from 'ethers'
import { Wallet } from '../wallet'

// Implements a wrapper for using Sequence wallets as nested signers
// in the signhub orchestrator. It only works for nested signatures.
export class SequenceOrchestratorWrapper implements signers.SapientSigner {
  constructor(public wallet: Wallet<any, any, any>) {}

  async getAddress(): Promise<string> {
    return this.wallet.address
  }

  async buildDeployTransaction(metadata: object): Promise<commons.transaction.TransactionBundle | undefined> {
    return this.wallet.buildDeployTransaction(metadata as commons.WalletDeployMetadata | undefined)
  }

  async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
    // Wallets do not predecorate as they have no off chain knowledge
    return []
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    _metadata: object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    return this.wallet.decorateTransactions(bundle)
  }

  sign(message: ethers.BytesLike, metadata: object): Promise<ethers.BytesLike> {
    if (!commons.isWalletSignRequestMetadata(metadata)) {
      throw new Error('SequenceOrchestratorWrapper only supports nested Sequence signatures')
    }

    // For Sequence nested signatures we must use `signDigest` and not `signMessage`
    // otherwise the wallet will hash the digest and the signature will be invalid.
    return this.wallet.signDigest(message, { nested: metadata })
  }

  notifyStatusChange(_i: string, _s: Status, _m: object): void {}

  suffix(): ethers.BytesLike {
    return new Uint8Array([3])
  }
}
