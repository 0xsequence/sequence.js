import { providers } from 'ethers'
import { SignedTransactions, Transaction, TransactionEncoded } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/config'

export interface Relayer {

  // estimateGasLimits will estimate the gas utilization from the transaction
  // before submission.
  estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<Transaction[]>

  // gasRefundOptions returns the transactions which can be included to refund a
  // relayer for submitting your transaction to a network.
  gasRefundOptions(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<TransactionEncoded[][]>

  // getNonce returns the transaction count/nonce for a wallet.
  getNonce(config: WalletConfig, context: WalletContext, space?: number, blockTag?: providers.BlockTag): Promise<number>

  // relayer will submit the transaction(s) to the network and return the transaction response.
  relay(signedTxs: SignedTransactions): Promise<providers.TransactionResponse>

}

export { LocalRelayer } from './local-relayer'
export { RpcRelayer } from './rpc-relayer'

export function isRelayer(cand: any): cand is Relayer {
  return cand && cand.estimateGasLimits !== undefined && cand.gasRefundOptions !== undefined &&
    cand.getNonce !== undefined && cand.relay !== undefined
}
