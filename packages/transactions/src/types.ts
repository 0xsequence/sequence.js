import { BigNumberish, BytesLike, providers } from 'ethers'
import { DecodedSignature, WalletConfig } from '@0xsequence/config'
import { WalletContext } from '@0xsequence/network'

type EthersTransactionRequest = providers.TransactionRequest
type EthersTransactionResponse = providers.TransactionResponse

// Transaction is a Sequence transaction payload. Note, we do not include gasPrice as an option in this form,
// as we expect the gasPrice to be optimally estimated by the transaction relayer.
export interface Transaction {
  to: string
  value?: BigNumberish
  data?: BytesLike
  nonce?: BigNumberish
  gasLimit?: BigNumberish
  delegateCall?: boolean
  revertOnError?: boolean
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

export type Transactionish = TransactionRequest | TransactionRequest[] | Transaction | Transaction[]

export type SignedTransactions = {
  digest: string,
  chainId: BigNumberish,
  config: WalletConfig,
  context: WalletContext,
  transactions: Transaction[],
  nonce: BigNumberish,
  signature: string | DecodedSignature | Promise<string> | Promise<DecodedSignature>
}

export interface TransactionResponse<R = any> extends EthersTransactionResponse {
  receipt?: R
}
