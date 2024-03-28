import { Intent, makeIntent } from './base'
import {
  IntentDataGetTransactionReceipt,
  IntentDataSendTransaction,
  IntentDataFeeOptions,
  TransactionDelayedEncode,
  TransactionERC1155,
  TransactionERC20,
  TransactionERC721,
  TransactionRaw
} from '../clients/intent.gen'
import { ethers } from 'ethers'
import { FeeOption, FeeTokenType } from './responses'

interface BaseArgs {
  lifespan: number
  wallet: string
  identifier: string
  chainId: number
}

export type TransactionFeeArgs = {
  transactionsFeeQuote?: string
  transactionsFeeOption?: FeeOption
}

export type SendTransactionsArgs = TransactionFeeArgs & {
  transactions: Transaction[],
}

export type SendERC20Args = TransactionFeeArgs & {
  chainId: number
  token: string
  to: string
  value: ethers.BigNumberish
}

export type SendERC721Args = TransactionFeeArgs & {
  chainId: number
  token: string
  to: string
  id: string
  safe?: boolean
  data?: string
}

export type SendERC1155Args = TransactionFeeArgs & {
  chainId: number
  token: string
  to: string
  values: {
    id: string
    amount: ethers.BigNumberish
  }[]
  data?: string
}

export type SendDelayedEncodeArgs = TransactionFeeArgs & {
  chainId: number
  to: string
  value: ethers.BigNumberish
  abi: string
  func: string
  args: string[] | { [key: string]: string }
}

export function feeOptions({
                             lifespan,
                             wallet,
                             identifier,
                             chainId,
                             transactions
                           }: SendTransactionsArgs & BaseArgs): Intent<IntentDataFeeOptions> {
  return makeIntent('feeOptions', lifespan, {
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

export function sendTransactions({
  lifespan,
  wallet,
  identifier,
  chainId,
  transactions,
  transactionsFeeQuote,
  transactionsFeeOption
}: SendTransactionsArgs & BaseArgs): Intent<IntentDataSendTransaction> {
  return makeIntent('sendTransaction', lifespan, {
    identifier,
    wallet,
    network: chainId.toString(),
    transactions: withTransactionFee(transactions, transactionsFeeOption).map(tx => {
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
    }),
    transactionsFeeQuote
  })
}

function withTransactionFee(transactions: Transaction[], feeOption?: FeeOption): Transaction[] {
  const extendedTransactions = [...transactions]
  if (feeOption) {
    switch (feeOption.token.type) {
      case FeeTokenType.unknown:
        extendedTransactions.push(
          {
            to: feeOption.to,
            value: feeOption.value
          }
        )
        break
      case FeeTokenType.erc20Token:
        if (!feeOption.token.contractAddress) {
          throw new Error('contract address is required')
        }

        extendedTransactions.push(erc20({
          tokenAddress: feeOption.token.contractAddress,
          to: feeOption.to,
          value: feeOption.value
        }))
        break
      case FeeTokenType.erc1155Token:
        if (!feeOption.token.contractAddress) {
          throw new Error('contract address is required')
        }

        if (!feeOption.token.tokenID) {
          throw new Error('token ID is required')
        }

        extendedTransactions.push(erc1155({
          tokenAddress: feeOption.token.contractAddress,
          to: feeOption.to,
          vals: [{id: feeOption.token.tokenID, amount: feeOption.value}]
        }))
        break
      }
    }

  return extendedTransactions
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

export function sendERC20ArgsToTransaction({ token, to, value, ...args }: Omit<SendERC20Args, 'chainId'>): Transaction {
  return erc20({ tokenAddress: token, to, value: value.toString() })
}

export function sendERC721ArgsToTransaction({ token, to, id, safe, data, ...args }: Omit<SendERC721Args, 'chainId'>): Transaction {
  return erc721({ tokenAddress: token, to, id, data, safe })
}

export function sendERC1155ArgsToTransaction({ token, to, values, data, ...args }: Omit<SendERC1155Args, 'chainId'>): Transaction {
  const vals = values.map(v => ({
    id: v.id,
    amount: ethers.BigNumber.from(v.amount).toString()
  }))

  return erc1155({ tokenAddress: token, to, vals, data })
}

export function sendDelayedEncodeArgsToTransaction({ to, value, abi, func, args, ...otherArgs }: Omit<SendDelayedEncodeArgs, 'chainId'>): Transaction {
  return delayedEncode({
    to,
    value: ethers.BigNumber.from(value).toString(),
    data: { abi, func, args }
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
    amount: ethers.BigNumber.from(v.amount).toString()
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
        value: ethers.BigNumber.from(value).toString(),
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
      amount: ethers.BigNumber.from(v.amount).toString()
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
  const transactionsFeeQuote = intents[0].data.transactionsFeeQuote

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
    transactions: intents.flatMap(intent => intent.data.transactions),
    transactionsFeeQuote
  })
}

function isEthersTx(tx: Transaction): tx is ethers.providers.TransactionRequest {
  return !['transaction', 'erc20send', 'erc721send', 'erc1155send', 'delayedEncode'].includes(tx.type as any)
}
