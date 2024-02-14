import { ethers, Wallet as EOAWallet } from 'ethers'
import { toHexString } from '@0xsequence/utils'

export const sendETH = (eoaWallet: EOAWallet, toAddress: string, amount: bigint): Promise<ethers.TransactionResponse> => {
  const tx = {
    gasPrice: '0x55555',
    gasLimit: '0x55555',
    to: toAddress,
    value: toHexString(amount),
    data: '0x'
  }
  return eoaWallet.sendTransaction(tx)
}
