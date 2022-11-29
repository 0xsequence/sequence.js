import { BigNumberish, BytesLike, ethers } from "ethers"
import { TransactionRequest, TransactionResponse as EthersTransactionResponse } from '@ethersproject/providers'
import { subdigestOf } from "./signature"
import { Interface } from "ethers/lib/utils"
import { walletContracts } from "@0xsequence/abi"

export interface Transaction {
  to: string
  value?: BigNumberish
  data?: BytesLike
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

export type Transactionish = TransactionRequest | TransactionRequest[] | Transaction | Transaction[]

export interface TransactionResponse<R = any> extends EthersTransactionResponse {
  receipt?: R
}

export type TransactionBundle = {
  entrypoint: string,
  transactions: Transaction[],
}

export type IntendedTransactionBundle = TransactionBundle & {
  chainId: BigNumberish,
  intent: {
    digest: string,
    wallet: string
  }
}

export type SignedTransactionBundle = IntendedTransactionBundle & {
  signature: string,
  nonce: BigNumberish,
}

export type RelayReadyTransactionBundle = SignedTransactionBundle | IntendedTransactionBundle

export const MetaTransactionsType = `tuple(
  bool delegateCall,
  bool revertOnError,
  uint256 gasLimit,
  address target,
  uint256 value,
  bytes data
)[]`

export function packMetaTransactionsData(nonce: ethers.BigNumberish, txs: Transaction[]): string {
  return packMetaTransactionsNonceData(nonce, txs)
}

export function packMetaTransactionsNonceData(nonce: BigNumberish, txs: Transaction[]): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', MetaTransactionsType], [nonce, sequenceTxAbiEncode(txs)])
}

export function digestOfTransactions(nonce: BigNumberish, txs: Transaction[]) {
  return ethers.utils.keccak256(packMetaTransactionsNonceData(nonce, txs))
}

export function subidgestOfTransactions(address: string, chainid: BigNumberish, nonce: ethers.BigNumberish, txs: Transaction[]): string {
  return subdigestOf({ address, chainid, digest: digestOfTransactions(nonce, txs) })
}

export function toSequenceTransactions(
  wallet: string,
  txs: (Transaction | TransactionRequest)[]
): { nonce?: ethers.BigNumberish, transaction: Transaction }[] {
  return txs.map(tx => toSequenceTransaction(wallet, tx))
}

export function toSequenceTransaction(
  wallet: string,
  tx: TransactionRequest
): { nonce?: ethers.BigNumberish, transaction: Transaction } {
  if (tx.to) {
    return {
      nonce: tx.nonce,
      transaction: {
        delegateCall: false,
        revertOnError: false,
        gasLimit: tx.gasLimit || 0,
        to: tx.to,
        value: tx.value || 0,
        data: tx.data || '0x',
      }
    }
  } else {
    const walletInterface = new Interface(walletContracts.mainModule.abi)
    const data = walletInterface.encodeFunctionData(walletInterface.getFunction('createContract'), [tx.data])

    return {
      nonce: tx.nonce,
      transaction: {
        delegateCall: false,
        revertOnError: false,
        gasLimit: tx.gasLimit,
        to: wallet,
        value: tx.value || 0,
        data: data
      }
    }
  }
}

export function isSequenceTransaction(tx: any): tx is Transaction {
  return tx.delegateCall !== undefined || tx.revertOnError !== undefined
}

export function hasSequenceTransactions(txs: any[]): txs is Transaction[] {
  return txs.every(isSequenceTransaction)
}

// export function readSequenceNonce(...txs: Transaction[]): ethers.BigNumber | undefined {
//   const sample = txs.find(t => t.nonce !== undefined)
//   if (!sample) return undefined

//   const sampleNonce = ethers.BigNumber.from(sample.nonce)
//   if (txs.find(t => t.nonce !== undefined && !ethers.BigNumber.from(t.nonce).eq(sampleNonce))) {
//     throw new Error('Mixed nonces on Sequence transactions')
//   }

