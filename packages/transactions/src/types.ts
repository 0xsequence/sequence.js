import { BigNumberish, BytesLike } from 'ethers'
import { TransactionRequest as EthersTransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { WalletConfig } from '@0xsequence/wallet'
import { WalletContext } from '@0xsequence/network'

export interface Transaction {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: BigNumberish
  to: string
  value: BigNumberish
  data: BytesLike
  nonce?: BigNumberish
}

export interface TransactionEncoded {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: BigNumberish
  target: string
  value: BigNumberish
  data: BytesLike
}

export interface TransactionRequest extends EthersTransactionRequest {
  auxiliary?: Transactionish[]
  expiration?: BigNumberish
  afterNonce?: NonceDependency | BigNumberish
}

export interface NonceDependency {
  address: string
  nonce: BigNumberish
  space?: BigNumberish
}

export declare type Transactionish = TransactionRequest | Transaction | Transaction[] | TransactionRequest[]

export type SignedTransactions = {
  chainId: BigNumberish,
  config: WalletConfig,
  context: WalletContext,
  signature: string,
  transactions: Transaction[]
}

export type { TransactionResponse }
