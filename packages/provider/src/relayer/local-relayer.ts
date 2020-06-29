import { ArcadeumTransaction, ArcadeumWalletConfig, ArcadeumContext } from '../types'
import { TransactionResponse, BlockTag } from 'ethers/providers'
import { abi as mainModuleAbi } from '../abi/mainModule'

import { Signer, ethers } from 'ethers'

import { BaseRelayer } from './base-relayer'
import { addressOf } from '../utils'

import { IRelayer } from '.'

const DEFAULT_FEE = ethers.utils.bigNumberify(800000)

export class LocalRelayer extends BaseRelayer implements IRelayer {
  private readonly signer: Signer

  constructor(signer: Signer) {
    super(true, signer.provider)
    this.signer = signer
  }

  async deploy(config: ArcadeumWalletConfig, context: ArcadeumContext): Promise<TransactionResponse> {
    return this.signer.sendTransaction(
      this.prepareWalletDeploy(config, context)
    )
  }

  async estimateGasLimits(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    ...transactions: ArcadeumTransaction[]
  ): Promise<ArcadeumTransaction[]> {
    const walletAddr = addressOf(config, context)

    const gasCosts = await Promise.all(transactions.map(async (t) => {
      // Fee can't be estimated locally for delegateCalls
      if (t.delegateCall) {
        return DEFAULT_FEE
      }

      // Fee can't be estimated for self-called if wallet hasn't been deployed
      if (t.to === walletAddr && !(await this.isWalletDeployed(walletAddr))) {
        return DEFAULT_FEE
      }

      // TODO: If the wallet address has been deployed, gas limits can be
      // estimated with more accuracy by using self-calls with the batch transactions one by one
      return this.signer.provider.estimateGas({
        from: walletAddr,
        to: t.to,
        data: t.data,
        value: t.value
      })
    }))

    return transactions.map((t, i) => {
      t.gasLimit = gasCosts[i]
      return t
    })
  }

  async getNonce(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    space?: number,
    blockTag?: BlockTag
  ): Promise<number> {
    const addr = addressOf(config, context)
    if ((await this.provider.getCode(addr)) === '0x') {
      return 0
    }

    const module = new ethers.Contract(addr, mainModuleAbi, this.signer.provider)
    return (await module.nonce({ blockTag: blockTag })).toNumber()
  }

  async relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse> {
    if (!context.guestModule || context.guestModule.length != 42) {
      throw new Error('LocalRelayer requires the context.guestModule address')
    }

    return this.signer.sendTransaction(
      await this.prepare(config, context, signature, ...transactions)
    )
  }
}
