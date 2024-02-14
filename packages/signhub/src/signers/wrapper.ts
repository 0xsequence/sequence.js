import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { Status } from '../orchestrator'
import { SapientSigner } from './signer'

export class SignerWrapper implements SapientSigner {
  constructor(
    public signer: ethers.Signer,
    public eoa: boolean = true
  ) {}

  getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  async buildDeployTransaction(_metadata: object): Promise<commons.transaction.TransactionBundle | undefined> {
    // Wrapped signers don't require deployment
    return
  }

  async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
    return []
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    _metadata: object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    return bundle
  }

  sign(message: ethers.BytesLike): Promise<ethers.BytesLike> {
    return this.signer.signMessage(message)
  }

  notifyStatusChange(_i: string, _s: Status, _m: object): void {}

  suffix(): ethers.BytesLike {
    return new Uint8Array([2])
  }
}
