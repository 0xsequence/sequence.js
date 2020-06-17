import { ArcadeumWalletConfig } from ".."
import { ArcadeumContext, ArcadeumTransaction } from "../types"
import { Provider } from "ethers/providers"
import { addressOf, arcadeumTxAbiEncode, readArcadeumNonce, imageHash } from "../utils"
import { Interface } from "ethers/utils"

import { abi as mainModuleAbi } from '../abi/mainModule'
import { abi as factoryAbi } from '../abi/factory'
import { ethers } from "ethers"

export class BaseRelayer {
  private readonly bundleCreation: boolean
  readonly provider: Provider

  constructor(bundleCreation: boolean, provider?: Provider) {
    this.bundleCreation = bundleCreation
    this.provider = provider
  }

  async isDeployed(wallet: string) {
    if (!this.provider) throw Error('Bundled creation provider not found')
    return (await this.provider.getCode(wallet)) !== '0x'
  }

  prepareDeploy(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext
  ): { to: string, data: string} {
    return {
      to: context.factory,
      data: new Interface(factoryAbi).functions.deploy.encode(
        [context.mainModule, imageHash(config)
      ])
    }
  }

  async prepare(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext,
    signature: string | Promise<string>,
    ...transactions: ArcadeumTransaction[]
  ): Promise<{ to: string, data: string}> {
    const wallet = addressOf(config, context)
    const walletInterface = new Interface(mainModuleAbi)

    if (this.bundleCreation && !(await this.isDeployed(wallet))) {
      return {
        to: context.guestModule,
        data: walletInterface.functions.execute.encode([
          arcadeumTxAbiEncode([{
            ...this.prepareDeploy(config, context),
            delegateCall: false,
            revertOnError: false,
            gasLimit: ethers.constants.Two.pow(17),
            value: ethers.constants.Zero,
          }, {
            delegateCall: false,
            revertOnError: true,
            gasLimit: ethers.constants.Zero,
            to: wallet,
            value: ethers.constants.Zero,
            data: walletInterface.functions.execute.encode(
              [
                arcadeumTxAbiEncode(transactions),
                readArcadeumNonce(...transactions),
                await signature
              ]
            )
          }]), 0, []
        ])
      }
    } else {
      return {
        to: wallet,
        data: walletInterface.functions.execute.encode(
          [
            arcadeumTxAbiEncode(transactions),
            readArcadeumNonce(...transactions),
            await signature
          ]
        )
      }
    }
  }
}
