// import { ethers } from 'ethers'
// import { UniversalDeployer } from '@0xsequence/deployer'
// import { WalletContext } from '@0xsequence/network'
// import { testAccounts, getEOAWallet } from './accounts'

// // TODO/NOTE: it should be possible to import below from just '@0xsequence/wallet-contracts'
// // however, experiencing a strange JS packaging/module resolution issue which leads to:
// //
// // mock-wallet.test.js:70822 Uncaught (in promise) TypeError: Class constructor ContractFactory cannot be invoked without 'new'
// //
// // by importing from '@0xsequence/wallet-contracts/gen/typechain', this issue goes away

// import {
//   Factory__factory,
//   MainModule__factory,
//   MainModuleUpgradable__factory,
//   GuestModule__factory,
//   SequenceUtils__factory,
//   RequireFreshSigner__factory,
// } from '@0xsequence/wallet-contracts'

// const deployWalletContextCache: WalletContext[] = []

// // deployWalletContext will deploy the Sequence WalletContext via the UniversalDeployer
// // which will return deterministic contract addresses between calls.
// export const deployWalletContext = async (...providers: ethers.JsonRpcProvider[]): Promise<WalletContext> => {
//   if (!providers || providers.length === 0) {
//     providers.push(new ethers.JsonRpcProvider('http://localhost:8545'))
//   }

//   // Memoize the result. Even though its universal/deterministic, caching the result
//   // offers greater efficiency between calls
//   if (deployWalletContextCache.length === providers.length) {
//     return deployWalletContextCache[0]
//   }

//   await Promise.all(providers.map(async provider => {
//     // Deploying test accounts with the first test account
//     const wallet = getEOAWallet(testAccounts[0].privateKey, provider)

//     // Universal deployer for deterministic contract addresses
//     const universalDeployer = new UniversalDeployer('local', wallet.provider as ethers.JsonRpcProvider)
//     const txParams = { gasLimit: 8000000, gasPrice: 10n.pow(9).mul(10) }

//     const walletFactory = await universalDeployer.deploy('WalletFactory', Factory__factory as any, txParams)
//     const mainModule = await universalDeployer.deploy('MainModule', MainModule__factory as any, txParams, 0, walletFactory.address)

//     await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradable__factory as any, txParams)
//     await universalDeployer.deploy('GuestModule', GuestModule__factory as any, txParams)

//     const sequenceUtils = await universalDeployer.deploy('SequenceUtils', SequenceUtils__factory as any, txParams, 0, walletFactory.address, mainModule.address)
//     await universalDeployer.deploy('RequireFreshSignerLib', RequireFreshSigner__factory as any, txParams, 0, sequenceUtils.address)

//     const deployment = universalDeployer.getDeployment()

//     deployWalletContextCache.push({
//       factory: deployment['WalletFactory'].address,
//       mainModule: deployment['MainModule'].address,
//       mainModuleUpgradable: deployment['MainModuleUpgradable'].address,
//       guestModule: deployment['GuestModule'].address,
//       sequenceUtils: deployment['SequenceUtils'].address,
//       libs: {
//         requireFreshSigner: deployment['RequireFreshSignerLib'].address
//       }
//     })
//   }))

//   return deployWalletContextCache[0]
// }

// // testWalletContext is determined by the `deployWalletContext` method above. We can use this
// // across instances, but, we must ensure the contracts are deployed by the mock-wallet at least.
// export const testWalletContext: WalletContext = {
//   factory: "0xf9D09D634Fb818b05149329C1dcCFAeA53639d96",
//   guestModule: "0x02390F3E6E5FD1C6786CB78FD3027C117a9955A7",
//   mainModule: "0xd01F11855bCcb95f88D7A48492F66410d4637313",
//   mainModuleUpgradable: "0x7EFE6cE415956c5f80C6530cC6cc81b4808F6118",
//   sequenceUtils: "0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E"
// }
