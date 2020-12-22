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

  // TODO: how to make a JsonRpcProvider out of a .provider ..? I think Web3Provider ..

  const universalDeployer = new UniversalDeployer('ganache', wallet, provider) //wallet.provider as JsonRpcProvider)
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
