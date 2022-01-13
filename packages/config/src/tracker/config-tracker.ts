import { ethers } from 'ethers'
import { WalletConfig } from '..'

export type TransactionBody = {
  wallet: string,
  tx: string,
  newImageHash: string,
  gapNonce: ethers.BigNumber,
  nonce: ethers.BigNumber
}

export type PresignedConfigUpdate = {
  body: TransactionBody,
  signature: string,
  chainId: ethers.BigNumber
}

export abstract class ConfigTracker {
  loadPresignedConfiguration: (args: {
    wallet: string,
    fromImageHash: string,
    chainId: ethers.BigNumberish
  }) => Promise<PresignedConfigUpdate[]>

  configOfImageHash: (args: {
    imageHash: string
  }) => Promise<WalletConfig | undefined>

  savePresignedConfiguration: (args: {
    wallet: string,
    config: WalletConfig,
    tx: TransactionBody,
    signatures: {
      chainId: ethers.BigNumber,
      signature: string
    }[]
  }) => Promise<void>

  saveWalletConfig: (args: {
    config: WalletConfig
  }) => Promise<void>
}
