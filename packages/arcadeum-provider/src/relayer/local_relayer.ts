import { BigNumberish } from "ethers/utils"
import { ArcadeumTransaction, ArcadeumWalletConfig, ArcadeumContext } from "../types"
import { TransactionResponse } from "ethers/providers"

import { addressOf, imageHash } from "../utils"
import { Signer, ethers } from "ethers"

import { abi as factoryAbi } from "../abi/factory"
import { abi as mainModuleAbi } from "../abi/mainModule"

export class LocalRelayer  {
  private readonly signer: Signer

  constructor(signer: Signer) {
    this.signer = signer
  }

  async relay(
    nonce: BigNumberish,
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string,
    ...transactions: ArcadeumTransaction[]
  ): Promise<TransactionResponse> {
    const wallet = addressOf(config, context)

    if (await this.signer.provider.getCode(wallet) === '0x') {
      const factory = new ethers.ContractFactory(factoryAbi, [], this.signer)
      await factory
        .attach(context.factory)
        .connect(this.signer)
        .deploy(context.mainModule, imageHash(config))
    }

    const mainModule = new ethers.ContractFactory(mainModuleAbi, [], this.signer)
    const walletModule = mainModule
      .attach(wallet)
      .connect(this.signer)

    return walletModule.execute(transactions, nonce, signature)
  }
}
