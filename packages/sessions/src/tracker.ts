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

// AssumedWalletConfigs are configs that are assumed to be valid
// for a given sequence smart contract wallet, this is needed to validate
// guard signatures statically.
export type AssumedWalletConfigs = { [key: string]: commons.config.Config }

export function asPresignedConfigurationAsPayload(
  presigned: PresignedConfigUpdate,
  config: commons.config.Config
): PresignedConfigurationPayload {
  return { config, ...presigned }
}

export abstract class ConfigTracker {
  abstract loadPresignedConfiguration: (args: {
    wallet: string,
    fromImageHash: string,
    checkpoint: ethers.BigNumberish,
    assumedConfigs?: AssumedWalletConfigs,
    longestPath?: boolean
  }) => Promise<PresignedConfigUpdate[]>

  abstract savePresignedConfiguration: (
    args: PresignedConfigurationPayload
  ) => Promise<void>

  abstract saveWitness: ( args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumberish,
    signature: string
  }) => Promise<void>

  abstract configOfImageHash: (args: {
    imageHash: string
  }) => Promise<commons.config.Config | undefined>

  abstract saveWalletConfig: (args: {
    config: commons.config.Config
  }) => Promise<void>

  abstract imageHashOfCounterFactualWallet: (args: {
    context: commons.context.WalletContext[],
    wallet: string
  }) => Promise<{
    imageHash: string,
    context: commons.context.WalletContext
  } | undefined>

  abstract saveCounterFactualWallet: (args: {
    imageHash: string,
    context: commons.context.WalletContext[]
  }) => Promise<void>

  abstract walletsOfSigner: (args: {
    signer: string
  }) => Promise<{
    wallet: string,
    proof: {
      digest: string,
      chainId: ethers.BigNumber,
      signature: commons.signature.SignaturePart
    }
  }[]>

  // abstract signaturesOfSigner: (args: {
  //   signer: string
  // }) => Promise<{
  //   signature: string,
  //   chainId: ethers.BigNumber,
  //   wallet: string,
  //   digest: string
  // }[]>

  // abstract imageHashesOfSigner: (args: {
  //   signer: string
  // }) => Promise<string[]>

  // abstract signaturesForImageHash: (args: {
  //   imageHash: string
  // }) => Promise<{signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]>
}
