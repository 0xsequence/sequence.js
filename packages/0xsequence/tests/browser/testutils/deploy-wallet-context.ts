import { ethers } from 'ethers'
import { Provider, JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { UniversalDeployer } from '@0xsequence/deployer'
import { WalletContext } from '@0xsequence/network'
import { testAccounts, getEOAWallet } from './accounts'

import {
  Factory__factory as FactoryFactory,
  MainModule__factory as MainModuleFactory,
  MainModuleUpgradable__factory as MainModuleUpgradableFactory,
  GuestModule__factory as GuestModuleFactory,
  SequenceUtils__factory as SequenceUtilsFactory,
} from '@0xsequence/wallet-contracts/typings/contracts'

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
  await universalDeployer.deploy('SequenceUtils', SequenceUtilsFactory, txParams, 0, walletFactory.address, mainModule.address)

  const deployment = universalDeployer.getDeployment()

  deployWalletContextCache =  {
    factory: deployment['WalletFactory'].address,
    mainModule: deployment['MainModule'].address,
    mainModuleUpgradable: deployment['MainModuleUpgradable'].address,
    guestModule: deployment['GuestModule'].address,
    sequenceUtils: deployment['SequenceUtils'].address
  }


  return deployWalletContextCache
}

// testWalletContext is determined by the `deployWalletContext` method above. We can use this
// across instances, but, we must ensure the contracts are deployed by the mock-wallet at least.
export const testWalletContext: WalletContext = {
  factory: "0x34612d35C278c69589111C58FB9405e034070F8D",
  guestModule: "0x872eA617FED42056cDcEB3979838eba48A72FE41",
  mainModule: "0xBbC50F0Dc98B5CcE607f7413c589F9247dd28Ac7",
  mainModuleUpgradable: "0x38364BC14E370C3c5D8Af99A040c24734AB7Cad6",
  sequenceUtils: "0x10c1c71fb43017d5b968dFea38694632818489b8"
}
