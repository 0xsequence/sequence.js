import { ethers } from 'ethers'
import { FeeOption, FeeQuote, Relayer, SimulateResult } from '..'
import * as proto from './relayer.gen'
import { commons } from '@0xsequence/core'
import { bigintReplacer, getFetchRequest, logger, toHexString } from '@0xsequence/utils'

export { proto }

const FINAL_STATUSES = [
  proto.ETHTxnStatus.DROPPED,
  proto.ETHTxnStatus.SUCCEEDED,
  proto.ETHTxnStatus.PARTIALLY_FAILED,
  proto.ETHTxnStatus.FAILED
]

const FAILED_STATUSES = [proto.ETHTxnStatus.DROPPED, proto.ETHTxnStatus.PARTIALLY_FAILED, proto.ETHTxnStatus.FAILED]

export interface RpcRelayerOptions {
  provider: ethers.AbstractProvider | { url: string }
  url: string
  projectAccessKey?: string
  jwtAuth?: string
}

export function isRpcRelayerOptions(obj: any): obj is RpcRelayerOptions {
  return obj.url !== undefined && typeof obj.url === 'string' && obj.provider !== undefined && isAbstractProvider(obj.provider)
}

// TODO: rename to SequenceRelayer
export class RpcRelayer implements Relayer {
  private readonly service: proto.Relayer
  public readonly provider: ethers.Provider

  constructor(public options: RpcRelayerOptions) {
    this.service = new proto.Relayer(options.url, this._fetch)

    if (isAbstractProvider(options.provider)) {
      this.provider = options.provider
    } else {
      const { jwtAuth, projectAccessKey } = this.options
      const fetchRequest = getFetchRequest(options.provider.url, projectAccessKey, jwtAuth)
      this.provider = new ethers.JsonRpcProvider(fetchRequest, undefined, { staticNetwork: true })
    }
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // automatically include jwt and access key auth header to requests
    // if its been set on the api client
    const headers: { [key: string]: any } = {}

    const { jwtAuth, projectAccessKey } = this.options

    if (jwtAuth && jwtAuth.length > 0) {
      headers['Authorization'] = `BEARER ${jwtAuth}`
    }

    if (projectAccessKey && projectAccessKey.length > 0) {
      headers['X-Access-Key'] = projectAccessKey
    }

    // before the request is made
    init!.headers = { ...headers, ...init!.headers }

    return fetch(input, init)
  }

