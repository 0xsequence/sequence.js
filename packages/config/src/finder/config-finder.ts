import { WalletContext } from "@0xsequence/network"
import { ethers } from "ethers"
import { WalletConfig } from ".."


export interface ConfigFinder {
  findCurrentConfig: (args:  { address: string, provider: ethers.providers.Provider, context: WalletContext, knownConfigs?: WalletConfig[] }) => Promise<{ config: WalletConfig | undefined }>
  findLastWalletOfSigner: (args:  { signer: string, provider: ethers.providers.Provider, context: WalletContext, knownConfigs?: WalletConfig[] }) => Promise<{ wallet: string | undefined }>
}
