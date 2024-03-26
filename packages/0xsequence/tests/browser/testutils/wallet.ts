import { ethers } from 'ethers'
import { toHexString } from '@0xsequence/utils'

export const sendETH = (eoaWallet: ethers.Wallet, toAddress: string, amount: bigint): Promise<ethers.TransactionResponse> => {
  const tx = {
    gasPrice: '0x55555',
    gasLimit: '0x55555',
    to: toAddress,
    value: toHexString(amount),
    data: '0x'
  }
  return eoaWallet.sendTransaction(tx)
}