  async waitReceipt(
    metaTxnId: string | commons.transaction.SignedTransactionBundle,
    delay: number = 1000,
    maxFails: number = 5,
    isCancelled?: () => boolean
  ): Promise<proto.GetMetaTxnReceiptReturn> {
    if (typeof metaTxnId !== 'string') {
      metaTxnId = commons.transaction.intendedTransactionID(metaTxnId)
    }

    logger.info(`[rpc-relayer/waitReceipt] waiting for ${metaTxnId}`)

    let fails = 0

    while (isCancelled === undefined || !isCancelled()) {
      try {
        const { receipt } = await this.service.getMetaTxnReceipt({ metaTxID: metaTxnId })

        if (
          receipt &&
          receipt.txnReceipt &&
          receipt.txnReceipt !== 'null' &&
          FINAL_STATUSES.includes(receipt.status as proto.ETHTxnStatus)
        ) {
          return { receipt }
        }
      } catch (e) {
        fails++

        if (fails === maxFails) {
          throw e
        }
      }

      if (isCancelled === undefined || !isCancelled()) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error(`Cancelled waiting for transaction receipt ${metaTxnId}`)
  }

  async simulate(wallet: string, ...transactions: commons.transaction.Transaction[]): Promise<SimulateResult[]> {
    const coder = ethers.AbiCoder.defaultAbiCoder()
    const encoded = coder.encode(
      [commons.transaction.MetaTransactionsType],
      [commons.transaction.sequenceTxAbiEncode(transactions)]
    )
    return (await this.service.simulate({ wallet, transactions: encoded })).results
  }

  async getFeeOptions(
    address: string,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    // NOTE/TODO: for a given `service` the feeTokens will not change between execution, so we should memoize this value
    // for a short-period of time, perhaps for 1 day or in memory. Perhaps one day we can make this happen automatically
    // with http cache response for this endpoint and service-worker.. lots of approaches
    const feeTokens = await this.service.feeTokens()

    if (feeTokens.isFeeRequired) {
      const symbols = feeTokens.tokens.map(token => token.symbol).join(', ')
      logger.info(`[rpc-relayer/getFeeOptions] relayer fees are required, accepted tokens are ${symbols}`)

      const nonce = await this.getNonce(address)

      if (!this.provider) {
        logger.warn(`[rpc-relayer/getFeeOptions] provider not set, needed for stub signature`)
        throw new Error('provider is not set')
      }

      const { options, quote } = await this.service.feeOptions({
        wallet: address,
        to: address,
        data: commons.transaction.encodeBundleExecData({
          entrypoint: address,
          transactions,
          nonce
        })
      })

      logger.info(`[rpc-relayer/getFeeOptions] got refund options ${JSON.stringify(options, bigintReplacer)}`)
      return { options, quote: { _tag: 'FeeQuote', _quote: quote } }
    } else {
      logger.info(`[rpc-relayer/getFeeOptions] relayer fees are not required`)
      return { options: [] }
    }
  }

  async getFeeOptionsRaw(
    entrypoint: string,
    data: ethers.BytesLike,
    options?: {
      simulate?: boolean
      projectAccessKey?: string
    }
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    const { options: feeOptions, quote } = await this.service.feeOptions(
      {
        wallet: entrypoint,
        to: entrypoint,
        data: ethers.hexlify(data),
        simulate: options?.simulate
      },
      { ...(options?.projectAccessKey ? { 'X-Access-Key': options.projectAccessKey } : undefined) }
    )

    return { options: feeOptions, quote: { _tag: 'FeeQuote', _quote: quote } }
  }

  async gasRefundOptions(address: string, ...transactions: commons.transaction.Transaction[]): Promise<FeeOption[]> {
    const { options } = await this.getFeeOptions(address, ...transactions)
    return options
  }

  async getNonce(address: string, space?: ethers.BigNumberish): Promise<ethers.BigNumberish> {
    logger.info(`[rpc-relayer/getNonce] get nonce for wallet ${address} space: ${space}`)
    const encodedNonce = space !== undefined ? toHexString(BigInt(space)) : undefined
    const resp = await this.service.getMetaTxnNonce({ walletContractAddress: address, space: encodedNonce })
    const nonce = BigInt(resp.nonce)
    const [decodedSpace, decodedNonce] = commons.transaction.decodeNonce(nonce)
    logger.info(`[rpc-relayer/getNonce] got next nonce for wallet ${address} ${decodedNonce} space: ${decodedSpace}`)
    return nonce
  }

  async relay(
    signedTxs: commons.transaction.IntendedTransactionBundle,
    quote?: FeeQuote,
    waitForReceipt: boolean = true,
    projectAccessKey?: string
  ): Promise<commons.transaction.TransactionResponse<RelayerTxReceipt>> {
    logger.info(
      `[rpc-relayer/relay] relaying signed meta-transactions ${JSON.stringify(signedTxs, bigintReplacer)} with quote ${JSON.stringify(quote, bigintReplacer)}`
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

    const data = commons.transaction.encodeBundleExecData(signedTxs)
    const metaTxn = await this.service.sendMetaTxn(
      {
        call: {
          walletAddress: signedTxs.intent.wallet,
          contract: signedTxs.entrypoint,
          input: data
        },
        quote: typecheckedQuote
      },
      { ...(projectAccessKey ? { 'X-Access-Key': projectAccessKey } : undefined) }
    )

    logger.info(`[rpc-relayer/relay] got relay result ${JSON.stringify(metaTxn, bigintReplacer)}`)

    if (waitForReceipt) {
      return this.wait(signedTxs.intent.id)
    } else {
      const response = {
        hash: signedTxs.intent.id,
        confirmations: 0,
        from: signedTxs.intent.wallet,
        wait: (_confirmations?: number): Promise<ethers.TransactionReceipt | null> => Promise.reject(new Error('impossible'))
      }

      const wait = async (confirmations?: number): Promise<ethers.TransactionReceipt | null> => {
        if (!this.provider) {
          throw new Error('cannot wait for receipt, relayer has no provider set')
        }

        const waitResponse = await this.wait(signedTxs.intent.id)
        const transactionHash = waitResponse.receipt?.transactionHash

        if (!transactionHash) {
          throw new Error('cannot wait for receipt, unknown native transaction hash')
        }

        Object.assign(response, waitResponse)

        return this.provider.waitForTransaction(transactionHash, confirmations)
      }

      response.wait = wait

      // NOTE: we just ignore these errors which come from the private fields
      // of ethers-v6 .. but, we should probably rework this instead..
      // @ts-ignore
      return response as commons.transaction.TransactionResponse
    }
  }

  async wait(
    metaTxnId: string | commons.transaction.SignedTransactionBundle,
    timeout?: number,
    delay: number = 1000,
    maxFails: number = 5
  ): Promise<commons.transaction.TransactionResponse<RelayerTxReceipt>> {
    let timedOut = false

    const { receipt } = await (timeout !== undefined
      ? Promise.race([
          this.waitReceipt(metaTxnId, delay, maxFails, () => timedOut),
          new Promise<proto.GetMetaTxnReceiptReturn>((_, reject) =>
            setTimeout(() => {
              timedOut = true
              reject(`Timeout waiting for transaction receipt ${metaTxnId}`)
            }, timeout)
          )
        ])
      : this.waitReceipt(metaTxnId, delay, maxFails))

    if (!receipt.txnReceipt || FAILED_STATUSES.includes(receipt.status as proto.ETHTxnStatus)) {
      throw new MetaTransactionResponseException(receipt)
    }

    const txReceipt = JSON.parse(receipt.txnReceipt) as RelayerTxReceipt

    // NOTE: we just ignore these errors which come from the private fields
    // of ethers-v6 .. but, we should probably rework this instead..
    // @ts-ignore
    return {
      blockHash: txReceipt.blockHash,
      blockNumber: Number(txReceipt.blockNumber),
      confirmations: 1,
      from: typeof metaTxnId === 'string' ? undefined : metaTxnId.intent.wallet,
      hash: txReceipt.transactionHash,
      raw: receipt.txnReceipt,
      receipt: txReceipt, // extended type which is Sequence-specific. Contains the decoded metaTxReceipt
      wait: async (confirmations?: number) => this.provider!.waitForTransaction(txReceipt.transactionHash, confirmations)
    } as commons.transaction.TransactionResponse
  }

  async getMetaTransactions(
    projectId: number,
    page?: proto.Page
  ): Promise<{
    page: proto.Page
    transactions: proto.MetaTxnLog[]
  }> {
    return this.service.getMetaTransactions({ projectId, page })
  }

  async getTransactionCost(
    projectId: number,
    from: string,
    to: string
  ): Promise<{
    cost: number
  }> {
    return this.service.getTransactionCost({ projectId, from, to })
  }

  async listGasSponsors(args: proto.ListGasSponsorsArgs): Promise<proto.ListGasSponsorsReturn> {
    return this.service.listGasSponsors(args)
  }

  async addGasSponsor(args: proto.AddGasSponsorArgs): Promise<proto.AddGasSponsorReturn> {
    return this.service.addGasSponsor(args)
  }

  async updateGasSponsor(args: proto.UpdateGasSponsorArgs): Promise<proto.UpdateGasSponsorReturn> {
    return this.service.updateGasSponsor(args)
  }

  async removeGasSponsor(args: proto.RemoveGasSponsorArgs): Promise<proto.RemoveGasSponsorReturn> {
    return this.service.removeGasSponsor(args)
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

function isAbstractProvider(provider: any): provider is ethers.AbstractProvider {
  return (
    provider &&
    typeof provider === 'object' &&
    typeof provider.getNetwork === 'function' &&
    typeof provider.getBlockNumber === 'function'
  )
}
