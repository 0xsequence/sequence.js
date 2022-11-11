
import { ethers } from 'ethers'
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

  hasSubdigest = (_: WalletConfig, _: string): boolean => {
    // v1 does not support explicit subdigests
    return false
  }
}
