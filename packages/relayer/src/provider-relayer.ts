import { TransactionResponse, BlockTag, Provider } from '@ethersproject/providers'
import { ethers, providers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { encodeNonce, Transaction, TransactionBundle } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { FeeOption, Relayer, SimulateResult } from '.'
import { Optionals } from '@0xsequence/utils'

const DEFAULT_GAS_LIMIT = ethers.BigNumber.from(800000)

export interface ProviderRelayerOptions {
  provider: Provider,
  waitPollRate?: number,
  deltaBlocksLog?: number,
  fromBlockLog?: number
}

export const ProviderRelayerDefaults: Required<Optionals<ProviderRelayerOptions>> = {
  waitPollRate: 1000,
  deltaBlocksLog: 12,
  fromBlockLog: -1024
}

export function isProviderRelayerOptions(obj: any): obj is ProviderRelayerOptions {
  return obj.provider !== undefined && Provider.isProvider(obj.provider)
}

export abstract class ProviderRelayer implements Relayer {
  public provider: Provider
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

  abstract gasRefundOptions(config: WalletConfig, context: WalletContext, bundle: TransactionBundle): Promise<FeeOption[]>
  abstract relay(signedTxs: TransactionBundle): Promise<TransactionResponse>

  async simulate(wallet: string, entrypoint: string, ...transactions: Transaction[]): Promise<SimulateResult[]> {
    return (await Promise.all(transactions.map(async tx => {
      // Respect gasLimit request of the transaction (as long as its not 0)
      if (tx.gasLimit && !ethers.BigNumber.from(tx.gasLimit || 0).eq(ethers.constants.Zero)) {
        return tx.gasLimit
      }

      // Fee can't be estimated locally for delegateCalls
      if (tx.delegateCall) {
        return DEFAULT_GAS_LIMIT
      }
      
      // Fee can't be estimated for self-called if wallet hasn't been deployed
      if (tx.to === wallet && ethers.utils.arrayify((await this.provider.getCode(wallet))).length === 0) {
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
    }))).map(gasLimit => ({
      executed: true,
      succeeded: true,
      gasLimit: ethers.BigNumber.from(gasLimit).toNumber(),
      gasUsed: ethers.BigNumber.from(gasLimit).toNumber()
    }))
  }

  async estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<Transaction[]> {
    const walletAddr = addressOf(config, context)
    const results = await this.simulate(walletAddr, walletAddr, ...transactions)
    return transactions.map((t, i) => ({ ...t, gasLimit: results[i].gasLimit }))
  }

  async getNonce(
    config: WalletConfig,
    context: WalletContext,
    space?: ethers.BigNumberish,
    blockTag?: BlockTag
  ): Promise<ethers.BigNumberish> {
    if (!this.provider) {
      throw new Error('provider is not set')
    }

    const addr = addressOf(config, context)

    if ((await this.provider.getCode(addr)) === '0x') {
      return 0
    }

    if (space === undefined) {
      space = 0
    }

    const module = new ethers.Contract(addr, walletContracts.mainModule.abi, this.provider)
    const nonce = await module.readNonce(space, { blockTag: blockTag })
    return encodeNonce(space, nonce)
  }

  async wait(metaTxnId: string | TransactionBundle, timeout: number): Promise<providers.TransactionResponse & { receipt: providers.TransactionReceipt }> {
    if (typeof metaTxnId !== 'string') {
      return this.wait(metaTxnId.intent.digest, timeout)
    }
  
    // Transactions can only get executed on nonce change
    // get all nonce changes and look for metaTxnIds in between logs
    const timeoutTime = new Date().getTime() + timeout
    let lastBlock: number = this.fromBlockLog

    if (lastBlock < 0) {
      const block = await this.provider.getBlockNumber()
      lastBlock = block + lastBlock
    }

    const normalMetaTxnId = metaTxnId.replace('0x', '')

    while (new Date().getTime() < timeoutTime) {
      const block = await this.provider.getBlockNumber()
      const logs = await this.provider.getLogs({
        fromBlock: Math.max(0, lastBlock - this.deltaBlocksLog),
        toBlock: block,
        // Nonce change event topic
        topics: ['0x1f180c27086c7a39ea2a7b25239d1ab92348f07ca7bb59d1438fcf527568f881']
      })

      lastBlock = block

      // Get receipts of all transactions
      const txs = await Promise.all(logs.map((l) => this.provider.getTransactionReceipt(l.transactionHash)))

      // Find a transaction with a TxExecuted log
      const found = txs.find((tx) => tx.logs.find((l) => (
        (
          l.topics.length === 0 &&
          l.data.replace('0x', '') === normalMetaTxnId
        ) || (
          l.topics.length === 1 &&
          // TxFailed event topic
          l.topics[0] === "0x3dbd1590ea96dd3253a91f24e64e3a502e1225d602a5731357bc12643070ccd7" &&
          l.data.length >= 64 && l.data.replace('0x', '').startsWith(normalMetaTxnId) 
        )
      )))

      // If found return that
      if (found) {
        return {
          receipt: found,
          ...await this.provider.getTransaction(found.transactionHash)
        }
      }

      // Otherwise wait and try again
      await new Promise(r => setTimeout(r, this.waitPollRate))
    }

    throw new Error(`Timeout waiting for transaction receipt ${metaTxnId}`)
  }
}
