import { ethers, providers } from "ethers"
import { Interface } from "ethers/lib/utils"
import { walletContracts } from '@0xsequence/abi'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, imageHash, DecodedSignature, encodeSignature } from '@0xsequence/config'
import { Transaction, sequenceTxAbiEncode, readSequenceNonce } from '@0xsequence/transactions'
import { isBigNumberish, Optionals } from '@0xsequence/utils'
import { Provider } from "@ethersproject/providers"


export interface BaseRelayerOptions {
  bundleCreation?: boolean
  creationGasLimit?: ethers.BigNumberish
  provider?: Provider
}

export function isBaseRelayerOptions(obj: any): obj is BaseRelayerOptions {
  return (
    (obj.bundleCreation !== undefined && typeof obj.bundleCreation === 'boolean') ||
    (obj.creationGasLimit !== undefined && isBigNumberish(obj.creationGasLimit)) ||
    (obj.provider !== undefined && (providers.Provider.isProvider(obj.provider) || typeof obj.provider === 'string'))
  )
}

export const BaseRelayerDefaults: Omit<Required<Optionals<BaseRelayerOptions>>, 'provider'> = {
  bundleCreation: true,
  creationGasLimit: ethers.constants.Two.pow(17)
}

export class BaseRelayer {
  readonly provider: providers.Provider | undefined
  public readonly bundleCreation: boolean
  public creationGasLimit: ethers.BigNumber

  constructor(options?: BaseRelayerOptions) {
    const opts = { ...BaseRelayerDefaults, ...options }
    this.bundleCreation = opts.bundleCreation
    this.provider = opts.provider
    this.creationGasLimit = ethers.BigNumber.from(opts.creationGasLimit)
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
              gasLimit: this.creationGasLimit,
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
