import { ethers } from 'ethers'

export type ExtendedTransactionRequest = ethers.TransactionRequest & {
  auxiliary?: ethers.TransactionRequest[]
}

export function toExtended(transactions: ethers.TransactionRequest[]): ExtendedTransactionRequest {
  if (transactions.length === 0) {
    throw new Error('No transaction provided')
  }

  const [first, ...rest] = transactions

  return {
    ...first,
    auxiliary: rest
  }
}

export function fromExtended(transaction: ExtendedTransactionRequest): ethers.TransactionRequest[] {
  return [transaction, ...(transaction.auxiliary || [])]
}

export function isExtended(transaction: ethers.TransactionRequest): transaction is ExtendedTransactionRequest {
  return (transaction as any).auxiliary !== undefined
}
