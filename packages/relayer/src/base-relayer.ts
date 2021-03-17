import { Provider } from "@ethersproject/providers"
import { ethers } from "ethers"
import { Interface } from "ethers/lib/utils"
import { walletContracts } from '@0xsequence/abi'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, imageHash, DecodedSignature, encodeSignature } from '@0xsequence/config'
import { Transaction, sequenceTxAbiEncode, readSequenceNonce } from '@0xsequence/transactions'

export class BaseRelayer {
  private readonly bundleCreation: boolean
  readonly provider: Provider | undefined

  constructor(bundleCreation: boolean, provider?: Provider) {
    this.bundleCreation = bundleCreation
    this.provider = provider
  }

  async isWalletDeployed(walletAddress: string): Promise<boolean> {
    if (!this.provider) throw new Error('Bundled creation provider not found')
    return (await this.provider.getCode(walletAddress)) !== '0x'
  }

  prepareWalletDeploy(
    config: WalletConfig,
    context: WalletContext
  ): { to: string, data: string} {
    const factoryInterface = new Interface(walletContracts.factory.abi)

    return {
      to: context.factory,
      data: factoryInterface.encodeFunctionData(factoryInterface.getFunction('deploy'),
        [context.mainModule, imageHash(config)]
      )
    }
  }

  async prepareTransactions(
    config: WalletConfig,
    context: WalletContext,
    signature: string | Promise<string> | DecodedSignature | Promise<DecodedSignature>,
    ...transactions: Transaction[]
  ): Promise<{ to: string, data: string  }> { //, gasLimit?: ethers.BigNumberish }> {
    const walletAddress = addressOf(config, context)
    const walletInterface = new Interface(walletContracts.mainModule.abi)

    const encodedSignature = (async () => {
      const sig = await signature

      if (typeof sig === 'string') return sig
      return encodeSignature(sig)
    })()

    if (this.bundleCreation && !(await this.isWalletDeployed(walletAddress))) {
      return {
        to: context.guestModule!,
        data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), [
          sequenceTxAbiEncode([
            {
              ...this.prepareWalletDeploy(config, context),
              delegateCall: false,
              revertOnError: false,
              gasLimit: ethers.constants.Two.pow(17),
              value: ethers.constants.Zero
            },
            {
              delegateCall: false,
              revertOnError: true,
              gasLimit: ethers.constants.Zero,
              to: walletAddress,
              value: ethers.constants.Zero,
              data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'), 
                [
                  sequenceTxAbiEncode(transactions),
                  readSequenceNonce(...transactions),
                  await encodedSignature
                ]
              )
            }
          ]), 0, []
        ])
      }
    } else {
      return {
        to: walletAddress,
        data: walletInterface.encodeFunctionData(walletInterface.getFunction('execute'),
          [
            sequenceTxAbiEncode(transactions),
            readSequenceNonce(...transactions),
            await encodedSignature
          ]
        )
      }
    }
  }
}