//   return sampleNonce
// }

// TODO: We may be able to remove this if we make Transaction === TransactionEncoded
export function sequenceTxAbiEncode(txs: Transaction[]): TransactionEncoded[] {
  return txs.map(t => ({
    delegateCall: t.delegateCall === true,
    revertOnError: t.revertOnError === true,
    gasLimit: t.gasLimit !== undefined ? t.gasLimit : ethers.constants.Zero,
    target: t.to ?? ethers.constants.AddressZero,
    value: t.value !== undefined ? t.value : ethers.constants.Zero,
    data: t.data !== undefined ? t.data : []
  }))
}

// export function appendNonce(txs: Transaction[], nonce: BigNumberish): Transaction[] {
//   return txs.map((t: Transaction) => ({ ...t, nonce }))
// }

export function encodeNonce(space: BigNumberish, nonce: BigNumberish): BigNumberish {
  const bspace = ethers.BigNumber.from(space)
  const bnonce = ethers.BigNumber.from(nonce)

  const shl = ethers.constants.Two.pow(ethers.BigNumber.from(96))

  if (!bnonce.div(shl).eq(ethers.constants.Zero)) {
    throw new Error('Space already encoded')
  }

  return bnonce.add(bspace.mul(shl))
}

export function decodeNonce(nonce: BigNumberish): [BigNumberish, BigNumberish] {
  const bnonce = ethers.BigNumber.from(nonce)
  const shr = ethers.constants.Two.pow(ethers.BigNumber.from(96))

  return [bnonce.div(shr), bnonce.mod(shr)]
}

export function fromTransactionish(
  wallet: string,
  transaction: Transactionish
): { transactions: Transaction[], nonce?: ethers.BigNumberish } {
  if (Array.isArray(transaction)) {
    if (hasSequenceTransactions(transaction)) {
      return { transactions: transaction }
    } else {
      const stx = toSequenceTransactions(wallet, transaction)

      // all nonces must be the same
      const nonce = stx.length > 0 ? stx[0].nonce : undefined
      if (stx.find(t => t.nonce !== nonce)) {
        throw new Error('Mixed nonces on Transaction requests')
      }

      return { transactions: stx.map(t => t.transaction), nonce }
    }
  } else if (isSequenceTransaction(transaction)) {
    return { transactions: [transaction] }
  } else {
    const stx = toSequenceTransaction(wallet, transaction).transaction
    return { transactions: [] }
  }
}

export function isTransactionBundle(cand: any): cand is TransactionBundle {
  return (
    cand !== undefined &&
    cand.entrypoint !== undefined &&
    cand.chainId !== undefined &&
    cand.transactions !== undefined &&
    cand.nonce !== undefined &&
    cand.intent !== undefined &&
    cand.intent.digest !== undefined &&
    cand.intent.wallet !== undefined &&
    Array.isArray(cand.transactions) &&
    (<TransactionBundle>cand).transactions.reduce((p, c) => p && isSequenceTransaction(c), true)
  )
}

export function isSignedTransactionBundle(cand: any): cand is SignedTransactionBundle {
  return (
    cand !== undefined &&
    cand.signature !== undefined &&
    cand.signature !== '' &&
    isTransactionBundle(cand)
  )
}

export function encodeBundleExecData(bundle: TransactionBundle): string {
  const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
  return walletInterface.encodeFunctionData(walletInterface.getFunction('execute'),
    isSignedTransactionBundle(bundle) ? [
      // Signed transaction bundle has all 3 parameters
      sequenceTxAbiEncode(bundle.transactions),
      bundle.nonce,
      bundle.signature
    ] : [
      // Unsigned bundle may be a GuestModule call, so signature and nonce are missing
      sequenceTxAbiEncode(bundle.transactions),
      0,
      []
    ]
  )
}
