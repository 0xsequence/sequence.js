import { ethers } from 'ethers'

import { subdigestOf } from './signature'
import { walletContracts } from '@0xsequence/abi'

export interface Transaction {
  to: string
  value?: ethers.BigNumberish
  data?: string
  gasLimit?: ethers.BigNumberish
  delegateCall?: boolean
  revertOnError?: boolean
}

export interface SimulatedTransaction extends Transaction {
  succeeded: boolean
  executed: boolean
  gasUsed: number
  gasLimit: number
  result?: string
  reason?: string
}

export interface TransactionEncoded {
  delegateCall: boolean
  revertOnError: boolean
  gasLimit: ethers.BigNumberish
  target: string
  value: ethers.BigNumberish
  data: string
}

export type Transactionish = ethers.TransactionRequest | ethers.TransactionRequest[] | Transaction | Transaction[]

export interface TransactionResponse<R = any> extends ethers.TransactionResponse {
  receipt?: R
}

export type TransactionBundle = {
  entrypoint: string
  transactions: Transaction[]
  nonce?: ethers.BigNumberish
}

export type IntendedTransactionBundle = TransactionBundle & {
  chainId: ethers.BigNumberish
  intent: {
    id: string
    wallet: string
  }
}

export type SignedTransactionBundle = IntendedTransactionBundle & {
  signature: string
  nonce: ethers.BigNumberish
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

export function intendTransactionBundle(
  bundle: TransactionBundle,
  wallet: string,
  chainId: ethers.BigNumberish,
  id: string
): IntendedTransactionBundle {
  return {
    ...bundle,
    chainId,
    intent: { id: id, wallet }
  }
}

export function intendedTransactionID(bundle: IntendedTransactionBundle) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes32'],
      [bundle.intent.wallet, bundle.chainId, bundle.intent.id]
    )
  )
}

export function unpackMetaTransactionsData(data: ethers.BytesLike): [bigint, TransactionEncoded[]] {
  const res = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', MetaTransactionsType], data)
  if (res.length !== 2 || !res[0] || !res[1]) throw new Error('Invalid meta transaction data')
  return [res[0], res[1]]
}

export function packMetaTransactionsData(nonce: ethers.BigNumberish, txs: Transaction[]): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(['uint256', MetaTransactionsType], [nonce, sequenceTxAbiEncode(txs)])
}

export function digestOfTransactions(nonce: ethers.BigNumberish, txs: Transaction[]) {
  return ethers.keccak256(packMetaTransactionsData(nonce, txs))
}

export function subdigestOfTransactions(
  address: string,
  chainId: ethers.BigNumberish,
  nonce: ethers.BigNumberish,
  txs: Transaction[]
): string {
  return subdigestOf({ address, chainId, digest: digestOfTransactions(nonce, txs) })
}

export function subdigestOfGuestModuleTransactions(
  guestModule: string,
  chainId: ethers.BigNumberish,
  txs: Transaction[]
): string {
  return subdigestOf({
    address: guestModule,
    chainId,
    digest: ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['string', MetaTransactionsType], ['guest:', sequenceTxAbiEncode(txs)])
    )
  })
}

export function toSequenceTransactions(
  wallet: string,
  txs: ethers.TransactionRequest[]
): { nonce?: ethers.BigNumberish; transaction: Transaction }[] {
  return txs.map(tx => toSequenceTransaction(wallet, tx))
}

