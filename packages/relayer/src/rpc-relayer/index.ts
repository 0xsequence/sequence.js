import { ethers } from 'ethers'
import { FeeOption, FeeQuote, Relayer, SimulateResult } from '..'
import * as proto from './relayer.gen'
import { commons } from '@0xsequence/core'

export { proto }

const FINAL_STATUSES = [
  proto.ETHTxnStatus.DROPPED,
  proto.ETHTxnStatus.SUCCEEDED,
  proto.ETHTxnStatus.PARTIALLY_FAILED,
  proto.ETHTxnStatus.FAILED
]

const FAILED_STATUSES = [proto.ETHTxnStatus.DROPPED, proto.ETHTxnStatus.PARTIALLY_FAILED, proto.ETHTxnStatus.FAILED]

export interface RpcRelayerOptions {
  url: string
}

export function isRpcRelayerOptions(obj: any): obj is RpcRelayerOptions {
  return obj.url !== undefined && typeof obj.url === 'string'
}

export class RpcRelayer implements Relayer {
  private readonly service: proto.Relayer

  constructor(options: RpcRelayerOptions) {
    this.service = new proto.Relayer(options.url, global.fetch)
  }

  async waitReceipt(
    metaTxnId: string | commons.transaction.SignedTransactionBundle,
    delay: number = 1000,
    maxFails: number = 5,
    isCancelled?: () => boolean
  ): Promise<proto.GetMetaTxnReceiptReturn> {
    throw new Error('not implemented')
    // if (typeof metaTxnId !== 'string') {
    //   logger.info('computing id', metaTxnId.config, metaTxnId.context, metaTxnId.chainId, ...metaTxnId.transactions)

    //   metaTxnId = computeMetaTxnHash(addressOf(metaTxnId.config, metaTxnId.context), metaTxnId.chainId, ...metaTxnId.transactions)
    // }

    // logger.info(`[rpc-relayer/waitReceipt] waiting for ${metaTxnId}`)

    // let fails = 0

    // while (isCancelled === undefined || !isCancelled()) {
    //   try {
    //     const { receipt } = await this.service.getMetaTxnReceipt({ metaTxID: metaTxnId })

    //     if (
    //       receipt &&
    //       receipt.txnReceipt &&
    //       receipt.txnReceipt !== 'null' &&
    //       FINAL_STATUSES.includes(receipt.status as proto.ETHTxnStatus)
    //     ) {
    //       return { receipt }
    //     }
    //   } catch (e) {
    //     fails++

    //     if (fails === maxFails) {
    //       throw e
    //     }
    //   }

    //   if (isCancelled === undefined || !isCancelled()) {
    //     await new Promise(resolve => setTimeout(resolve, delay))
    //   }
    // }

    // throw new Error(`Cancelled waiting for transaction receipt ${metaTxnId}`)
  }

  async simulate(wallet: string, ...transactions: commons.transaction.Transaction[]): Promise<SimulateResult[]> {
    const coder = ethers.utils.defaultAbiCoder
    const encoded = coder.encode([commons.transaction.MetaTransactionsType], [commons.transaction.sequenceTxAbiEncode(transactions)])
    return (await this.service.simulate({ wallet, transactions: encoded })).results
  }

  async getFeeOptions(
    config: commons.config.Config,
    context: commons.context.WalletContext,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    throw new Error('not implemented')
    // // NOTE/TODO: for a given `service` the feeTokens will not change between execution, so we should memoize this value
    // // for a short-period of time, perhaps for 1 day or in memory. Perhaps one day we can make this happen automatically
    // // with http cache response for this endpoint and service-worker.. lots of approaches
    // const feeTokens = await this.service.feeTokens()

    // if (feeTokens.isFeeRequired) {
    //   const symbols = feeTokens.tokens.map(token => token.symbol).join(', ')
    //   logger.info(`[rpc-relayer/getFeeOptions] relayer fees are required, accepted tokens are ${symbols}`)

    //   const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
    //   const wallet = commons.context.addressOf(context, imageHash)

    //   let nonce = commons.transaction.readSequenceNonce(...transactions)
    //   if (nonce === undefined) {
    //     nonce = await this.getNonce(config, context)
    //   }

    //   if (!this.provider) {
    //     logger.warn(`[rpc-relayer/getFeeOptions] provider not set, needed for stub signature`)
    //     throw new Error('provider is not set')
    //   }

    //   const { to, execute } = await this.prependWalletDeploy({
    //     config,
    //     context,
    //     transactions,
    //     nonce,
    //     signature: buildStubSignature(this.provider, config)
    //   })

    //   const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
    //   const data = walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
    //     sequenceTxAbiEncode(execute.transactions),
    //     execute.nonce,
    //     execute.signature
    //   ])

    //   const { options, quote } = await this.service.feeOptions({ wallet, to, data })

    //   logger.info(`[rpc-relayer/getFeeOptions] got refund options ${JSON.stringify(options)}`)
    //   return { options, quote: { _tag: 'FeeQuote', _quote: quote } }
    // } else {
    //   logger.info(`[rpc-relayer/getFeeOptions] relayer fees are not required`)
    //   return { options: [] }
    // }
  }

  async gasRefundOptions(config: commons.config.Config, context: commons.context.WalletContext, ...transactions: commons.transaction.Transaction[]): Promise<FeeOption[]> {
    throw new Error('not implemented')
    // const { options } = await this.getFeeOptions(config, context, ...transactions)
    // return options
  }

