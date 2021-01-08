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

const deployWalletContextCache: WalletContext[] = []

// deployWalletContext will deploy the Sequence WalletContext via the UniversalDeployer
// which will return deterministic contract addresses between calls.
export const deployWalletContext = async (...providers: JsonRpcProvider[]): Promise<WalletContext> => {
  if (!providers || providers.length === 0) {
    providers.push(new JsonRpcProvider('http://localhost:8545'))
  }
  
  // Memoize the result. Even though its universal/deterministic, caching the result
  // offers greater efficiency between calls
  if (deployWalletContextCache.length === providers.length) {
    return deployWalletContextCache[0]
  }

  await Promise.all(providers.map(async provider => {
    // Deploying test accounts with the first test account
    const wallet = getEOAWallet(testAccounts[0].privateKey, provider)

    // Universal deployer for deterministic contract addresses
    const universalDeployer = new UniversalDeployer('local', wallet.provider as JsonRpcProvider)
    const txParams = { gasLimit: 8000000, gasPrice: ethers.BigNumber.from(10).pow(9).mul(10) }

    const walletFactory = await universalDeployer.deploy('WalletFactory', FactoryFactory, txParams)
    const mainModule = await universalDeployer.deploy('MainModule', MainModuleFactory, txParams, 0, walletFactory.address)

    await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory, txParams)
    await universalDeployer.deploy('GuestModule', GuestModuleFactory, txParams)
    await universalDeployer.deploy('SequenceUtils', SequenceUtilsFactory, txParams, 0, walletFactory.address, mainModule.address)

    const deployment = universalDeployer.getDeployment()

    deployWalletContextCache.push({
      factory: deployment['WalletFactory'].address,
      mainModule: deployment['MainModule'].address,
      mainModuleUpgradable: deployment['MainModuleUpgradable'].address,
      guestModule: deployment['GuestModule'].address,
      sequenceUtils: deployment['SequenceUtils'].address
    })
  }))

  return deployWalletContextCache[0]
}


// testWalletContext is determined by the `deployWalletContext` method above. We can use this
// across instances, but, we must ensure the contracts are deployed by the mock-wallet at least.
export const testWalletContext: WalletContext = {
  factory: "0x34612d35C278c69589111C58FB9405e034070F8D",
  guestModule: "0x1755Dbec6289C2645F82b6C31cDcEe39D22CB790",
  mainModule: "0x6262c92306354fc7c0B7a7fC1BA9054f62d06b92",
  mainModuleUpgradable: "0x3b6f9cAA2E9Ca4c6fBC9E762d8670073D4369793",
  sequenceUtils: "0xDD38B65afeeEBD4f481DcE5b49178611A2762c0A"
}
