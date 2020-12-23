import { ethers, Wallet as EOAWallet } from 'ethers'

export const sendETH = (eoaWallet: EOAWallet, toAddress: string, amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse> => {
  const tx = {
    gasPrice: '0x55555',
    gasLimit: '0x55555',
    to: toAddress,
    value: amount.toHexString(),
    data: '0x'
  }
  return eoaWallet.sendTransaction(tx)
}
