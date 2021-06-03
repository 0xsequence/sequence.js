import { TransactionResponse, BlockTag, Provider } from '@ethersproject/providers'
import { ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { SignedTransactions, Transaction } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { BaseRelayer, BaseRelayerOptions } from './base-relayer'
import { Relayer } from '.'

const DEFAULT_GAS_LIMIT = ethers.BigNumber.from(800000)

export interface ProviderRelayerOptions extends BaseRelayerOptions {
  provider: Provider
}

export abstract class ProviderRelayer extends BaseRelayer implements Relayer {
  public provider: Provider

  constructor(options: ProviderRelayerOptions) {
    super(options)
    this.provider = options.provider
  }

  abstract gasRefundOptions(config: WalletConfig, context: WalletContext, ...transactions: Transaction[]): Promise<Transaction[][]>
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

  wait(_metaTxnId: any, _timeout: number): Promise<any> {
    throw new Error('Method not implemented.')
  }
}
