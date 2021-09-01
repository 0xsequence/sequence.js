import { WalletContext } from '@0xsequence/network'
import { ethers } from 'ethers'
import { WalletConfig } from '..'

export abstract class ConfigFinder {
  findCurrentConfig: (args: {
    address: string
    provider: ethers.providers.Provider
    context: WalletContext
    knownConfigs?: WalletConfig[]
  }) => Promise<{ config: WalletConfig | undefined }>
  findLastWalletOfInitialSigner: (args: {
    signer: string
    provider: ethers.providers.Provider
    context: WalletContext
  }) => Promise<{ wallet?: string | undefined }>
}
