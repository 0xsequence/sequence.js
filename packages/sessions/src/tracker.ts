import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'

export type PresignedConfigUpdate = {
  wallet: string,
  nextImageHash: string,
  signature: string
}

export type PresignedConfigurationPayload = {
  wallet: string,
  config: commons.config.Config,
  nextImageHash: string,
  signature: string
}

export type ConfigDataDump = {
  configurations: commons.config.Config[],
  wallets: {
    imageHash: string,
    context: commons.context.WalletContext
  }[],
  presignedTransactions: PresignedConfigurationPayload[]
}


export function asPresignedConfigurationAsPayload(
  presigned: PresignedConfigUpdate,
  config: commons.config.Config
): PresignedConfigurationPayload {
  return { config, ...presigned }
}

export abstract class ConfigTracker {
  loadPresignedConfiguration: (args: {
    wallet: string,
    fromImageHash: string,
    checkpoint: ethers.BigNumberish,
    longestPath?: boolean
  }) => Promise<PresignedConfigUpdate[]>

  savePresignedConfiguration: (
    args: PresignedConfigurationPayload
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

  imageHashOfCounterFactualWallet: (args: {
    wallet: string
  }) => Promise<{
    imageHash: string,
    context: commons.context.WalletContext
  } | undefined>

  saveCounterFactualWallet: (args: {
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
      signature: commons.signature.SignaturePart
    }
  }[]>
}
