import { ArcadeumTransaction, ArcadeumWalletConfig, ArcadeumContext } from '../types'
import { TransactionResponse, BlockTag } from 'ethers/providers'
import { abi as mainModuleAbi } from '../abi/mainModule'

import { Signer, ethers } from 'ethers'

import { BaseRelayer } from './base-relayer'
import { addressOf } from '../utils'

import { IRelayer } from '.'

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
