import { WalletContext } from '@0xsequence/network'
import { ethers } from 'ethers'
import { commons, v2 } from '@0xsequence/core'

export interface Estimator {
  estimateGasLimits(
    address: string,
    config: v2.config.WalletConfig,
    context: WalletContext,
    nonce: ethers.BigNumberish,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{
    transactions: commons.transaction.Transaction[],
    total: ethers.BigNumber
  }>
}
