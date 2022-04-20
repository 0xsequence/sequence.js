import { ethers } from 'ethers'
import fetchPonyfill from 'fetch-ponyfill'
import { walletContracts } from '@0xsequence/abi'
import {
  Transaction,
  readSequenceNonce,
  appendNonce,
  MetaTransactionsType,
  sequenceTxAbiEncode,
  SignedTransactions,
  computeMetaTxnHash,
  decodeNonce,
  TransactionResponse
} from '@0xsequence/transactions'
import { BaseRelayer, BaseRelayerOptions } from '../base-relayer'
import { FeeOption, FeeQuote, Relayer, SimulateResult } from '..'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, buildStubSignature } from '@0xsequence/config'
import { logger } from '@0xsequence/utils'
import * as proto from './relayer.gen'

export { proto }

const FAILED_STATUSES = [proto.ETHTxnStatus.FAILED, proto.ETHTxnStatus.PARTIALLY_FAILED, proto.ETHTxnStatus.DROPPED]

export interface RpcRelayerOptions extends BaseRelayerOptions {
  url: string
}

export function isRpcRelayerOptions(obj: any): obj is RpcRelayerOptions {
  return obj.url !== undefined && typeof obj.url === 'string'
}

export class RpcRelayer extends BaseRelayer implements Relayer {
  private readonly service: proto.Relayer

  constructor(options: RpcRelayerOptions) {
    super(options)
    this.service = new proto.Relayer(options.url, fetchPonyfill().fetch)
  }

  async waitReceipt(metaTxnHash: string | SignedTransactions, wait: number = 1000): Promise<proto.GetMetaTxnReceiptReturn> {
    if (typeof metaTxnHash !== 'string') {
      logger.info('computing id', metaTxnHash.config, metaTxnHash.context, metaTxnHash.chainId, ...metaTxnHash.transactions)
      return this.waitReceipt(
        computeMetaTxnHash(addressOf(metaTxnHash.config, metaTxnHash.context), metaTxnHash.chainId, ...metaTxnHash.transactions)
      )
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

  async simulate(wallet: string, ...transactions: Transaction[]): Promise<SimulateResult[]> {
    const coder = ethers.utils.defaultAbiCoder
    const encoded = coder.encode([MetaTransactionsType], [sequenceTxAbiEncode(transactions)])
    return (await this.service.simulate({ wallet, transactions: encoded })).results
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
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    // NOTE/TODO: for a given `service` the feeTokens will not change between execution, so we should memoize this value
    // for a short-period of time, perhaps for 1 day or in memory. Perhaps one day we can make this happen automatically
    // with http cache response for this endpoint and service-worker.. lots of approaches
    const feeTokens = await this.service.feeTokens()

    if (feeTokens.isFeeRequired) {
      const symbols = feeTokens.tokens.map(token => token.symbol).join(', ')
      logger.info(`[rpc-relayer/getFeeOptions] relayer fees are required, accepted tokens are ${symbols}`)

      const wallet = addressOf(config, context)

      let nonce = readSequenceNonce(...transactions)
      if (nonce === undefined) {
        nonce = await this.getNonce(config, context)
      }

      if (!this.provider) {
        logger.warn(`[rpc-relayer/getFeeOptions] provider not set, needed for stub signature`)
        throw new Error('provider is not set')
      }

      const { to, execute } = await this.prependWalletDeploy({
        config,
        context,
        transactions,
        nonce,
        signature: buildStubSignature(this.provider, config)
      })

      const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
      const data = walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
        sequenceTxAbiEncode(execute.transactions),
        execute.nonce,
        execute.signature
      ])

      const { options, quote } = await this.service.feeOptions({ wallet, to, data })

      logger.info(`[rpc-relayer/getFeeOptions] got refund options ${JSON.stringify(options)}`)
      return { options, quote: { _tag: 'FeeQuote', _quote: quote } }
    } else {
      logger.info(`[rpc-relayer/getFeeOptions] relayer fees are not required`)
      return { options: [] }
    }
  }

  async gasRefundOptions(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<FeeOption[]> {
    const { options } = await this.getFeeOptions(config, context, ...transactions)
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

  async relay(signedTxs: SignedTransactions, quote?: FeeQuote): Promise<TransactionResponse> {
    logger.info(
      `[rpc-relayer/relay] relaying signed meta-transactions ${JSON.stringify(signedTxs)} with quote ${JSON.stringify(quote)}`
    )

    let typecheckedQuote: string | undefined
    if (quote !== undefined) {
      if (typeof quote._quote === 'string') {
        typecheckedQuote = quote._quote
      } else {
        logger.warn('[rpc-relayer/relay] ignoring invalid fee quote')
      }
    }

    if (!this.provider) {
      logger.warn(`[rpc-relayer/relay] provider not set, failed relay`)
      throw new Error('provider is not set')
    }

    const { to: contract, execute } = await this.prependWalletDeploy(signedTxs)

    const walletAddress = addressOf(signedTxs.config, signedTxs.context)
    const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
    const input = walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
      sequenceTxAbiEncode(execute.transactions),
      execute.nonce,
      execute.signature
    ])

    const metaTxn = await this.service.sendMetaTxn({ call: { walletAddress, contract, input }, quote: typecheckedQuote })

    logger.info(`[rpc-relayer/relay] got relay result ${JSON.stringify(metaTxn)}`)

    return this.wait(metaTxn.txnHash)
  }

  async wait(metaTxnHash: string | SignedTransactions, wait: number = 1000): Promise<TransactionResponse<RelayerTxReceipt>> {
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
