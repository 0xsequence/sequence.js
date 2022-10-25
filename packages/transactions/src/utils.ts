import { ethers, Signer, BigNumberish, utils } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { WalletContext } from '@0xsequence/network'
import { Transaction, TransactionRequest, Transactionish, TransactionEncoded, NonceDependency, SignedTransactions } from './types'
import { subDigestOf } from '@0xsequence/utils'

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
  return digestOfTransactionsNonce(nonce, ...txs)
}

export function digestOfTransactionsNonce(nonce: BigNumberish, ...txs: Transaction[]) {
  return ethers.utils.keccak256(packMetaTransactionsNonceData(nonce, ...txs))
}

export function computeMetaTxnHash(address: string, chainId: BigNumberish, ...txs: Transaction[]): string {
  return subDigestOf(address, chainId, digestOfTransactions(...txs)).replace(/^0x/, '')
}

export async function toSequenceTransactions(
  wallet: Signer | string,
  txs: (Transaction | TransactionRequest)[],
  revertOnError: boolean = false,
  gasLimit?: BigNumberish
): Promise<Transaction[]> {
  // Bundles all transactions, including the auxiliary ones
  const allTxs = flattenAuxTransactions(txs)

  // Uses the lowest nonce found on TransactionRequest
  // if there are no nonces, it leaves an undefined nonce
  const nonces = (await Promise.all(txs.map(t => t.nonce))).filter(n => n !== undefined).map(n => ethers.BigNumber.from(n))
  const nonce = nonces.length !== 0 ? nonces.reduce((p, c) => (p.lt(c) ? p : c)) : undefined

  // Maps all transactions into SequenceTransactions
  return Promise.all(allTxs.map(tx => toSequenceTransaction(wallet, tx, revertOnError, gasLimit, nonce)))
}

export function flattenAuxTransactions(txs: Transactionish | Transactionish[]): (TransactionRequest | Transaction)[] {
  if (!Array.isArray(txs)) {
    if ('auxiliary' in txs) {
      const aux = txs.auxiliary

      const tx = { ...txs }
      delete tx.auxiliary

      if (aux) {
        return [tx, ...flattenAuxTransactions(aux)]
      } else {
        return [tx]
      }
    } else {
      return [txs]
    }
  }

  return txs.flatMap(flattenAuxTransactions)
}

export async function toSequenceTransaction(
  wallet: Signer | string,
  tx: TransactionRequest | Transaction,
  revertOnError: boolean = false,
  gasLimit?: BigNumberish,
  nonce?: BigNumberish
): Promise<Transaction> {
  if (isSequenceTransaction(tx)) {
    return tx as Transaction
  }

  const txGas = tx.gasLimit === undefined ? (<any>tx).gas : tx.gasLimit

  if (tx.to) {
    return {
      delegateCall: false,
      revertOnError: revertOnError,
      gasLimit: txGas ? await txGas : gasLimit,
      to: await tx.to,
      value: tx.value ? await tx.value : 0,
      data: (await tx.data)!,
      nonce: nonce ? nonce : await tx.nonce
    }
  } else {
    const walletInterface = new utils.Interface(walletContracts.mainModule.abi)
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

export function isSequenceTransaction(tx: any): tx is Transaction {
  return tx.delegateCall !== undefined || tx.revertOnError !== undefined
}

export function hasSequenceTransactions(txs: any[]) {
  return txs.find(t => isSequenceTransaction(t)) !== undefined
}

export function readSequenceNonce(...txs: Transaction[]): BigNumberish | undefined {
  const sample = txs.find(t => t.nonce !== undefined)
  if (!sample) {
    return undefined
  }
  const sampleNonce = ethers.BigNumber.from(sample.nonce)

  if (txs.find(t => t.nonce !== undefined && !ethers.BigNumber.from(t.nonce).eq(sampleNonce))) {
    throw new Error('Mixed nonces on Sequence transactions')
  }

  return sample ? sample.nonce : undefined
}

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

export function makeExpirable(context: WalletContext, txs: Transaction[], expiration: BigNumberish): Transaction[] {
  const sequenceUtils = new utils.Interface(walletContracts.sequenceUtils.abi)

  if (!context || !context.sequenceUtils) {
    throw new Error('Undefined sequenceUtils')
  }

  return [
    {
      delegateCall: false,
      revertOnError: true,
      gasLimit: 0,
      to: context.sequenceUtils,
      value: 0,
      data: sequenceUtils.encodeFunctionData(sequenceUtils.getFunction('requireNonExpired'), [expiration])
    },
    ...txs
  ]
}

export function makeAfterNonce(context: WalletContext, txs: Transaction[], dep: NonceDependency): Transaction[] {
  const sequenceUtils = new utils.Interface(walletContracts.sequenceUtils.abi)

  if (!context || !context.sequenceUtils) {
    throw new Error('Undefined sequenceUtils')
  }

  return [
    {
      delegateCall: false,
      revertOnError: true,
      gasLimit: 0,
      to: context.sequenceUtils,
      value: 0,
      data: sequenceUtils.encodeFunctionData(sequenceUtils.getFunction('requireMinNonce'), [
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

  return [bnonce.div(shr), bnonce.mod(shr)]
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
    (<SignedTransactions>cand).transactions.reduce((p, c) => p && isSequenceTransaction(c), true)
  )
}

export async function fromTransactionish(
  context: WalletContext,
  wallet: string,
  transaction: Transactionish
): Promise<Transaction[]> {
  let stx: Transaction[] = []

  if (Array.isArray(transaction)) {
    if (hasSequenceTransactions(transaction)) {
      stx = flattenAuxTransactions(transaction) as Transaction[]
    } else {
      stx = await toSequenceTransactions(wallet, transaction)
    }
  } else if (isSequenceTransaction(transaction)) {
    stx = flattenAuxTransactions([transaction]) as Transaction[]
  } else {
    stx = await toSequenceTransactions(wallet, [transaction])
  }

  // If transaction is marked as expirable
  // append expirable require
  if ((<TransactionRequest>transaction).expiration) {
    stx = makeExpirable(context, stx, (<TransactionRequest>transaction).expiration!)
  }

  // If transaction depends on another nonce
  // append after nonce requirement
  if ((<TransactionRequest>transaction).afterNonce) {
    const after = (<TransactionRequest>transaction).afterNonce
    stx = makeAfterNonce(
      context,
      stx,
      (<NonceDependency>after).address
        ? {
            address: (<NonceDependency>after).address,
            nonce: (<NonceDependency>after).nonce,
            space: (<NonceDependency>after).space
          }
        : {
            address: wallet,
            nonce: <BigNumberish>after
          }
    )
  }

  return stx
}
