import { WalletContext } from '@0xsequence/network'
import { Provider } from 'ethers'
import { WalletConfig } from '..'

export abstract class ConfigFinder {
  findCurrentConfig: (args: {
    address: string
    provider: Provider
    context: WalletContext
    knownConfigs?: WalletConfig[]
  }) => Promise<{ config: WalletConfig | undefined }>
  findLastWalletOfInitialSigner: (args: {
    signer: string
    provider: Provider
    context: WalletContext
  }) => Promise<{ wallet?: string | undefined }>
}