  async getNonce(config: commons.config.Config, context: commons.context.WalletContext, space?: ethers.BigNumberish): Promise<ethers.BigNumberish> {
    throw new Error('not implemented')
    // const addr = addressOf(config, context)
    // logger.info(`[rpc-relayer/getNonce] get nonce for wallet ${addr} space: ${space}`)
    // const encodedNonce = space !== undefined ? ethers.BigNumber.from(space).toHexString() : undefined
    // const resp = await this.service.getMetaTxnNonce({ walletContractAddress: addr, space: encodedNonce })
    // const nonce = ethers.BigNumber.from(resp.nonce)
    // const [decodedSpace, decodedNonce] = decodeNonce(nonce)
    // logger.info(`[rpc-relayer/getNonce] got next nonce for wallet ${addr} ${decodedNonce} space: ${decodedSpace}`)
    // return nonce
  }

  async relay(
    signedTxs: commons.transaction.IntendedTransactionBundle,
    quote?: FeeQuote,
    waitForReceipt: boolean = true
  ): Promise<commons.transaction.TransactionResponse<RelayerTxReceipt>> {
    throw new Error('not implemented')

    // logger.info(
    //   `[rpc-relayer/relay] relaying signed meta-transactions ${JSON.stringify(signedTxs)} with quote ${JSON.stringify(quote)}`
    // )

    // let typecheckedQuote: string | undefined
    // if (quote !== undefined) {
    //   if (typeof quote._quote === 'string') {
    //     typecheckedQuote = quote._quote
    //   } else {
    //     logger.warn('[rpc-relayer/relay] ignoring invalid fee quote')
    //   }
    // }

    // if (!this.provider) {
    //   logger.warn(`[rpc-relayer/relay] provider not set, failed relay`)
    //   throw new Error('provider is not set')
    // }

    // const { to: contract, execute } = await this.prependWalletDeploy(signedTxs)

    // const walletAddress = addressOf(signedTxs.config, signedTxs.context)
    // const walletInterface = new ethers.utils.Interface(walletContracts.mainModule.abi)
    // const input = walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
    //   sequenceTxAbiEncode(execute.transactions),
    //   execute.nonce,
    //   execute.signature
    // ])

    // const metaTxn = await this.service.sendMetaTxn({ call: { walletAddress, contract, input }, quote: typecheckedQuote })

    // logger.info(`[rpc-relayer/relay] got relay result ${JSON.stringify(metaTxn)}`)

    // if (waitForReceipt) {
    //   return this.wait(metaTxn.txnHash)
    // } else {
    //   const response = {
    //     hash: metaTxn.txnHash,
    //     confirmations: 0,
    //     from: walletAddress,
    //     wait: (_confirmations?: number): Promise<ethers.providers.TransactionReceipt> => Promise.reject(new Error('impossible'))
    //   }

    //   const wait = async (confirmations?: number): Promise<ethers.providers.TransactionReceipt> => {
    //     if (!this.provider) {
    //       throw new Error('cannot wait for receipt, relayer has no provider set')
    //     }

    //     const waitResponse = await this.wait(metaTxn.txnHash)
    //     const transactionHash = waitResponse.receipt?.transactionHash

    //     if (!transactionHash) {
    //       throw new Error('cannot wait for receipt, unknown native transaction hash')
    //     }

    //     Object.assign(response, waitResponse)

    //     return this.provider.waitForTransaction(transactionHash, confirmations)
    //   }

    //   response.wait = wait

    //   return response as TransactionResponse
    // }
  }

  async wait(
    metaTxnId: string | commons.transaction.SignedTransactionBundle,
    timeout?: number,
    delay: number = 1000,
    maxFails: number = 5
  ): Promise<commons.transaction.TransactionResponse<RelayerTxReceipt>> {
    throw new Error('not implemented')

    // let timedOut = false

    // const { receipt } = await (timeout !== undefined
    //   ? Promise.race([
    //       this.waitReceipt(metaTxnId, delay, maxFails, () => timedOut),
    //       new Promise<proto.GetMetaTxnReceiptReturn>((_, reject) =>
    //         setTimeout(() => {
    //           timedOut = true
    //           reject(`Timeout waiting for transaction receipt ${metaTxnId}`)
    //         }, timeout)
    //       )
    //     ])
    //   : this.waitReceipt(metaTxnId, delay, maxFails))

    // if (!receipt.txnReceipt || FAILED_STATUSES.includes(receipt.status as proto.ETHTxnStatus)) {
    //   throw new MetaTransactionResponseException(receipt)
    // }

    // const txReceipt = JSON.parse(receipt.txnReceipt) as RelayerTxReceipt

    // return {
    //   blockHash: txReceipt.blockHash,
    //   blockNumber: ethers.BigNumber.from(txReceipt.blockNumber).toNumber(),
    //   confirmations: 1,
    //   from: typeof metaTxnId === 'string' ? undefined : addressOf(metaTxnId.config, metaTxnId.context),
    //   hash: txReceipt.transactionHash,
    //   raw: receipt.txnReceipt,
    //   receipt: txReceipt, // extended type which is Sequence-specific. Contains the decoded metaTxReceipt
    //   wait: async (confirmations?: number) => this.provider!.waitForTransaction(txReceipt.transactionHash, confirmations)
    // } as TransactionResponse
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
