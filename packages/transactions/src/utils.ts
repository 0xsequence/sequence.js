import { ethers, Signer, BigNumberish } from 'ethers'
import { Interface } from 'ethers/lib/utils' // TODO: other pkg..?
import { TransactionRequest } from '@ethersproject/providers'
import { walletContracts } from '@0xsequence/abi'
import { WalletContext } from '@0xsequence/network'
import { SequenceTransaction, AuxTransactionRequest, Transactionish, SequenceTransactionEncoded, NonceDependency, SignedTransactions } from './types'

export const MetaTransactionsType = `tuple(
  bool delegateCall,
  bool revertOnError,
  uint256 gasLimit,
  address target,
  uint256 value,
  bytes data
)[]`

export function encodeMetaTransactionsData(...txs: SequenceTransaction[]): string {
  const nonce = readSequenceNonce(...txs)
  return ethers.utils.defaultAbiCoder.encode(['uint256', MetaTransactionsType], [nonce, sequenceTxAbiEncode(txs)])
}

export async function toSequenceTransactions(
  wallet: Signer | string,
  txs: (SequenceTransaction | AuxTransactionRequest)[],
  revertOnError: boolean = false,
  gasLimit: BigNumberish = ethers.constants.Zero
): Promise<SequenceTransaction[]> {
  // Bundles all transactions, including the auxiliary ones
  const allTxs = flattenAuxTransactions(txs)

  // Uses the lowest nonce found on TransactionRequest
  // if there are no nonces, it leaves an undefined nonce
  const nonces = (await Promise.all(txs.map(t => t.nonce))).filter(n => n !== undefined).map(n => ethers.BigNumber.from(n))
  const nonce = nonces.length !== 0 ? nonces.reduce((p, c) => (p.lt(c) ? p : c)) : undefined

  // Maps all transactions into SequenceTransactions
  return Promise.all(allTxs.map(tx => toSequenceTransaction(wallet, tx, revertOnError, gasLimit, nonce)))
}

export function flattenAuxTransactions(txs: (Transactionish | Transactionish)[]): (TransactionRequest | SequenceTransaction)[] {
  if (!Array.isArray(txs)) return flattenAuxTransactions([txs])
  return txs.reduce(function (p: Transactionish[], c: Transactionish) {
    if (Array.isArray(c)) {
      return p.concat(flattenAuxTransactions(c))
    }

    if ((<AuxTransactionRequest>c).auxiliary) {
      return p.concat([c, ...flattenAuxTransactions((<AuxTransactionRequest>c).auxiliary)])
    }

    return p.concat(c)
  }, []) as (TransactionRequest | SequenceTransaction)[]
}

export async function toSequenceTransaction(
  wallet: Signer | string,
  tx: TransactionRequest | SequenceTransaction,
  revertOnError: boolean = false,
  gasLimit: BigNumberish = ethers.constants.Zero,
  nonce: BigNumberish = undefined
): Promise<SequenceTransaction> {
  if (isSequenceTransaction(tx)) {
    return tx as SequenceTransaction
  }

  const txGas = tx.gasLimit === undefined ? (<any>tx).gas : tx.gasLimit

  if (tx.to) {
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: txGas ? await txGas : gasLimit,
      to: await tx.to,
      value: tx.value ? await tx.value : 0,
      data: await tx.data,
      nonce: nonce ? nonce : await tx.nonce
    }
  } else {
    const walletInterface = new Interface(walletContracts.mainModule.abi)
    const data = walletInterface.encodeFunctionData(walletInterface.getFunction('createContract'), [tx.data])
    const address = typeof wallet === 'string' ? wallet : wallet.getAddress()

    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: txGas ? await txGas : gasLimit,
      to: await address,
      value: tx.value ? await tx.value : 0,
      data: data,
      nonce: nonce ? nonce : await tx.nonce
    }
  }
}

export function isAsyncSendable(target: any) {
  return target.send || target.sendAsync
}

export function isSequenceTransaction(tx: any): tx is SequenceTransaction {
  return tx.delegateCall !== undefined || tx.revertOnError !== undefined
}

export function hasSequenceTransactions(txs: any[]) {
  return txs.find(t => isSequenceTransaction(t)) !== undefined
}

export function readSequenceNonce(...txs: SequenceTransaction[]): BigNumberish {
  const sample = txs.find(t => t.nonce !== undefined)
  if (txs.find(t => t.nonce !== undefined && t.nonce !== sample.nonce)) {
    throw new Error('Mixed nonces on Sequence transactions')
  }

  return sample ? sample.nonce : undefined
}

export function sequenceTxAbiEncode(txs: SequenceTransaction[]): SequenceTransactionEncoded[] {
  return txs.map(t => ({
    delegateCall: t.delegateCall === true,
    revertOnError: t.revertOnError === true,
    gasLimit: t.gasLimit !== undefined ? t.gasLimit : ethers.constants.Zero,
    target: t.to,
    value: t.value !== undefined ? t.value : ethers.constants.Zero,
    data: t.data !== undefined ? t.data : []
  }))
}

export function appendNonce(txs: SequenceTransaction[], nonce: BigNumberish): SequenceTransaction[] {
  return txs.map((t: SequenceTransaction) => ({ ...t, nonce }))
}

export function makeExpirable(context: WalletContext, txs: SequenceTransaction[], expiration: BigNumberish): SequenceTransaction[] {
  const requireUtils = new Interface(walletContracts.requireUtils.abi)

  if (!context || !context.requireUtils) {
    throw new Error('Undefined requireUtils')
  }

  return [
    {
      delegateCall: false,
      revertOnError: true,
      gasLimit: 0,
      to: context.requireUtils,
      value: 0,
      data: requireUtils.encodeFunctionData(requireUtils.getFunction('requireNonExpired'), [expiration])
    },
    ...txs
  ]
}

export function makeAfterNonce(context: WalletContext, txs: SequenceTransaction[], dep: NonceDependency): SequenceTransaction[] {
  const requireUtils = new Interface(walletContracts.requireUtils.abi)

  if (!context || !context.requireUtils) {
    throw new Error('Undefined requireUtils')
  }

  return [
    {
      delegateCall: false,
      revertOnError: true,
      gasLimit: 0,
      to: context.requireUtils,
      value: 0,
      data: requireUtils.encodeFunctionData(requireUtils.getFunction('requireMinNonce'), [
        dep.address,
        dep.space ? encodeNonce(dep.space, dep.nonce) : dep.nonce
      ])
    },
    ...txs
  ]
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

  return [
    bnonce.div(shr),
    bnonce.mod(shr)
  ]
}

export function isSignedTransactions(cand: any): cand is SignedTransactions {
  return (
    cand !== undefined &&
    cand.chainId !== undefined &&
    cand.config !== undefined &&
    cand.context !== undefined &&
    cand.signature !== undefined &&
    cand.transactions !== undefined &&
    Array.isArray(cand.transactions) &&
    cand.transactions.reduce((p, c) => p && isSequenceTransaction(c), true)
  )
}
