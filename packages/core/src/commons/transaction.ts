import { BigNumberish, BytesLike, ethers } from 'ethers'
import { subdigestOf } from './signature'
import { walletContracts } from '@0xsequence/abi'

export interface Transaction {
  to: string
  value?: BigNumberish
  data?: BytesLike
  gasLimit?: BigNumberish
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
  gasLimit: BigNumberish
  target: string
  value: BigNumberish
  data: BytesLike
}

export type Transactionish =
  | ethers.providers.TransactionRequest
  | ethers.providers.TransactionRequest[]
  | Transaction
  | Transaction[]

export interface TransactionResponse<R = any> extends ethers.providers.TransactionResponse {
  receipt?: R
}

export type TransactionBundle = {
  entrypoint: string
  transactions: Transaction[]
  nonce?: BigNumberish
}

export type IntendedTransactionBundle = TransactionBundle & {
  chainId: BigNumberish
  intent: {
    id: string
    wallet: string
  }
}

export type SignedTransactionBundle = IntendedTransactionBundle & {
  signature: string
  nonce: BigNumberish
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
  chainId: BigNumberish,
  id: string
): IntendedTransactionBundle {
  return {
    ...bundle,
    chainId,
    intent: { id: id, wallet }
  }
}

export function intendedTransactionID(bundle: IntendedTransactionBundle) {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'bytes32'],
      [bundle.intent.wallet, bundle.chainId, bundle.intent.id]
    )
  )
}

export function unpackMetaTransactionsData(data: BytesLike): [ethers.BigNumber, TransactionEncoded[]] {
  const res = ethers.utils.defaultAbiCoder.decode(['uint256', MetaTransactionsType], data)
  if (res.length !== 2 || !res[0] || !res[1]) throw new Error('Invalid meta transaction data')
  return [res[0], res[1]]
}

export function packMetaTransactionsData(nonce: ethers.BigNumberish, txs: Transaction[]): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', MetaTransactionsType], [nonce, sequenceTxAbiEncode(txs)])
}

export function digestOfTransactions(nonce: BigNumberish, txs: Transaction[]) {
  return ethers.utils.keccak256(packMetaTransactionsData(nonce, txs))
}

export function subdigestOfTransactions(
  address: string,
  chainId: BigNumberish,
  nonce: ethers.BigNumberish,
  txs: Transaction[]
): string {
  return subdigestOf({ address, chainId, digest: digestOfTransactions(nonce, txs) })
}

export function subdigestOfGuestModuleTransactions(guestModule: string, chainId: BigNumberish, txs: Transaction[]): string {
  return subdigestOf({
    address: guestModule,
    chainId,
    digest: ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['string', MetaTransactionsType], ['guest:', sequenceTxAbiEncode(txs)])
    )
  })
}

export function toSequenceTransactions(
  wallet: string,
  txs: (Transaction | ethers.providers.TransactionRequest)[]
): { nonce?: ethers.BigNumberish; transaction: Transaction }[] {
  return txs.map(tx => toSequenceTransaction(wallet, tx))
}

export function toSequenceTransaction(
  wallet: string,
  tx: ethers.providers.TransactionRequest
): { nonce?: ethers.BigNumberish; transaction: Transaction } {
  if (tx.to && tx.to !== ethers.constants.AddressZero) {
    return {
      nonce: tx.nonce,
      transaction: {
        delegateCall: false,
        revertOnError: false,
        gasLimit: tx.gasLimit || 0,
        to: tx.to,
        value: tx.value || 0,
        data: tx.data || '0x'
      }
    }
  } else {
    const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
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

export function fromTxAbiEncode(txs: TransactionEncoded[]): Transaction[] {
  return txs.map(t => ({
    delegateCall: t.delegateCall,
    revertOnError: t.revertOnError,
    gasLimit: t.gasLimit,
    to: t.target,
    value: t.value,
    data: t.data
  }))
}

// export function appendNonce(txs: Transaction[], nonce: BigNumberish): Transaction[] {
//   return txs.map((t: Transaction) => ({ ...t, nonce }))
// }

export function encodeNonce(space: BigNumberish, nonce: BigNumberish): ethers.BigNumber {
  const bspace = ethers.BigNumber.from(space)
  const bnonce = ethers.BigNumber.from(nonce)

  const shl = ethers.constants.Two.pow(ethers.BigNumber.from(96))

  if (!bnonce.div(shl).eq(ethers.constants.Zero)) {
    throw new Error('Space already encoded')
  }

  return bnonce.add(bspace.mul(shl))
}

export function decodeNonce(nonce: BigNumberish): [ethers.BigNumber, ethers.BigNumber] {
  const bnonce = ethers.BigNumber.from(nonce)
  const shr = ethers.constants.Two.pow(ethers.BigNumber.from(96))

  return [bnonce.div(shr), bnonce.mod(shr)]
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
  const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
  return walletInterface.encodeFunctionData(
    walletInterface.getFunction('execute'),
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
          []
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

  const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)

  for (const tx of transactions) {
    const txData = ethers.utils.arrayify(tx.data || '0x')

    if (tx.to === wallet && ethers.utils.hexlify(txData.slice(0, 4)) === selfExecuteSelector) {
      // Decode as selfExecute call
      const data = txData.slice(4)
      const decoded = ethers.utils.defaultAbiCoder.decode([selfExecuteAbi], data)[0]
      unwound.push(
        ...unwind(
          tx.to,
          decoded.map((d: TransactionEncoded) => ({ ...d, to: d.target }))
        )
      )
    } else {
      try {
        const innerTransactions = walletInterface.decodeFunctionData('execute', txData)[0]
        const unwoundTransactions = unwind(
          wallet,
          innerTransactions.map((tx: TransactionEncoded) => ({ ...tx, to: tx.target }))
        )
        unwound.push(...unwoundTransactions)
      } catch {
        unwound.push(tx)
      }
    }
  }

  return unwound
}
