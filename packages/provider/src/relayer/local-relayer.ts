import { ArcadeumTransaction, ArcadeumWalletConfig, ArcadeumContext } from '../types'
import { TransactionResponse } from 'ethers/providers'

import { Signer } from 'ethers'

import { BaseRelayer } from './base-relayer'

export class LocalRelayer extends BaseRelayer{
  private readonly signer: Signer

  constructor(signer: Signer) {
    super(true, signer.provider)
    this.signer = signer
  }

  async deploy(config: ArcadeumWalletConfig, context: ArcadeumContext): Promise<TransactionResponse> {
    return this.signer.sendTransaction(
      this.prepareDeploy(config, context)
    )
  }

  async relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse> {
    return this.signer.sendTransaction(
      await this.prepare(config, context, signature, ...transactions)
    )
  }
}
