import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { Transaction } from '@0xsequence/transactions'
import { OverwriterEstimator } from './overwriter-estimator'

export class OverwriterSequenceEstimator {
  constructor(public estimator: OverwriterEstimator) {}

  async estimateGasLimits(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<Transaction[]> {
    const wallet = addressOf(config, context)

    // This is the "base" gas for the transactions
    // it accounts for the overhead of the signature and calling sequence
    // this is required to retrieve an accurate estimation of each sub-call
    const baseGas = this.estimator.estimate({
      to: wallet,
      data: []
    })

    return []
  }
}
