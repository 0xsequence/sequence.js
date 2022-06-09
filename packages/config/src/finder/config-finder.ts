import { WalletContext } from '@0xsequence/network'
import { ethers } from 'ethers'
import { WalletConfig } from '..'

export abstract class ConfigFinder {
  abstract findCurrentConfig: (args: {
    address: string
    provider: ethers.providers.Provider
    context: WalletContext
    knownConfigs?: WalletConfig[]
  }) => Promise<{ config: WalletConfig | undefined }>

  abstract findLastWalletOfInitialSigner: (args: {
    signer: string
    provider: ethers.providers.Provider
    context: WalletContext
  }) => Promise<{ wallet?: string | undefined }>
}
