import { ethers, providers } from 'ethers'
import { SignedTransactions, Transaction } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/config'
import { proto } from './rpc-relayer'

export interface Relayer {
  // simulate returns the execution results for a list of transactions.
  simulate(wallet: string, ...transactions: Transaction[]): Promise<SimulateResult[]>

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
  ): Promise<FeeOption[]>

  // getNonce returns the transaction count/nonce for a wallet, encoded with nonce space.
  // If space is undefined, the relayer can choose a nonce space to encode the result with.
  // Otherwise, the relayer must return a nonce encoded for the given nonce space.
  getNonce(config: WalletConfig, context: WalletContext, space?: ethers.BigNumberish, blockTag?: providers.BlockTag): Promise<ethers.BigNumberish>

  // relayer will submit the transaction(s) to the network and return the transaction response.
  relay(signedTxs: SignedTransactions): Promise<providers.TransactionResponse>

  // wait for transaction confirmation
  wait(metaTxnId: string | SignedTransactions, timeout: number): Promise<providers.TransactionResponse>
}

export * from './local-relayer'
export * from './base-relayer'
export * from './provider-relayer'
export * from './rpc-relayer'
export { proto as RpcRelayerProto } from './rpc-relayer'
export type SimulateResult = proto.SimulateResult
export type FeeOption = proto.FeeOption

export function isRelayer(cand: any): cand is Relayer {
  return cand && cand.estimateGasLimits !== undefined && cand.gasRefundOptions !== undefined &&
    cand.getNonce !== undefined && cand.relay !== undefined
}
