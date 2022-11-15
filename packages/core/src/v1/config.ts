
import { ethers } from 'ethers'
import { Interface } from '@ethersproject/abi'
import { walletContracts } from '@0xsequence/abi'

import * as base from '../commons'

export type AddressMember = {
  weight: ethers.BigNumberish,
  address: string
}

export type WalletConfig = base.config.Config & {
  threshold: ethers.BigNumberish,
  signers: AddressMember[]
}

export class ConfigCoder implements base.config.ConfigCoder<WalletConfig> {
  imageHashOf = (config: WalletConfig): string => {
    return config.signers.reduce(
      (imageHash, signer) => ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['bytes32', 'uint8', 'address'],
          [imageHash, signer.weight, signer.address]
        )
      ),
      ethers.utils.solidityPack(['uint256'], [config.threshold])
    )
  }

  hasSubdigest = (_walletConfig: WalletConfig, _subdigest: string): boolean => {
    // v1 does not support explicit subdigests
    return false
  }

  public update = {
    isKindUsed: true,

    buildTransaction: (
      wallet: string,
      config: WalletConfig,
      context: base.context.WalletContext,
      kind?: 'first' | 'later' | undefined
    ): base.transaction.TransactionBundle => {
      const module = new Interface(walletContracts.mainModuleUpgradable.abi)
      const transactions: base.transaction.Transaction[] = []
  
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
          this.imageHashOf(config)
        ]),
        gasLimit: 0,
        delegateCall: false,
        revertOnError: true,
      })
  
      return {
        entrypoint: wallet,
        transactions
      }
    }
  }
}
