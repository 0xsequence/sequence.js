import { TransactionResponse, BlockTag, Provider } from '@ethersproject/providers'
import { ethers, providers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { computeMetaTxnHash, SignedTransactions, Transaction } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { BaseRelayer, BaseRelayerOptions } from './base-relayer'
import { FeeOption, Relayer } from '.'
import { Optionals, Mask } from '@0xsequence/utils'

const DEFAULT_GAS_LIMIT = ethers.BigNumber.from(800000)

export interface ProviderRelayerOptions extends BaseRelayerOptions {
  provider: Provider,
  waitPoolRate?: number,
  deltaBlocksLog?: number
}

export const ProviderRelayerDefaults: Required<Optionals<Mask<ProviderRelayerOptions, BaseRelayerOptions>>> = {
  waitPoolRate: 1000,
  deltaBlocksLog: 12
}

export function isProviderRelayerOptions(obj: any): obj is ProviderRelayerOptions {
  return obj.provider !== undefined && Provider.isProvider(obj.provider)
}

export abstract class ProviderRelayer extends BaseRelayer implements Relayer {
  public provider: Provider
  public waitPoolRate: number
  public deltaBlocksLog: number

  constructor(options: ProviderRelayerOptions) {
    super(options)
    const opts = { ...ProviderRelayerDefaults, ...options }
    this.provider = opts.provider
    this.waitPoolRate = opts.waitPoolRate
    this.deltaBlocksLog = opts.deltaBlocksLog
  }

  abstract gasRefundOptions(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<FeeOption[]>
  abstract relay(signedTxs: SignedTransactions): Promise<TransactionResponse>

  async estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<Transaction[]> {
    const walletAddr = addressOf(config, context)

    const gasCosts = await Promise.all(transactions.map(async tx => {
      // Respect gasLimit request of the transaction (as long as its not 0)
      if (tx.gasLimit && !ethers.BigNumber.from(tx.gasLimit || 0).eq(ethers.constants.Zero)) {
        return tx.gasLimit
      }

      // Fee can't be estimated locally for delegateCalls
      if (tx.delegateCall) {
        return DEFAULT_GAS_LIMIT
      }

      // Fee can't be estimated for self-called if wallet hasn't been deployed
      if (tx.to === walletAddr && !(await this.isWalletDeployed(walletAddr))) {
        return DEFAULT_GAS_LIMIT
      }

      if (!this.provider) {
        throw new Error('signer.provider is not set, but is required')
      }

      // TODO: If the wallet address has been deployed, gas limits can be
      // estimated with more accurately by using self-calls with the batch transactions one by one
      return this.provider.estimateGas({
        from: walletAddr,
        to: tx.to,
        data: tx.data,
        value: tx.value
      })
    }))

    return transactions.map((t, i) => {
      t.gasLimit = gasCosts[i]
      return t
    })
  }

  async getNonce(
    config: WalletConfig,
    context: WalletContext,
    space?: number,
    blockTag?: BlockTag
  ): Promise<number> {
    if (!this.provider) {
      throw new Error('provider is not set')
    }

    const addr = addressOf(config, context)

    if ((await this.provider.getCode(addr)) === '0x') {
      return 0
    }

    const module = new ethers.Contract(addr, walletContracts.mainModule.abi, this.provider)
    return (await module.readNonce(space ? space : 0, { blockTag: blockTag })).toNumber()
  }

  async wait(metaTxnId: string | SignedTransactions, timeout: number): Promise<providers.TransactionResponse & providers.TransactionReceipt> {
    if (typeof metaTxnId !== 'string') {
      console.log("computing id", metaTxnId.config, metaTxnId.context, metaTxnId.chainId, ...metaTxnId.transactions)
      return this.wait(
        computeMetaTxnHash(addressOf(metaTxnId.config, metaTxnId.context), metaTxnId.chainId, ...metaTxnId.transactions),
        timeout
      )
    }
  
    // Transactions can only get executed on nonce change
    // get all nonce changes and look for metaTxnIds in between logs
    const timeoutTime = new Date().getTime() + timeout
    let lastBlock: number = 0

    const normalMetaTxnId = metaTxnId.replace('0x', '')

    while (new Date().getTime() < timeoutTime) {
      const block = await this.provider.getBlockNumber()
      const logs = await this.provider.getLogs({
        fromBlock: Math.max(0, lastBlock - 12),
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
          ...found,
          ...await this.provider.getTransaction(found.transactionHash)
        }
      }

      // Otherwise wait and try again
      await new Promise(r => setTimeout(r, 1000))
    }

    throw new Error(`Timeout waiting for transaction receipt ${metaTxnId}`)
  }
}
