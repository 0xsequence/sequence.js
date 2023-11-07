import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { Status } from '../orchestrator'

export interface SapientSigner {
  getAddress(): Promise<string>

  buildDeployTransaction(metadata: Object): Promise<commons.transaction.TransactionBundle | undefined>

  /**
   * Get signed transactions to be included in the next request.
   */
  predecorateSignedTransactions(metadata: Object): Promise<commons.transaction.SignedTransactionBundle[]>

  /**
   * Modify the transaction bundle before it is sent.
   */
  decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata: Object
  ): Promise<commons.transaction.IntendedTransactionBundle>

  /**
   * Request a signature from the signer.
   */
  requestSignature(
    id: string,
    message: ethers.BytesLike,
    metadata: Object,
    callbacks: {
      onSignature: (signature: ethers.BytesLike) => void
      onRejection: (error: string) => void
      onStatus: (situation: string) => void
    }
  ): Promise<boolean>

  /**
   * Notify the signer of a status change.
   */
  notifyStatusChange(id: string, status: Status, metadata: Object): void

  suffix(): ethers.BytesLike
}

export function isSapientSigner(signer: ethers.Signer | SapientSigner): signer is SapientSigner {
  return (
    (signer as SapientSigner).getAddress !== undefined &&
    (signer as SapientSigner).buildDeployTransaction !== undefined &&
    (signer as SapientSigner).predecorateSignedTransactions !== undefined &&
    (signer as SapientSigner).decorateTransactions !== undefined &&
    (signer as SapientSigner).requestSignature !== undefined &&
    (signer as SapientSigner).notifyStatusChange !== undefined
  )
}
