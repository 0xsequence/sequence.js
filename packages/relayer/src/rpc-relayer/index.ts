import { TransactionResponse } from '@ethersproject/providers'
import { ethers } from 'ethers'
import fetchPonyfill from 'fetch-ponyfill'
import {
  Transaction,
  readSequenceNonce,
  appendNonce,
  MetaTransactionsType,
  sequenceTxAbiEncode,
  SignedTransactions,
  computeMetaTxnHash,
  packMetaTransactionsData
} from '@0xsequence/transactions'
import { BaseRelayer, BaseRelayerOptions } from '../base-relayer'
import { FeeOption, Relayer } from '..'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { logger } from '@0xsequence/utils'
import * as proto from './relayer.gen'

export { proto }

const FAILED_STATUSES = [
  proto.ETHTxnStatus.FAILED,
  proto.ETHTxnStatus.PARTIALLY_FAILED,
  proto.ETHTxnStatus.DROPPED,
  proto.ETHTxnStatus.REVERTED
]

export interface RpcRelayerOptions extends BaseRelayerOptions {
  url: string
}

export function isRpcRelayerOptions(obj: any): obj is RpcRelayerOptions {
  return obj.url !== undefined && typeof obj.url === 'string'
}

export class RpcRelayer extends BaseRelayer implements Relayer {
  private readonly service: proto.RelayerService

  constructor(options: RpcRelayerOptions) {
    super(options)
    this.service = new proto.RelayerService(options.url, fetchPonyfill().fetch)
  }

  async waitReceipt(metaTxnHash: string | SignedTransactions, wait: number = 1000): Promise<proto.GetMetaTxnReceiptReturn> {
    if (typeof metaTxnHash !== 'string') {
      console.log("computing id", metaTxnHash.config, metaTxnHash.context, metaTxnHash.chainId, ...metaTxnHash.transactions)
      return this.waitReceipt(
        computeMetaTxnHash(addressOf(metaTxnHash.config, metaTxnHash.context), metaTxnHash.chainId, ...metaTxnHash.transactions)
      )
    }

    console.log("waiting for", metaTxnHash)
    let result = await this.service.getMetaTxnReceipt({ metaTxID: metaTxnHash })

    // TODO: remove check for 'UNKNOWN' status when 'QUEUED' status is supported
    while (
      (!result.receipt.txnReceipt || result.receipt.txnReceipt === 'null') &&
      (result.receipt.status === 'UNKNOWN' || result.receipt.status === 'QUEUED')
    ) {
      await new Promise(r => setTimeout(r, wait))
      result = await this.service.getMetaTxnReceipt({ metaTxID: metaTxnHash })
    }

    return result
  }

