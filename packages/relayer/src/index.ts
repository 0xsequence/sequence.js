import { ethers } from 'ethers'
import { proto } from './rpc-relayer'

import { commons } from '@0xsequence/core'

export interface Relayer {
  // simulate returns the execution results for a list of transactions.
  simulate(wallet: string, ...transactions: commons.transaction.Transaction[]): Promise<SimulateResult[]>

  // getFeeOptions returns the fee options that the relayer will accept as payment.
  // If a quote is returned, it may be passed back to the relayer for dispatch.
  getFeeOptions(
    address: string,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  // getFeeOptionsRaw returns the fee options that the relayer will accept as payment.
  // If a quote is returned, it may be passed back to the relayer for dispatch.
  // It doesn't make any assumptions about the transaction format.
  getFeeOptionsRaw(
    entrypoint: string,
    data: ethers.BytesLike,
    options?: {
      simulate?: boolean
    }
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  // gasRefundOptions returns the transactions which can be included to refund a
  // relayer for submitting your transaction to a network.
  gasRefundOptions(address: string, ...transactions: commons.transaction.Transaction[]): Promise<FeeOption[]>

  // Gas tank sponsorship management
  listGasSponsors(args: proto.ListGasSponsorsArgs): Promise<proto.ListGasSponsorsReturn>
  addGasSponsor(args: proto.AddGasSponsorArgs): Promise<proto.AddGasSponsorReturn>
  updateGasSponsor(args: proto.UpdateGasSponsorArgs): Promise<proto.UpdateGasSponsorReturn>
  removeGasSponsor(args: proto.RemoveGasSponsorArgs): Promise<proto.RemoveGasSponsorReturn>

  // getNonce returns the transaction count/nonce for a wallet, encoded with nonce space.
  // If space is undefined, the relayer can choose a nonce space to encode the result with.
  // Otherwise, the relayer must return a nonce encoded for the given nonce space.
  getNonce(address: string, space?: ethers.BigNumberish, blockTag?: ethers.BlockTag): Promise<ethers.BigNumberish>

  // relayer will submit the transaction(s) to the network and return the transaction response.
  // The quote should be the one returned from getFeeOptions, if any.
  // waitForReceipt must default to true.
  relay(
    signedTxs: commons.transaction.IntendedTransactionBundle,
    quote?: FeeQuote,
    waitForReceipt?: boolean,
    projectAccessKey?: string
  ): Promise<commons.transaction.TransactionResponse>

  // wait for transaction confirmation
  // timeout is the maximum time to wait for the transaction response
  // delay is the polling interval, i.e. the time to wait between requests
  // maxFails is the maximum number of hard failures to tolerate before giving up
  wait(
    metaTxnId: string | commons.transaction.SignedTransactionBundle,
    timeout?: number,
    delay?: number,
    maxFails?: number
  ): Promise<commons.transaction.TransactionResponse>

  // getMetaTransactions returns a list of meta transactions for a given project and gas tank
  getMetaTransactions(
    projectId: number,
    page?: proto.Page
  ): Promise<{
    page: proto.Page
    transactions: proto.MetaTxnLog[]
  }>

  // getTransactionCost returns the used fee cost for gas tank during a given period
  getTransactionCost(
    projectId: number,
    from: string,
    to: string
  ): Promise<{
    cost: number
  }>
}

export * from './local-relayer'
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
