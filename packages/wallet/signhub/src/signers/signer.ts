import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { Status } from '../orchestrator'

export interface SapientSigner {
  getAddress(): Promise<string>

  buildDeployTransaction(metadata: object): Promise<commons.transaction.TransactionBundle | undefined>

  /**
   * Get signed transactions to be included in the next request.
   */
  predecorateSignedTransactions(metadata: object): Promise<commons.transaction.SignedTransactionBundle[]>

  /**
   * Modify the transaction bundle before it is sent.
   */
  decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata: object
  ): Promise<commons.transaction.IntendedTransactionBundle>

  /**
   * Request a signature from the signer.
   */
  sign(message: ethers.BytesLike, metadata: object): Promise<ethers.BytesLike>

  /**
   * Notify the signer of a status change.
   */
  notifyStatusChange(id: string, status: Status, metadata: object): void

  suffix(): ethers.BytesLike
}

export function isSapientSigner(signer: ethers.Signer | SapientSigner): signer is SapientSigner {
  return (
    (signer as SapientSigner).getAddress !== undefined &&
    (signer as SapientSigner).buildDeployTransaction !== undefined &&
    (signer as SapientSigner).predecorateSignedTransactions !== undefined &&
    (signer as SapientSigner).decorateTransactions !== undefined &&
    (signer as SapientSigner).sign !== undefined &&
    (signer as SapientSigner).notifyStatusChange !== undefined
  )
}
