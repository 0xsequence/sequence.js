import { Intent, makeIntent } from './base'
import {
  IntentDataGetTransactionReceipt,
  IntentDataSendTransaction,
  IntentDataFeeOptions,
  TransactionDelayedEncode,
  TransactionERC1155,
  TransactionERC20,
  TransactionERC721,
  TransactionRaw, TransactionERC1155Value
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

export function erc20(data: Omit<TransactionERC20, 'type'> | Omit<SendERC20Args, 'chainId'>): Transaction {
  const sendERC20Args = data as Omit<SendERC20Args, 'chainId'>
  const transactionERC20 = data as Omit<TransactionERC20, 'type'>

  if (sendERC20Args.token !== undefined) {
    return {
      type: 'erc20send',
      tokenAddress: sendERC20Args.token,
      to: sendERC20Args.to,
      value: sendERC20Args.value.toString()
    }
  } else if (transactionERC20.tokenAddress !== undefined) {
    return { type: 'erc20send', ...transactionERC20 }
  } else {
    throw new Error('Invalid ERC20 transaction')
  }
}

export function erc721(data: Omit<TransactionERC721, 'type'> | Omit<SendERC721Args, 'chainId'>): Transaction {
  const sendERC721Args = data as Omit<SendERC721Args, 'chainId'>
  const transactionERC721 = data as Omit<TransactionERC721, 'type'>

  if (sendERC721Args.token !== undefined) {
    return {
      type: 'erc721send',
      tokenAddress: sendERC721Args.token,
      to: sendERC721Args.to,
      id: sendERC721Args.id,
      data: sendERC721Args.data,
      safe: sendERC721Args.safe
    }
  } else if (transactionERC721.tokenAddress !== undefined) {
    return { type: 'erc721send', ...transactionERC721 }
  } else {
    throw new Error('Invalid ERC721 transaction')
  }
}

export function erc1155(data: Omit<TransactionERC1155, 'type'> | Omit<SendERC1155Args, 'chainId'>): Transaction {
  const sendERC1155Args = data as Omit<SendERC1155Args, 'chainId'>
  const transactionERC1155 = data as Omit<TransactionERC1155, 'type'>

  if (sendERC1155Args.values !== undefined) {
    return {
      type: 'erc1155send',
      vals: sendERC1155Args.values.map(v => ({
        id: v.id,
        amount: ethers.BigNumber.from(v.amount).toString()
      })),
      tokenAddress: sendERC1155Args.token,
      to: sendERC1155Args.to,
      data: sendERC1155Args.data
    }
  } else if (transactionERC1155.vals !== undefined) {
    return  {
      type: 'erc1155send',
      vals: transactionERC1155.vals.map(v => ({
        id: v.id,
        amount: ethers.BigNumber.from(v.amount).toString()
      })),
      tokenAddress: transactionERC1155.tokenAddress,
      to: transactionERC1155.to,
      data: transactionERC1155.data
    }
  } else {
    throw new Error('Invalid ERC1155 transaction')
  }
}

export function delayedEncode(data: Omit<TransactionDelayedEncode, 'type'> | Omit<SendDelayedEncodeArgs, 'chainId'>): Transaction {
  const sendDelayedEncodeArgs = data as Omit<SendDelayedEncodeArgs, 'chainId'>
  const transactionDelayedEncode = data as Omit<TransactionDelayedEncode, 'type'>

  if (sendDelayedEncodeArgs.abi !== undefined) {
    return {
      type: 'delayedEncode',
      to: sendDelayedEncodeArgs.to,
      value: ethers.BigNumber.from(sendDelayedEncodeArgs.value).toString(),
      data: {
        abi: sendDelayedEncodeArgs.abi,
        func: sendDelayedEncodeArgs.func,
        args: sendDelayedEncodeArgs.args
      }
    }
  } else if (transactionDelayedEncode.data !== undefined) {
    return {
      type: 'delayedEncode',
      to: transactionDelayedEncode.to,
      value: transactionDelayedEncode.value,
      data: transactionDelayedEncode.data
    }
  } else {
    throw new Error('Invalid delayed encode transaction')
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
