import { ethers } from 'ethers'
import { Provider, JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { UniversalDeployer } from '@0xsequence/deployer'
import { WalletContext } from '@0xsequence/network'
import { testAccounts, getEOAWallet } from './accounts'

import {
  FactoryFactory,
  MainModuleFactory,
  MainModuleUpgradableFactory,
  GuestModuleFactory,
  RequireUtilsFactory,
  // SequenceUtilsFactory
} from '@0xsequence/wallet-contracts/typings/contracts/ethers-v5'

// TODO: use hardhat branch from wallet-contracts..

let deployWalletContextCache: WalletContext = undefined

// deployWalletContext will deploy the Sequence WalletContext via the UniversalDeployer
// which will return deterministic contract addresses between calls.
export const deployWalletContext = async (provider?: JsonRpcProvider): Promise<WalletContext> => {
  if (!provider) {
    provider = new JsonRpcProvider('http://localhost:8545')
  }
  
  // Memoize the result. Even though its universal/deterministic, caching the result
  // offers greater efficiency between calls
  if (deployWalletContextCache) {
    return deployWalletContextCache
  }

  // Deploying test accounts with the first test account
  const wallet = getEOAWallet(testAccounts[0].privateKey, provider)
  
  // Universal deployer for deterministic contract addresses
  const universalDeployer = new UniversalDeployer('ganache', wallet.provider as JsonRpcProvider)
  const txParams = { gasLimit: 8000000, gasPrice: ethers.BigNumber.from(10).pow(9).mul(10) }

  const walletFactory = await universalDeployer.deploy('WalletFactory', FactoryFactory, txParams)
  const mainModule = await universalDeployer.deploy('MainModule', MainModuleFactory, txParams, 0, walletFactory.address)
  await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory, txParams)
  await universalDeployer.deploy('GuestModule', GuestModuleFactory, txParams)

  // TODO: rename RequireUtils to SequenceUtils, ... from latest wallet-contracts @master, update hash
  await universalDeployer.deploy('RequireUtils', RequireUtilsFactory, txParams, 0, walletFactory.address, mainModule.address)

  // TODO .. for multicall, etc.
  // await universalDeployer.deploy('SequenceUtils', SequenceUtilsFactory, txParams, 0, walletFactory.address, mainModule.address)

  const deployment = universalDeployer.getDeployment()

  deployWalletContextCache =  {
    factory: deployment['WalletFactory'].address,
    mainModule: deployment['MainModule'].address,
    mainModuleUpgradable: deployment['MainModuleUpgradable'].address,
    guestModule: deployment['GuestModule'].address,
    requireUtils: deployment['RequireUtils'].address
  }

  return deployWalletContextCache
}

// testWalletContext is determined by the `deployWalletContext` method above. We can use this
// across instances, but, we must ensure the contracts are deployed by the mock-wallet at least.
export const testWalletContext: WalletContext = {
  factory: "0x98A9AA23d209E39b6b04eF825DAbD6a95D5A4bD7",
  guestModule: "0x124585Ac29933ec1bFd8676F011401F00963c7a2",
  mainModule: "0x46caf4dB790F7700690Bd4762D84d7AAda7cC7fC",
  mainModuleUpgradable: "0x305475d04010546a1FA0dF3D2EB7438156156A10",
  requireUtils: "0xB69e1338083046A3D4c733052b615b9a920FbC62",
}
