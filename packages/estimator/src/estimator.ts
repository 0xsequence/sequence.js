import { commons, v2 } from '@0xsequence/core'
import { BigIntish } from '@0xsequence/utils'

export interface Estimator {
  estimateGasLimits(
    address: string,
    config: v2.config.WalletConfig,
    context: commons.context.WalletContext,
    nonce: BigIntish,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{
    transactions: commons.transaction.Transaction[]
    total: bigint
  }>
}
