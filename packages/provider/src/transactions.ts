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
      if (data.length >= 4) {
        const selector = ethers.utils.hexlify(data.slice(0, 4))
        switch (selector) {
          case '0x7a9a1628': // execute((bool,bool,uint256,address,uint256,bytes)[],uint256,bytes)
          case '0x61c2926c': // selfExecute((bool,bool,uint256,address,uint256,bytes)[])
            break
          default:
            throw new Error('self calls other than execute and selfExecute are forbidden')
        }
      }
    }
  }

  if (transaction.delegateCall) {
    throw new Error('delegate calls are forbidden')
  }
}