export function toSequenceTransaction(
  wallet: string,
  tx: ethers.TransactionRequest
): { nonce?: ethers.BigNumberish; transaction: Transaction } {
  if (tx.to && tx.to !== ethers.ZeroAddress) {
    return {
      nonce: !isNullish(tx.nonce) ? BigInt(tx.nonce) : undefined,
      transaction: {
        delegateCall: false,
        revertOnError: false,
        gasLimit: !isNullish(tx.gasLimit) ? BigInt(tx.gasLimit) : undefined,
        // XXX: `tx.to` could also be ethers Addressable type which returns a getAddress promise
        // Keeping this as is for now so we don't have to change everything to async
        to: tx.to as string,
        value: BigInt(tx.value || 0),
        data: tx.data || '0x'
      }
    }
  } else {
    const walletInterface = new ethers.Interface(walletContracts.mainModule.abi)
    const data = walletInterface.encodeFunctionData(walletInterface.getFunction('createContract')!, [tx.data])

    return {
      nonce: typeof tx.nonce === 'number' ? BigInt(tx.nonce) : undefined,
      transaction: {
        delegateCall: false,
        revertOnError: false,
        gasLimit: !isNullish(tx.gasLimit) ? BigInt(tx.gasLimit) : undefined,
        to: wallet,
        value: BigInt(tx.value || 0),
        data
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

// TODO: We may be able to remove this if we make Transaction === TransactionEncoded
export function sequenceTxAbiEncode(txs: Transaction[]): TransactionEncoded[] {
  return txs.map(tx => ({
    delegateCall: tx.delegateCall === true,
    revertOnError: tx.revertOnError === true,
    gasLimit: !isNullish(tx.gasLimit) ? BigInt(tx.gasLimit) : 0n,
    target: tx.to ?? ethers.ZeroAddress,
    value: !isNullish(tx.value) ? tx.value : 0n,
    data: tx.data || '0x'
  }))
}

export function fromTxAbiEncode(txs: TransactionEncoded[]): Transaction[] {
  return txs.map(tx => ({
    delegateCall: tx.delegateCall,
    revertOnError: tx.revertOnError,
    gasLimit: tx.gasLimit,
    to: tx.target,
    value: tx.value,
    data: tx.data
  }))
}

// export function appendNonce(txs: Transaction[], nonce: ethers.BigNumberish): Transaction[] {
//   return txs.map((t: Transaction) => ({ ...t, nonce }))
// }

export function encodeNonce(space: ethers.BigNumberish, nonce: ethers.BigNumberish): bigint {
  const bspace = BigInt(space)
  const bnonce = BigInt(nonce)

  const shl = 2n ** 96n

  if (bnonce / shl !== 0n) {
    throw new Error('Space already encoded')
  }

  return bnonce + bspace * shl
}

export function decodeNonce(nonce: ethers.BigNumberish): [bigint, bigint] {
  const bnonce = BigInt(nonce)
  const shr = 2n ** 96n

  return [bnonce / shr, bnonce % shr]
}

export function fromTransactionish(wallet: string, transaction: Transactionish): Transaction[] {
  if (Array.isArray(transaction)) {
    if (hasSequenceTransactions(transaction)) {
      return transaction
    } else {
      const stx = toSequenceTransactions(wallet, transaction)
      return stx.map(t => t.transaction)
    }
  } else if (isSequenceTransaction(transaction)) {
    return [transaction]
  } else {
    return [toSequenceTransaction(wallet, transaction).transaction]
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
    cand.intent.id !== undefined &&
    cand.intent.wallet !== undefined &&
    Array.isArray(cand.transactions) &&
    (<TransactionBundle>cand).transactions.reduce((p, c) => p && isSequenceTransaction(c), true)
  )
}

export function isSignedTransactionBundle(cand: any): cand is SignedTransactionBundle {
  return cand !== undefined && cand.signature !== undefined && cand.signature !== '' && isTransactionBundle(cand)
}

export function encodeBundleExecData(bundle: TransactionBundle): string {
  const walletInterface = new ethers.Interface(walletContracts.mainModule.abi)
  return walletInterface.encodeFunctionData(
    walletInterface.getFunction('execute')!,
    isSignedTransactionBundle(bundle)
      ? [
          // Signed transaction bundle has all 3 parameters
          sequenceTxAbiEncode(bundle.transactions),
          bundle.nonce,
          bundle.signature
        ]
      : [
          // Unsigned bundle may be a GuestModule call, so signature and nonce are missing
          sequenceTxAbiEncode(bundle.transactions),
          0,
          new Uint8Array([])
        ]
  )
}

// TODO: Use Sequence ABI package
export const selfExecuteSelector = '0x61c2926c'
export const selfExecuteAbi = `tuple(
  bool delegateCall,
  bool revertOnError,
  uint256 gasLimit,
  address target,
  uint256 value,
  bytes data
)[]`

// Splits Sequence batch transactions into individual parts
export const unwind = (wallet: string, transactions: Transaction[]): Transaction[] => {
  const unwound: Transaction[] = []

  const walletInterface = new ethers.Interface(walletContracts.mainModule.abi)

  for (const tx of transactions) {
    const txData = ethers.getBytes(tx.data || '0x')

    if (tx.to === wallet && ethers.hexlify(txData.slice(0, 4)) === selfExecuteSelector) {
      // Decode as selfExecute call
      const data = txData.slice(4)
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode([selfExecuteAbi], data)[0]
      unwound.push(
        ...unwind(
          tx.to,
          decoded.map((d: TransactionEncoded) => ({ ...d, to: d.target }))
        )
      )
    } else {
      try {
        const innerTransactions = walletInterface.decodeFunctionData('execute', txData)[0] as ethers.Result
        const unwoundTransactions = unwind(
          wallet,
          innerTransactions.map((tx: ethers.Result) => ({ ...tx.toObject(), to: tx.target }))
        )
        unwound.push(...unwoundTransactions)
      } catch {
        unwound.push(tx)
      }
    }
  }

  return unwound
}

const isNullish = <T>(value: T | null | undefined): value is null | undefined => value === null || value === void 0
