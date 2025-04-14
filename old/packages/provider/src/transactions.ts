import { walletContracts } from '@0xsequence/abi'
import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'

const PROHIBITED_FUNCTIONS = new Map(
  [
    'addHook(bytes4,address)',
    'clearExtraImageHashes(bytes32[])',
    'removeHook(bytes4)',
    'setExtraImageHash(bytes32,uint256)',
    'updateIPFSRoot(bytes32)',
    'updateImageHash(bytes32)',
    'updateImageHashAndIPFS(bytes32,bytes32)',
    'updateImplementation(address)'
  ].map(signature => [ethers.id(signature).slice(0, 10), signature])
)

export function validateTransactionRequest(wallet: string, transaction: commons.transaction.Transactionish) {
  const transactions = commons.transaction.fromTransactionish(wallet, transaction)
  const unwound = commons.transaction.unwind(wallet, transactions)
  unwound.forEach(transaction => validateTransaction(wallet, transaction))
}

function validateTransaction(wallet: string, transaction: commons.transaction.Transaction) {
  if (transaction.to.toLowerCase() === wallet.toLowerCase()) {
    if (transaction.data) {
      const data = ethers.getBytes(transaction.data)
      if (data.length >= 4 && !isCreateContractCall(data)) {
        throw new Error('self calls are forbidden')
      }
    }
  }

  if (transaction.delegateCall) {
    throw new Error('delegate calls are forbidden')
  }

  if (transaction.data) {
    const data = ethers.hexlify(transaction.data)
    const selector = data.slice(0, 10)
    const signature = PROHIBITED_FUNCTIONS.get(selector)
    if (signature) {
      const name = signature.slice(0, signature.indexOf('('))
      throw new Error(`${name} calls are forbidden`)
    }
  }
}

function isCreateContractCall(data: ethers.BytesLike): boolean {
  const walletInterface = new ethers.Interface(walletContracts.mainModule.abi)
  try {
    walletInterface.decodeFunctionData('createContract', data)
    return true
  } catch {
    return false
  }
}
