
import { ethers } from 'ethers'
import { Interface } from '@ethersproject/abi'
import { walletContracts } from '@0xsequence/abi'
import { commons } from '..'


export type AddressMember = {
  weight: ethers.BigNumberish,
  address: string
}

export type WalletConfig = commons.config.Config & {
  threshold: ethers.BigNumberish,
  signers: AddressMember[]
}

export const ConfigCoder: commons.config.ConfigCoder<WalletConfig> = {
  isWalletConfig: (config: commons.config.Config): config is WalletConfig => {
    return (
      config.version === 1 &&
      (config as WalletConfig).threshold !== undefined &&
      (config as WalletConfig).signers !== undefined
    )
  },

  imageHashOf: (config: WalletConfig): string => {
    return config.signers.reduce(
      (imageHash, signer) => ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['bytes32', 'uint8', 'address'],
          [imageHash, signer.weight, signer.address]
        )
      ),
      ethers.utils.solidityPack(['uint256'], [config.threshold])
    )
  },

  hasSubdigest: (_walletConfig: WalletConfig, _subdigest: string): boolean => {
    // v1 does not support explicit subdigests
    return false
  },

  checkpointOf: (config: WalletConfig): ethers.BigNumber => {
    return ethers.BigNumber.from(0)
  },

  update: {
    isKindUsed: true,

    buildTransaction: (
      wallet: string,
      config: WalletConfig,
      context: commons.context.WalletContext,
      kind?: 'first' | 'later' | undefined
    ): commons.transaction.TransactionBundle => {
      const module = new Interface(walletContracts.mainModuleUpgradable.abi)
      const transactions: commons.transaction.Transaction[] = []

      if (!kind || kind === 'first') {
        transactions.push({
          to: wallet,
          data: module.encodeFunctionData(module.getFunction('updateImplementation'), [
            context.mainModuleUpgradable
          ]),
          gasLimit: 0,
          delegateCall: false,
          revertOnError: true,
          value: 0
        })
      }
  
      transactions.push({
        to: wallet,
        data: module.encodeFunctionData(module.getFunction('updateImageHash'), [
          ConfigCoder.imageHashOf(config)
        ]),
        gasLimit: 0,
        delegateCall: false,
        revertOnError: true,
      })
  
      return {
        entrypoint: wallet,
        transactions
      }
    },
    decodeTransaction: function (tx: commons.transaction.TransactionBundle): { address: string; newConfig: T; kind: "first" | "later" | undefined } {
      throw new Error("Function not implemented.")
    }
  }
}
