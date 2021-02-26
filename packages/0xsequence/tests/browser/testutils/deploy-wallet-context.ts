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
  factory: "0xf9D09D634Fb818b05149329C1dcCFAeA53639d96",
  guestModule: "0x425bcE1ecBF6dca1c09dF648FD72B4576f26FCe0",
  mainModule: "0xEc91D6144AFaCb3021dF43A84530041759ff7294",
  mainModuleUpgradable: "0x264E53d61f4814e981281b614743a5193216f3D0",
  sequenceUtils: "0x0341daA0bB5AD9B9c84660C211b132e7641705e9"
}
