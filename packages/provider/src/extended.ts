import { ethers } from 'ethers'

export type ExtendedTransactionRequest = ethers.providers.TransactionRequest & {
  auxiliary?: ethers.providers.TransactionRequest[]
}

export function toExtended(transactions: ethers.providers.TransactionRequest[]): ExtendedTransactionRequest {
  if (transactions.length === 0) {
    throw new Error('No transaction provided')
  }

  const [first, ...rest] = transactions

  return {
    ...first,
    auxiliary: rest
  }
}

export function fromExtended(transaction: ExtendedTransactionRequest): ethers.providers.TransactionRequest[] {
  return [transaction, ...(transaction.auxiliary || [])]
}

export function isExtended(transaction: ethers.providers.TransactionRequest): transaction is ExtendedTransactionRequest {
  return (transaction as any).auxiliary !== undefined
}
