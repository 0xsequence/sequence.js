import { WalletConfig } from '@0xsequence/config'
import { WalletContext } from '@0xsequence/network'
import { Transaction } from '@0xsequence/transactions'

export interface Estimator {
  estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<{
    transactions: Transaction[]
    total: BigInt
  }>
}
