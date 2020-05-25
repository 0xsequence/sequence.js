import { ArcadeumTransaction, ArcadeumWalletConfig, ArcadeumContext } from '../types'
import { TransactionResponse } from 'ethers/providers'

import { addressOf, imageHash, readArcadeumNonce, arcadeumTxAbiEncode } from '../utils'
import { Signer, ethers } from 'ethers'

import { abi as factoryAbi } from '../abi/factory'
import { abi as mainModuleAbi } from '../abi/mainModule'

export class LocalRelayer {
  private readonly signer: Signer

  constructor(signer: Signer) {
    this.signer = signer
  }

  async deploy(config: ArcadeumWalletConfig, context: ArcadeumContext): Promise<TransactionResponse> {
    const factory = new ethers.ContractFactory(factoryAbi, [], this.signer)
    return factory
      .attach(context.factory)
      .connect(this.signer)
      .deploy(context.mainModule, imageHash(config), { gasLimit: 100000 })
  }

  async relay(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse> {
    const wallet = addressOf(config, context)

    if ((await this.signer.provider.getCode(wallet)) === '0x') {
      await this.deploy(config, context)
    }

    const mainModule = new ethers.ContractFactory(mainModuleAbi, [], this.signer)
    const walletModule = mainModule.attach(wallet).connect(this.signer)

    const nonce = readArcadeumNonce(...transactions)
    return walletModule.execute(arcadeumTxAbiEncode(transactions), nonce, signature)
  }
}
