import { Intent, makeIntent } from './base'
import {
  IntentDataGetTransactionReceipt,
  IntentDataSendTransaction,
  TransactionDelayedEncode,
  TransactionERC1155,
  TransactionERC20,
  TransactionERC721,
  TransactionRaw
} from '../clients/intent.gen'
import { ethers } from 'ethers'
import { BigIntish } from '@0xsequence/utils'

interface BaseArgs {
  lifespan: number
  wallet: string
  identifier: string
  chainId: number
}

export type SendTransactionsArgs = {
  transactions: Transaction[]
}

export type SendERC20Args = {
  chainId: number
  token: string
  to: string
  value: BigIntish
}

export type SendERC721Args = {
  chainId: number
  token: string
  to: string
  id: string
  safe?: boolean
  data?: string
}

export type SendERC1155Args = {
  chainId: number
  token: string
  to: string
  values: {
    id: string
    amount: BigIntish
  }[]
  data?: string
}

export type SendDelayedEncodeArgs = {
  chainId: number
  to: string
  value: BigIntish
  abi: string
  func: string
  args: string[] | { [key: string]: string }
}

export function sendTransactions({
  lifespan,
  wallet,
  identifier,
  chainId,
  transactions
}: SendTransactionsArgs & BaseArgs): Intent<IntentDataSendTransaction> {
  return makeIntent('sendTransaction', lifespan, {
    identifier,
    wallet,
    network: chainId.toString(),
    transactions: transactions.map(tx => {
      if (!tx.to || tx.to === ethers.constants.AddressZero) {
        throw new Error('Contract creation not supported')
      }

      if (!isEthersTx(tx)) {
        return tx
      }

      return {
        type: 'transaction',
        to: tx.to,
        value: ethers.BigNumber.from(tx.value || 0).toHexString(),
        data: ethers.utils.hexlify(tx.data || [])
      }
    })
  })
}

export type GetTransactionReceiptArgs = {
  metaTxHash: string
}

export function getTransactionReceipt({
  lifespan,
  chainId,
  wallet,
  metaTxHash
}: GetTransactionReceiptArgs & BaseArgs): Intent<IntentDataGetTransactionReceipt> {
  return makeIntent('getTransactionReceipt', lifespan, {
    wallet,
    network: chainId.toString(),
    metaTxHash
  })
}

export function sendERC20({ token, to, value, ...args }: SendERC20Args & BaseArgs): Intent<IntentDataSendTransaction> {
  return sendTransactions({
    transactions: [erc20({ tokenAddress: token, to, value: value.toString() })],
    ...args
  })
}

export function sendERC721({ token, to, id, safe, data, ...args }: SendERC721Args & BaseArgs): Intent<IntentDataSendTransaction> {
  return sendTransactions({
    transactions: [erc721({ tokenAddress: token, to, id, data, safe })],
    ...args
  })
}

export function sendERC1155({ token, to, values, data, ...args }: SendERC1155Args & BaseArgs): Intent<IntentDataSendTransaction> {
  const vals = values.map(v => ({
    id: v.id,
    amount: BigInt(v.amount).toString()
  }))

  return sendTransactions({
    transactions: [erc1155({ tokenAddress: token, to, vals, data })],
    ...args
  })
}

export function sendDelayedEncode({
  to,
  value,
  abi,
  func,
  args,
  ...otherArgs
}: SendDelayedEncodeArgs & BaseArgs): Intent<IntentDataSendTransaction> {
  return sendTransactions({
    transactions: [
      delayedEncode({
        to,
        value: BigInt(value).toString(),
        data: { abi, func, args }
      })
    ],
    ...otherArgs
  })
}

export type Transaction =
  | ethers.providers.TransactionRequest
  | TransactionRaw
  | TransactionERC20
  | TransactionERC721
  | TransactionERC1155
  | TransactionDelayedEncode

export function transaction(data: Omit<TransactionRaw, 'type'>): Transaction {
  return { type: 'transaction', ...data }
}

export function erc20(data: Omit<TransactionERC20, 'type'>): Transaction {
  return { type: 'erc20send', ...data }
}

export function erc721(data: Omit<TransactionERC721, 'type'>): Transaction {
  return { type: 'erc720send', ...data }
}

export function erc1155({ vals, ...data }: Omit<TransactionERC1155, 'type'>): Transaction {
  return {
    type: 'erc1155send',
    vals: vals.map(v => ({
      id: v.id,
      amount: BigInt(v.amount).toString()
    })),
    ...data
  }
}

export function delayedEncode({ to, value, data }: Omit<TransactionDelayedEncode, 'type'>): Transaction {
  return {
    type: 'delayedEncode',
    to,
    value,
    data
  }
}

export function combineTransactionIntents(intents: Intent<IntentDataSendTransaction>[]): Intent<IntentDataSendTransaction> {
  if (intents.length === 0) {
    throw new Error('No packets provided')
  }

  // Ensure that all packets are for the same network and wallet
  const network = intents[0].data.network
  const wallet = intents[0].data.wallet
  const lifespan = intents[0].expiresAt - intents[0].issuedAt
  const identifier = intents[0].data.identifier

  if (!intents.every(intent => intent.data.network === network)) {
    throw new Error('All packets must have the same chainId')
  }

  if (!intents.every(intent => intent.data.wallet === wallet)) {
    throw new Error('All packets must have the same wallet')
  }

  return makeIntent('sendTransaction', lifespan, {
    network,
    wallet,
    identifier,
    transactions: intents.flatMap(intent => intent.data.transactions)
  })
}

function isEthersTx(tx: Transaction): tx is ethers.providers.TransactionRequest {
  return !['transaction', 'erc20send', 'erc721send', 'erc1155send', 'delayedEncode'].includes(tx.type as any)
}
