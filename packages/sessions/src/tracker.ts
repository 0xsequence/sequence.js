import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'

export type PresignedConfigLink = {
  wallet: string,
  nextImageHash: string,
  signature: string
}

export type ConfigDataDump = {
  configurations: commons.config.Config[],
  wallets: {
    imageHash: string,
    context: commons.context.WalletContext
  }[],
  presignedTransactions: PresignedConfigLink[]
}

export abstract class ConfigTracker {
  loadPresignedConfiguration: (args: {
    wallet: string,
    fromImageHash: string,
    longestPath?: boolean
  }) => Promise<PresignedConfigLink[]>

  savePresignedConfiguration: (
    args: PresignedConfigLink
  ) => Promise<void>

  saveWitness: ( args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumberish,
    signature: string
  }) => Promise<void>

  configOfImageHash: (args: {
    imageHash: string
  }) => Promise<commons.config.Config | undefined>

  saveWalletConfig: (args: {
    config: commons.config.Config
  }) => Promise<void>

  imageHashOfCounterfactualWallet: (args: {
    wallet: string
  }) => Promise<{
    imageHash: string,
    context: commons.context.WalletContext
  } | undefined>

  saveCounterfactualWallet: (args: {
    imageHash: string,
    context: commons.context.WalletContext[]
  }) => Promise<void>

  walletsOfSigner: (args: {
    signer: string
  }) => Promise<{
    wallet: string,
    proof: {
      digest: string,
      chainId: ethers.BigNumber,
      signature: string
    }
  }[]>
}