  async estimateGasLimits(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<Transaction[]> {
    logger.info(`[rpc-relayer/estimateGasLimits] estimate gas limits request ${JSON.stringify(transactions)}`)

    if (transactions.length == 0) {
      return []
    }

    const addr = addressOf(config, context)
    const prevNonce = readSequenceNonce(...transactions)

    // Set temporal nonce to simulate meta-txn
    if (prevNonce === undefined) {
      transactions = appendNonce(transactions, await this.getNonce(config, context))
    }

    const coder = ethers.utils.defaultAbiCoder
    const encoded = coder.encode([MetaTransactionsType], [sequenceTxAbiEncode(transactions)])
    const res = await this.service.updateMetaTxnGasLimits({
      walletAddress: addr,
      payload: encoded
    })

    const decoded = coder.decode([MetaTransactionsType], res.payload)[0]
    const modTxns = transactions.map((t, i) => ({
      ...t,
      gasLimit: decoded[i].gasLimit
    }))

    logger.info(`[rpc-relayer/estimateGasLimits] got transactions with gas limits ${JSON.stringify(modTxns)}`)

    // Remove placeholder nonce if previously defined
    return prevNonce === undefined ? modTxns : appendNonce(modTxns, prevNonce)
  }

  async gasRefundOptions(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<FeeOption[]> {
    // NOTE/TODO: for a given `service` the feeTokens will not change between execution, so we should memoize this value
    // for a short-period of time, perhaps for 1 day or in memory. Perhaps one day we can make this happen automatically
    // with http cache response for this endpoint and service-worker.. lots of approaches
    const feeTokens = await this.service.feeTokens()

    if (feeTokens.isFeeRequired) {
      const symbols = feeTokens.tokens.map(token => token.symbol).join(', ')
      logger.info(`[rpc-relayer/gasRefundOptions] relayer fees are required, accepted tokens are ${symbols}`)

      const addr = addressOf(config, context)
      const prevNonce = readSequenceNonce(...transactions)

      // Set temporal nonce to simulate meta-txn
      if (prevNonce === undefined) {
        transactions = appendNonce(transactions, await this.getNonce(config, context))
      }

      const res = await this.service.getMetaTxnNetworkFeeOptions({
        walletConfig: { ...config, address: addr },
        payload: packMetaTransactionsData(...transactions)
      })

      logger.info(`[rpc-relayer/gasRefundOptions] got refund options ${JSON.stringify(res.options)}`)
      return res.options
    } else {
      logger.info(`[rpc-relayer/gasRefundOptions] relayer fees are not required`)
      return []
    }
  }

  async getNonce(config: WalletConfig, context: WalletContext, space?: number): Promise<number> {
    const addr = addressOf(config, context)
    logger.info(`[rpc-relayer/getNonce] get nonce for wallet ${addr} space: ${space}`)
    const resp = await this.service.getMetaTxnNonce({ walletContractAddress: addr })
    const nonce = ethers.BigNumber.from(resp.nonce).toNumber()
    logger.info(`[rpc-relayer/getNonce] got next nonce for wallet ${addr} ${nonce} space: ${space}`)
    return nonce
  }

  async relay(signedTxs: SignedTransactions): Promise<TransactionResponse> {
    logger.info(`[rpc-relayer/relay] relaying signed meta-transactions ${JSON.stringify(signedTxs)}`)

    if (!this.provider) {
      logger.warn(`[rpc-relayer/relay] provider not set, failed relay`)
      throw new Error('provider is not set')
    }

    const prep = await this.prepareTransactions(
      signedTxs.config,
      signedTxs.context,
      signedTxs.signature,
      ...signedTxs.transactions
    )
    const metaTxn = await this.service.sendMetaTxn({
      call: {
        contract: prep.to,
        input: prep.data
      }
    })

    logger.warn(`[rpc-relayer/relay] got relay result ${JSON.stringify(metaTxn)}`)

    return this.wait(metaTxn.txnHash)
  }

  async wait(metaTxnHash: string | SignedTransactions, wait: number = 1000): Promise<TransactionResponse> {
    const { receipt } = await this.waitReceipt(metaTxnHash, wait)

    if (!receipt.txnReceipt || FAILED_STATUSES.includes(receipt.status as proto.ETHTxnStatus)) {
      throw new MetaTransactionResponseException(receipt)
    }

    const txReceipt = JSON.parse(receipt.txnReceipt) as RelayerTxReceipt

    return {
      blockHash: txReceipt.blockHash,
      blockNumber: ethers.BigNumber.from(txReceipt.blockNumber).toNumber(),
      confirmations: 1,
      from: typeof metaTxnHash === 'string' ? undefined : addressOf(metaTxnHash.config, metaTxnHash.context),
      hash: txReceipt.transactionHash,
      raw: receipt.txnReceipt,
      wait: async (confirmations?: number) => this.provider!.waitForTransaction(txReceipt.transactionHash, confirmations)
    } as TransactionResponse
  }
}

class MetaTransactionResponseException {
  constructor(public receipt: proto.MetaTxnReceipt) {}
}

type RelayerTxReceipt = {
  blockHash: string
  blockNumber: string
  contractAddress: string
  cumulativeGasUsed: string
  gasUsed: string
  logs: {
    address: string
    blockHash: string
    blockNumber: string
    data: string
    logIndex: string
    removed: boolean
    topics: string[]
    transactionHash: string
    transactionIndex: string
  }[]
  logsBloom: string
  root: string
  status: string
  transactionHash: string
  transactionIndex: string
}
