import { BigNumberish } from "ethers/utils";
import { ArcadeumTransaction, ArcadeumWalletConfig, ArcadeumContext } from "../types";
import { TransactionResponse } from "ethers/providers"

import { addressOf, imageHash } from "../utils";
import { Signer, ethers } from "ethers";

const FactoryArtifact = require("arcadeum-wallet/build/contracts/Factory.json")
const MainModuleArtifact = require("arcadeum-wallet/build/contracts/MainModule.json")

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

    const factory = new ethers.ContractFactory(FactoryArtifact.abi, [], this.signer)
    const mainModule = new ethers.ContractFactory(MainModuleArtifact.abi, [], this.signer)

    if (await this.signer.provider.getCode(wallet) === '0x') {
      await factory
        .attach(context.factory)
        .connect(this.signer)
        .deploy(context.mainModule, imageHash(config))
    }

    const walletModule = mainModule
      .attach(wallet)
      .connect(this.signer)

    return walletModule.execute(transactions, nonce, signature)
  }
}
