import { TransactionResponse, Provider, BlockTag } from '@ethersproject/providers'
import { ethers } from 'ethers'
import fetchPonyfill from 'fetch-ponyfill'
import {
  Transaction,
  TransactionEncoded,
  readSequenceNonce,
  appendNonce,
  MetaTransactionsType,
  sequenceTxAbiEncode,
  SignedTransactions
} from '@0xsequence/transactions'
import { BaseRelayer } from './base-relayer'
import { ChaindService } from '@0xsequence/chaind'
import { Relayer } from '.'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { logger } from '@0xsequence/utils'

export class RpcRelayer extends BaseRelayer implements Relayer {
  private readonly chaindService: ChaindService

  constructor(url: string, bundleDeploy: boolean = true, provider?: Provider, waitForReceipt: boolean = true) {
    super(bundleDeploy, provider)
    this.chaindService = new ChaindService(url, fetchPonyfill().fetch)
  }

  async waitReceipt(metaTxHash: string, wait: number = 500) {
    let result = await this.chaindService.getMetaTxnReceipt({ metaTxID: metaTxHash })

    while ((!result.receipt.txnReceipt || result.receipt.txnReceipt === 'null') && result.receipt.status === 'UNKNOWN') {
      await new Promise(r => setTimeout(r, wait))
      result = await this.chaindService.getMetaTxnReceipt({ metaTxID: metaTxHash })
    }

    // "FAILED" is reserved for when the tx is invalid and never dispatched by remote relayer
    if (result.receipt.status == 'FAILED') {
      throw new Error(result.receipt.revertReason)
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
    const res = await this.chaindService.updateMetaTxnGasLimits({
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

  async gasRefundOptions(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<Transaction[][]> {
    // chaind only supports refunds on a single token
    // TODO: Add compatiblity for different refund options
    const tokenFee = await this.chaindService.tokenFee()

    logger.info(`[rpc-relayer/gasRefundOptions] using token fee ${JSON.stringify(tokenFee)}`)

    // No gas refund required
    if (!tokenFee.isFee || tokenFee.fee === ethers.constants.AddressZero) {
      return [[]]
    }

    const addr = addressOf(config, context)
    const prevNonce = readSequenceNonce(...transactions)

    // Set temporal nonce to simulate meta-txn
    if (prevNonce === undefined) {
      transactions = appendNonce(transactions, await this.getNonce(config, context))
    }

    const coder = ethers.utils.defaultAbiCoder
    const encoded = coder.encode([MetaTransactionsType], [sequenceTxAbiEncode(transactions)])
    const res = await this.chaindService.getMetaTxnNetworkFeeOptions({
      walletAddress: addr,
      payload: encoded,
      signers: config.signers.length
    })

    let decoded: Transaction[][]
    if (prevNonce === undefined) {
      decoded = res.options.map(option =>
        coder.decode([MetaTransactionsType], option)[0].map((txn: TransactionEncoded) => ({
          ...txn,
          to: txn.target
        }))
      )
    } else {
      decoded = res.options.map(option =>
        coder.decode([MetaTransactionsType], option)[0].map((txn: TransactionEncoded) => ({
          ...txn,
          to: txn.target,
          nonce: prevNonce
        }))
      )
    }

    logger.info(`[rpc-relayer/gasRefundOptions] got refund options ${JSON.stringify(decoded)}`)

    return decoded
  }

  async getNonce(config: WalletConfig, context: WalletContext, space?: number, blockTag?: BlockTag): Promise<number> {
    const addr = addressOf(config, context)
    logger.info(`[rpc-relayer/getNonce] get nonce for wallet ${addr} space: ${space}`)
    const resp = await this.chaindService.getMetaTxnNonce({ walletContractAddress: addr })
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
    const metaTxn = await this.chaindService.sendMetaTxn({
      call: {
        contract: prep.to,
        input: prep.data
      }
    })

    logger.warn(`[rpc-relayer/relay] got relay result ${JSON.stringify(metaTxn)}`)

    const { receipt } = await this.waitReceipt(metaTxn.txnHash)
    const txReceipt = JSON.parse(receipt.txnReceipt) as RelayerTxReceipt

    return {
      blockHash: txReceipt.blockHash,
      blockNumber: ethers.BigNumber.from(txReceipt.blockNumber).toNumber(),
      confirmations: 1,
      from: addressOf(signedTxs.config, signedTxs.context),
      hash: txReceipt.transactionHash,
      raw: receipt.txnReceipt,
      wait: async (confirmations?: number) => this.provider!.waitForTransaction(txReceipt.transactionHash, confirmations)
    } as TransactionResponse
  }
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
