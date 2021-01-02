import { BigNumberish, BytesLike } from 'ethers'
import { TransactionRequest as EthersTransactionRequest } from '@ethersproject/providers'
import { WalletConfig } from '@0xsequence/wallet'
import { WalletContext } from '@0xsequence/network'

// TODO: drop "Sequence" part..? maybe..
// ..

export interface SequenceTransaction {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: BigNumberish
  to: string
  value: BigNumberish
  data: BytesLike
  nonce?: BigNumberish
}

export interface SequenceTransactionEncoded {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: BigNumberish
  target: string
  value: BigNumberish
  data: BytesLike
}

export type AuxTransactionRequest = EthersTransactionRequest & {
  auxiliary?: Transactionish[]
  expiration?: BigNumberish
  afterNonce?: NonceDependency | BigNumberish
}

// TODO: use this instead..
// export interface TransactionRequest extends EthersTransactionRequest {
//   auxiliary?: Transactionish[]
//   expiration?: BigNumberish
//   afterNonce?: NonceDependency | BigNumberish
// }

export interface NonceDependency {
  address: string
  nonce: BigNumberish
  space?: BigNumberish
}

export declare type Transactionish = AuxTransactionRequest | SequenceTransaction | SequenceTransaction[] | AuxTransactionRequest[]

export type SignedTransactions = {
  chainId: BigNumberish,
  config: WalletConfig,
  context: WalletContext,
  signature: string,
  transactions: SequenceTransaction[]
}
