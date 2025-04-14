import { ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { FeeOption, FeeQuote, proto, Relayer, SimulateResult } from '.'
import { logger, Optionals } from '@0xsequence/utils'
import { commons } from '@0xsequence/core'

const DEFAULT_GAS_LIMIT = 800000n

export interface ProviderRelayerOptions {
  provider: ethers.Provider
  waitPollRate?: number
  deltaBlocksLog?: number
  fromBlockLog?: number
}

export const ProviderRelayerDefaults: Required<Optionals<ProviderRelayerOptions>> = {
  waitPollRate: 1000,
  deltaBlocksLog: 12,
  fromBlockLog: -1024
}

export function isProviderRelayerOptions(obj: any): obj is ProviderRelayerOptions {
  return typeof obj === 'object' && isAbstractProvider(obj.provider)
}

export abstract class ProviderRelayer implements Relayer {
  public provider: ethers.Provider
  public waitPollRate: number
  public deltaBlocksLog: number
  public fromBlockLog: number

  constructor(options: ProviderRelayerOptions) {
    const opts = { ...ProviderRelayerDefaults, ...options }

    this.provider = opts.provider
    this.waitPollRate = opts.waitPollRate
    this.deltaBlocksLog = opts.deltaBlocksLog
    this.fromBlockLog = opts.fromBlockLog
  }

  abstract getFeeOptions(
    address: string,
    ...transactions: commons.transaction.Transaction[]
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  abstract getFeeOptionsRaw(
    entrypoint: string,
    data: ethers.BytesLike,
    options?: {
      simulate?: boolean
    }
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  abstract gasRefundOptions(address: string, ...transactions: commons.transaction.Transaction[]): Promise<FeeOption[]>

  abstract relay(
    signedTxs: commons.transaction.IntendedTransactionBundle,
    quote?: FeeQuote,
    waitForReceipt?: boolean
  ): Promise<commons.transaction.TransactionResponse>

  abstract getTransactionCost(
    projectId: number,
    from: string,
    to: string
  ): Promise<{
    cost: number
  }>

  abstract getMetaTransactions(
    projectId: number,
    page?: proto.Page
  ): Promise<{
    page: proto.Page
    transactions: proto.MetaTxnLog[]
  }>

  abstract listGasSponsors(args: proto.ListGasSponsorsArgs): Promise<proto.ListGasSponsorsReturn>

  abstract addGasSponsor(args: proto.AddGasSponsorArgs): Promise<proto.AddGasSponsorReturn>

  abstract updateGasSponsor(args: proto.UpdateGasSponsorArgs): Promise<proto.UpdateGasSponsorReturn>

  abstract removeGasSponsor(args: proto.RemoveGasSponsorArgs): Promise<proto.RemoveGasSponsorReturn>

  async simulate(wallet: string, ...transactions: commons.transaction.Transaction[]): Promise<SimulateResult[]> {
    return (
      await Promise.all(
        transactions.map(async tx => {
          // Respect gasLimit request of the transaction (as long as its not 0)
          if (tx.gasLimit && BigInt(tx.gasLimit || 0) !== 0n) {
            return tx.gasLimit
          }

          // Fee can't be estimated locally for delegateCalls
          if (tx.delegateCall) {
            return DEFAULT_GAS_LIMIT
          }

          // Fee can't be estimated for self-called if wallet hasn't been deployed
          if (tx.to === wallet && (await this.provider.getCode(wallet).then(code => ethers.getBytes(code).length === 0))) {
            return DEFAULT_GAS_LIMIT
          }

          if (!this.provider) {
            throw new Error('signer.provider is not set, but is required')
          }

          // TODO: If the wallet address has been deployed, gas limits can be
          // estimated with more accurately by using self-calls with the batch transactions one by one
          return this.provider.estimateGas({
            from: wallet,
            to: tx.to,
            data: tx.data,
            value: tx.value
          })
        })
      )
    ).map(gasLimit => ({
      executed: true,
      succeeded: true,
      gasUsed: Number(gasLimit),
      gasLimit: Number(gasLimit)
    }))
  }

  async getNonce(address: string, space?: ethers.BigNumberish, blockTag?: ethers.BlockTag): Promise<ethers.BigNumberish> {
    if (!this.provider) {
      throw new Error('provider is not set')
    }

    if ((await this.provider.getCode(address)) === '0x') {
      return 0
    }

    if (space === undefined) {
      space = 0
    }

    const module = new ethers.Contract(address, walletContracts.mainModule.abi, this.provider)
    const nonce = await module.readNonce(space, { blockTag: blockTag })
    return commons.transaction.encodeNonce(space, nonce)
  }

  async wait(
    metaTxnId: string | commons.transaction.SignedTransactionBundle,
    timeoutDuration?: number,
    delay: number = this.waitPollRate,
    maxFails: number = 5
  ): Promise<ethers.TransactionResponse & { receipt: ethers.TransactionReceipt }> {
    if (typeof metaTxnId !== 'string') {
      metaTxnId = commons.transaction.intendedTransactionID(metaTxnId)
    }

    let timedOut = false

    const retry = async <T>(f: () => Promise<T>, errorMessage: string): Promise<T> => {
      let fails = 0

      while (!timedOut) {
        try {
          return await f()
        } catch (error) {
          fails++

          if (maxFails !== undefined && fails >= maxFails) {
            logger.error(`giving up after ${fails} failed attempts${errorMessage ? `: ${errorMessage}` : ''}`, error)
            throw error
          } else {
            logger.warn(`attempt #${fails} failed${errorMessage ? `: ${errorMessage}` : ''}`, error)
          }
        }

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw new Error(`timed out after ${fails} failed attempts${errorMessage ? `: ${errorMessage}` : ''}`)
    }

    const waitReceipt = async (): Promise<ethers.TransactionResponse & { receipt: ethers.TransactionReceipt }> => {
      // Transactions can only get executed on nonce change
      // get all nonce changes and look for metaTxnIds in between logs
      let lastBlock: number = this.fromBlockLog

      if (lastBlock < 0) {
        const block = await retry(() => this.provider.getBlockNumber(), 'unable to get latest block number')
        lastBlock = block + lastBlock
      }

      if (typeof metaTxnId !== 'string') {
        throw new Error('impossible')
      }

      const normalMetaTxnId = metaTxnId.replace('0x', '')

      while (!timedOut) {
        const block = await retry(() => this.provider.getBlockNumber(), 'unable to get latest block number')

        const logs = await retry(
          () =>
            this.provider.getLogs({
              fromBlock: Math.max(0, lastBlock - this.deltaBlocksLog),
              toBlock: block,
              // Nonce change event topic
              topics: ['0x1f180c27086c7a39ea2a7b25239d1ab92348f07ca7bb59d1438fcf527568f881']
            }),
          `unable to get NonceChange logs for blocks ${Math.max(0, lastBlock - this.deltaBlocksLog)} to ${block}`
        )

        lastBlock = block

        // Get receipts of all transactions
        const txs = await Promise.all(
          logs.map(l =>
            retry(
              () => this.provider.getTransactionReceipt(l.transactionHash),
              `unable to get receipt for transaction ${l.transactionHash}`
            )
          )
        )

        // Find a transaction with a TxExecuted log
        const found = txs.find(tx =>
          tx?.logs.find(
            l =>
              (l.topics.length === 0 && l.data.replace('0x', '') === normalMetaTxnId) ||
              (l.topics.length === 1 &&
                // TxFailed event topic
                l.topics[0] === '0x3dbd1590ea96dd3253a91f24e64e3a502e1225d602a5731357bc12643070ccd7' &&
                l.data.length >= 64 &&
                l.data.replace('0x', '').startsWith(normalMetaTxnId))
          )
        )

        // If found return that
        if (found) {
          const response = await retry(() => this.provider.getTransaction(found.hash), `unable to get transaction ${found.hash}`)
          if (!response) {
            throw new Error(`Transaction response not found for  ${metaTxnId}`)
          }

          // NOTE: we have to do this, because ethers-v6 uses private fields
          // and we can't just extend the class and override the method, so
          // we just modify the response object directly by adding the receipt to it.
          const out: any = response
          out.receipt = found
          return out
        }

        // Otherwise wait and try again
        if (!timedOut) {
          await new Promise(r => setTimeout(r, delay))
        }
      }

      throw new Error(`Timeout waiting for transaction receipt ${metaTxnId}`)
    }

    if (timeoutDuration !== undefined) {
      return Promise.race([
        waitReceipt(),
        new Promise<ethers.TransactionResponse & { receipt: ethers.TransactionReceipt }>((_, reject) =>
          setTimeout(() => {
            timedOut = true
            reject(`Timeout waiting for transaction receipt ${metaTxnId}`)
          }, timeoutDuration)
        )
      ])
    } else {
      return waitReceipt()
    }
  }
}

function isAbstractProvider(provider: any): provider is ethers.AbstractProvider {
  return (
    provider &&
    typeof provider === 'object' &&
    typeof provider.getNetwork === 'function' &&
    typeof provider.getBlockNumber === 'function'
  )
}
