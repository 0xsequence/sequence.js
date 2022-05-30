import { ethers } from 'ethers'
import fetchPonyfill from 'fetch-ponyfill'
import {
  Transaction,
  readSequenceNonce,
  appendNonce,
  MetaTransactionsType,
  sequenceTxAbiEncode,
  TransactionBundle,
  encodeBundleExecData,
  decodeNonce,
  TransactionResponse
} from '@0xsequence/transactions'
import { FeeOption, FeeQuote, Relayer, SimulateResult } from '..'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { logger } from '@0xsequence/utils'
import * as proto from './relayer.gen'

export { proto }

const FAILED_STATUSES = [proto.ETHTxnStatus.FAILED, proto.ETHTxnStatus.PARTIALLY_FAILED, proto.ETHTxnStatus.DROPPED]

export interface RpcRelayerOptions {
  provider: ethers.providers.Provider | string,
  url: string
}

export function isRpcRelayerOptions(obj: any): obj is RpcRelayerOptions {
  return obj.url !== undefined && typeof obj.url === 'string'
}

export class RpcRelayer implements Relayer {
  private readonly service: proto.Relayer
  private readonly provider: ethers.providers.Provider

  constructor(options: RpcRelayerOptions) {
    this.service = new proto.Relayer(options.url, fetchPonyfill().fetch)
    this.provider = typeof options.provider === 'string' ? new ethers.providers.JsonRpcProvider(options.provider) : options.provider
  }

  async waitReceipt(metaTxnHash: string | TransactionBundle, wait: number = 1000): Promise<proto.GetMetaTxnReceiptReturn> {
    if (typeof metaTxnHash !== 'string') {
      return this.waitReceipt(metaTxnHash.intent.digest, wait)
    }

    logger.info(`[rpc-relayer/waitReceipt] waiting for ${metaTxnHash}`)
    let result = await this.service.getMetaTxnReceipt({ metaTxID: metaTxnHash })

    // TODO: remove check for 'UNKNOWN' status when 'QUEUED' status is supported
    // TODO: fix backend to not return literal 'null' txnReceipt
    while (
      !result.receipt ||
      !result.receipt.txnReceipt ||
      result.receipt.txnReceipt === 'null' ||
      result.receipt.status === 'UNKNOWN' ||
      result.receipt.status === 'QUEUED' ||
      result.receipt.status === 'SENT'
    ) {
      await new Promise(r => setTimeout(r, wait))
      result = await this.service.getMetaTxnReceipt({ metaTxID: metaTxnHash })
    }

    return result
  }

  async simulate(wallet: string, entrypoint: string, ...transactions: Transaction[]): Promise<SimulateResult[]> {
    const coder = ethers.utils.defaultAbiCoder
    const encoded = coder.encode([MetaTransactionsType], [sequenceTxAbiEncode(transactions)])
    return (await this.service.simulate({ wallet, entrypoint, transactions: encoded })).results
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
      walletConfig: {
        address: addr,
        signers: config.signers,
        threshold: config.threshold,
        chainId: config.chainId
      },
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

  async getFeeOptions(
    bundle: TransactionBundle
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    // NOTE/TODO: for a given `service` the feeTokens will not change between execution, so we should memoize this value
    // for a short-period of time, perhaps for 1 day or in memory. Perhaps one day we can make this happen automatically
    // with http cache response for this endpoint and service-worker.. lots of approaches
    const feeTokens = await this.service.feeTokens()

    if (feeTokens.isFeeRequired) {
      const symbols = feeTokens.tokens.map(token => token.symbol).join(', ')
      logger.info(`[rpc-relayer/getFeeOptions] relayer fees are required, accepted tokens are ${symbols}`)

      // Is bundle is already signed we can use the provided nonce
      // otherwise we just use the next nonce for the wallet
      const data = await encodeBundleExecData(bundle)

      const { options, quote } = await this.service.feeOptions({
        wallet: bundle.intent.wallet,
        to: bundle.entrypoint,
        data: data
      })

      logger.info(`[rpc-relayer/getFeeOptions] got refund options ${JSON.stringify(options)}`)
      return { options, quote: { _tag: 'FeeQuote', _quote: quote } }
    } else {
      logger.info(`[rpc-relayer/getFeeOptions] relayer fees are not required`)
      return { options: [] }
    }
  }

  async gasRefundOptions(bundle: TransactionBundle): Promise<FeeOption[]> {
    const { options } = await this.getFeeOptions(bundle)
    return options
  }

  async getNonce(config: WalletConfig, context: WalletContext, space?: ethers.BigNumberish): Promise<ethers.BigNumberish> {
    const addr = addressOf(config, context)
    logger.info(`[rpc-relayer/getNonce] get nonce for wallet ${addr} space: ${space}`)
    const encodedNonce = space !== undefined ? ethers.BigNumber.from(space).toHexString() : undefined
    const resp = await this.service.getMetaTxnNonce({ walletContractAddress: addr, space: encodedNonce })
    const nonce = ethers.BigNumber.from(resp.nonce)
    const [decodedSpace, decodedNonce] = decodeNonce(nonce)
    logger.info(`[rpc-relayer/getNonce] got next nonce for wallet ${addr} ${decodedNonce} space: ${decodedSpace}`)
    return nonce
  }

  async relay(bundle: TransactionBundle): Promise<TransactionResponse> {
    logger.info(`[rpc-relayer/relay] relaying signed meta-transactions ${JSON.stringify(bundle)}`)

    const data = await encodeBundleExecData(bundle)
    const metaTxn = await this.service.sendMetaTxn({
      call: {
        walletAddress: bundle.intent.wallet,
        contract: bundle.entrypoint,
        input: data
      }
    })

    logger.info(`[rpc-relayer/relay] got relay result ${JSON.stringify(metaTxn)}`)

    return this.wait(metaTxn.txnHash)
  }

  async wait(metaTxnHash: string | TransactionBundle, wait: number = 1000): Promise<TransactionResponse<RelayerTxReceipt>> {
    const { receipt } = await this.waitReceipt(metaTxnHash, wait)

    if (!receipt.txnReceipt || FAILED_STATUSES.includes(receipt.status as proto.ETHTxnStatus)) {
      throw new MetaTransactionResponseException(receipt)
    }

    const txReceipt = JSON.parse(receipt.txnReceipt) as RelayerTxReceipt

    return {
      blockHash: txReceipt.blockHash,
      blockNumber: ethers.BigNumber.from(txReceipt.blockNumber).toNumber(),
      confirmations: 1,
      from: typeof metaTxnHash === 'string' ? undefined : metaTxnHash.intent.wallet,
      hash: txReceipt.transactionHash,
      raw: receipt.txnReceipt,
      receipt: txReceipt, // extended type which is Sequence-specific. Contains the decoded metaTxReceipt
      wait: async (confirmations?: number) => this.provider!.waitForTransaction(txReceipt.transactionHash, confirmations)
    } as TransactionResponse
  }
}

class MetaTransactionResponseException {
  constructor(public receipt: proto.MetaTxnReceipt) {}
}

export type RelayerTxReceipt = {
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
