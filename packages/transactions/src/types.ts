import { BigNumberish, BytesLike, ethers } from 'ethers'
import { TransactionRequest as EthersTransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { DecodedSignature, WalletConfig } from '@0xsequence/config'
import { WalletContext } from '@0xsequence/network'

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

export type TransactionBundle = {
  intent: {
    digest: string,
    wallet: string
  },
  entrypoint: string,
  chainId: ethers.BigNumber,
  transactions: Transaction[],
}

export type SignedTransactionBundle = TransactionBundle & {
  signature: string,
  nonce: ethers.BigNumber,
}

export type { TransactionResponse }
