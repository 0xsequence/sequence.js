import { BigNumberish, BytesLike, ethers } from "ethers"
import { TransactionRequest as EthersTransactionRequest, TransactionResponse as EthersTransactionResponse } from '@ethersproject/providers'
import { subdigestOf } from "./signature"
import { Interface } from "ethers/lib/utils"
import { walletContracts } from "@0xsequence/abi"

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


export const MetaTransactionsType = `tuple(
  bool delegateCall,
  bool revertOnError,
  uint256 gasLimit,
  address target,
  uint256 value,
  bytes data
)[]`

export function packMetaTransactionsData(...txs: Transaction[]): string {
  const nonce = readSequenceNonce(...txs)
  if (nonce === undefined) throw new Error('Encoding transactions without defined nonce')
  return packMetaTransactionsNonceData(nonce, ...txs)
}

export function packMetaTransactionsNonceData(nonce: BigNumberish, ...txs: Transaction[]): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', MetaTransactionsType], [nonce, sequenceTxAbiEncode(txs)])
}

export function digestOfTransactions(...txs: Transaction[]): string {
  const nonce = readSequenceNonce(...txs)
  if (nonce === undefined) throw new Error('Computing hash for transactions without defined nonce')
  return digestOfTransactionsWithNonce(nonce, ...txs)
}

export function digestOfTransactionsWithNonce(nonce: BigNumberish, ...txs: Transaction[]) {
  return ethers.utils.keccak256(packMetaTransactionsNonceData(nonce, ...txs))
}

export function subidgestOfTransactions(address: string, chainid: BigNumberish, ...txs: Transaction[]): string {
  return subdigestOf({ address, chainid, digest: digestOfTransactions(...txs) })
}

export function toSequenceTransactions(
  wallet: string,
  txs: (Transaction | TransactionRequest)[],
  revertOnError: boolean = false
): Transaction[] {
  // Bundles all transactions, including the auxiliary ones
  const allTxs = flattenAuxTransactions(txs)

  // NOTICE: This function used to manipulate the nonces of the txs
  // it used to search for the lowest nonce among all txs, and then it applied
  // that nonce for the whole batch.

  // Maps all transactions into SequenceTransactions
  return allTxs.map(tx => toSequenceTransaction(wallet, tx, revertOnError))
}

export function flattenAuxTransactions(txs: Transactionish | Transactionish[]): (TransactionRequest | Transaction)[] {
  if (!Array.isArray(txs)) {
    if ('auxiliary' in txs) {
      const aux = txs.auxiliary

      if (aux) {
        const tx = { ...txs }
        delete tx.auxiliary
        return [tx, ...flattenAuxTransactions(aux)]
      }
    }

    return [txs]
  }

  return txs.flatMap(flattenAuxTransactions)
}

export function toSequenceTransaction(
  wallet: string,
  tx: EthersTransactionRequest | Transaction,
  revertOnError: boolean = false
): Transaction {
  if (isSequenceTransaction(tx)) {
    return tx as Transaction
  }

  if (tx.to) {
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: tx.gasLimit || 0,
      to: tx.to,
      value: tx.value || 0,
      data: tx.data || '0x',
      nonce: tx.nonce
    }
  } else {
    const walletInterface = new Interface(walletContracts.mainModule.abi)
    const data = walletInterface.encodeFunctionData(walletInterface.getFunction('createContract'), [tx.data])

    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: tx.gasLimit,
      to: wallet,
      value: tx.value || 0,
      data: data,
      nonce: tx.nonce
    }
  }
}

export function isSequenceTransaction(tx: any): tx is Transaction {
  return tx.delegateCall !== undefined || tx.revertOnError !== undefined
}

export function hasSequenceTransactions(txs: any[]): txs is Transaction[] {
  return txs.every(isSequenceTransaction)
}

export function readSequenceNonce(...txs: Transaction[]): ethers.BigNumber | undefined {
  const sample = txs.find(t => t.nonce !== undefined)
  if (!sample) return undefined

  const sampleNonce = ethers.BigNumber.from(sample.nonce)
  if (txs.find(t => t.nonce !== undefined && !ethers.BigNumber.from(t.nonce).eq(sampleNonce))) {
    throw new Error('Mixed nonces on Sequence transactions')
  }

  return sampleNonce
}

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

export function appendNonce(txs: Transaction[], nonce: BigNumberish): Transaction[] {
  return txs.map((t: Transaction) => ({ ...t, nonce }))
}

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
): Transaction[] {
  let stx: Transaction[] = []

  if (Array.isArray(transaction)) {
    if (hasSequenceTransactions(transaction)) {
      stx = flattenAuxTransactions(transaction) as Transaction[]
    } else {
      stx = toSequenceTransactions(wallet, transaction)
    }
  } else if (isSequenceTransaction(transaction)) {
    stx = flattenAuxTransactions([transaction]) as Transaction[]
  } else {
    stx = toSequenceTransactions(wallet, [transaction])
  }

  return stx
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
