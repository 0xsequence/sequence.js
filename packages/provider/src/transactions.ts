import { walletContracts } from '@0xsequence/abi'
import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'

export function validateTransactionRequest(wallet: string, transaction: commons.transaction.Transactionish) {
  const transactions = commons.transaction.fromTransactionish(wallet, transaction)
  const unwound = commons.transaction.unwind(wallet, transactions)
  unwound.forEach(transaction => validateTransaction(wallet, transaction))
}

function validateTransaction(wallet: string, transaction: commons.transaction.Transaction) {
  if (transaction.to.toLowerCase() === wallet.toLowerCase()) {
    if (transaction.data) {
      const data = ethers.utils.arrayify(transaction.data)
      if (data.length >= 4 && !isCreateContractCall(data)) {
        throw new Error('self calls are forbidden')
      }
    }
  }

  if (transaction.delegateCall) {
    throw new Error('delegate calls are forbidden')
  }
}

function isCreateContractCall(data: ethers.BytesLike): boolean {
  const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
  try {
    walletInterface.decodeFunctionData('createContract', data)
    return true
  } catch {
    return false
  }
}
