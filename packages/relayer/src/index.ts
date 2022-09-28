import { ethers, providers } from 'ethers'
import { SignedTransactions, Transaction, TransactionResponse } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig } from '@0xsequence/config'
import { proto } from './rpc-relayer'

export interface Relayer {
  // simulate returns the execution results for a list of transactions.
  simulate(wallet: string, ...transactions: Transaction[]): Promise<SimulateResult[]>

  // getFeeOptions returns the fee options that the relayer will accept as payment.
  // If a quote is returned, it may be passed back to the relayer for dispatch.
  getFeeOptions(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<{ options: FeeOption[], quote?: FeeQuote }>

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
  // The quote should be the one returned from getFeeOptions, if any.
  // waitForReceipt must default to true.
  relay(signedTxs: SignedTransactions, quote?: FeeQuote, waitForReceipt?: boolean): Promise<TransactionResponse>

  // wait for transaction confirmation
  // timeout is the maximum time to wait for the transaction response
  // delay is the polling interval, i.e. the time to wait between requests
  // maxFails is the maximum number of hard failures to tolerate before giving up
  wait(metaTxnId: string | SignedTransactions, timeout?: number, delay?: number, maxFails?: number): Promise<TransactionResponse>
}

export * from './local-relayer'
export * from './base-relayer'
export * from './provider-relayer'
export * from './rpc-relayer'
export { proto as RpcRelayerProto } from './rpc-relayer'
export type SimulateResult = proto.SimulateResult
export type FeeOption = proto.FeeOption

// A fee quote is simply an opaque value that can be obtained via Relayer.getFeeOptions(), and
// returned back to the same relayer via Relayer.relay(). Fee quotes should be treated as an
// implementation detail of the relayer that produces them.
//
// This interface exists for type-safety purposes to protect against passing non-FeeQuotes to
// Relayer.relay(), or any other functions that call it indirectly (e.g. Account.sendTransaction).
export interface FeeQuote {
  _tag: 'FeeQuote'
  _quote: unknown
}

export function isRelayer(cand: any): cand is Relayer {
  return (
    typeof cand === 'object' &&
    typeof cand.simulate === 'function' &&
    typeof cand.getFeeOptions === 'function' &&
    typeof cand.gasRefundOptions === 'function' &&
    typeof cand.getNonce === 'function' &&
    typeof cand.relay === 'function' &&
    typeof cand.wait === 'function'
  )
}
