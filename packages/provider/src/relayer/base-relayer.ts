import { ArcadeumWalletConfig } from ".."
import { ArcadeumContext, ArcadeumTransaction } from "../types"
import { Provider } from "@ethersproject/providers"
import { addressOf, arcadeumTxAbiEncode, readArcadeumNonce, imageHash } from "../utils"
import { Interface } from "ethers/lib/utils"

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

  async isWalletDeployed(walletAddress: string) {
    if (!this.provider) throw Error('Bundled creation provider not found')
    return (await this.provider.getCode(walletAddress)) !== '0x'
  }

  prepareWalletDeploy(
    config: ArcadeumWalletConfig,
    context: ArcadeumContext
  ): { to: string, data: string} {
    const factoryInterface = new Interface(factoryAbi)
    return {
      to: context.factory,
      data: factoryInterface.encodeFunctionData(factoryInterface.getFunction('deploy'),
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
    const walletAddress = addressOf(config, context)
    const walletInterface = new Interface(mainModuleAbi)

    if (this.bundleCreation && !(await this.isWalletDeployed(walletAddress))) {
      return {
        to: context.guestModule,
        data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
          arcadeumTxAbiEncode([{
            ...this.prepareWalletDeploy(config, context),
            delegateCall: false,
            revertOnError: false,
            gasLimit: ethers.constants.Two.pow(17),
            value: ethers.constants.Zero
          }, {
            delegateCall: false,
            revertOnError: true,
            gasLimit: ethers.constants.Zero,
            to: walletAddress,
            value: ethers.constants.Zero,
            data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), 
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
        to: walletAddress,
        data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'),
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
