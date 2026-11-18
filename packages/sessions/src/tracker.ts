import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'

export type PresignedConfig = {
  wallet: string
  nextConfig: commons.config.Config
  signature: string
  referenceChainId?: ethers.BigNumberish
}

export type PresignedConfigLink = Omit<PresignedConfig, 'nextConfig'> & { nextImageHash: string }

export type ConfigDataDump = {
  configurations: commons.config.Config[]
  wallets: {
    imageHash: string
    context: commons.context.WalletContext
  }[]
  presignedTransactions: PresignedConfigLink[]
}

export interface ConfigTracker {
  loadPresignedConfiguration: (args: {
    wallet: string
    fromImageHash: string
    longestPath?: boolean
  }) => Promise<PresignedConfigLink[]>

  savePresignedConfiguration: (args: PresignedConfig) => Promise<void>

  saveWitnesses: (args: { wallet: string; digest: string; chainId: ethers.BigNumberish; signatures: string[] }) => Promise<void>

  configOfImageHash: (args: { imageHash: string; noCache?: boolean }) => Promise<commons.config.Config | undefined>

  saveWalletConfig: (args: { config: commons.config.Config }) => Promise<void>

  imageHashOfCounterfactualWallet: (args: { wallet: string; noCache?: boolean }) => Promise<
    | {
        imageHash: string
        context: commons.context.WalletContext
      }
    | undefined
  >

  saveCounterfactualWallet: (args: { config: commons.config.Config; context: commons.context.WalletContext[] }) => Promise<void>

  walletsOfSigner: (args: { signer: string; noCache?: boolean }) => Promise<
    {
      wallet: string
      proof: {
        digest: string
        chainId: bigint
        signature: string
      }
    }[]
  >
}
