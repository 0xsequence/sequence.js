import { ethers } from "ethers"
import { v1 } from '../builds'
import { deployContract } from "../singletonFactory"
import { isContract } from "../utils"

// These are the Sequence v1 contracts
// we use them if they are available
const predefinedAddresses = {
  factory: '0xf9D09D634Fb818b05149329C1dcCFAeA53639d96',
  mainModule: '0xd01F11855bCcb95f88D7A48492F66410d4637313',
  mainModuleUpgradable: '0x7EFE6cE415956c5f80C6530cC6cc81b4808F6118',
  guestModule: '0x02390F3E6E5FD1C6786CB78FD3027C117a9955A7',
  multiCallUtils: '0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E'
}

export async function deployV1Context(signer: ethers.Signer) {
  // See if signer's provider has the contracts already deployed
  const provider = signer.provider
  if (provider) {
    if (await Promise.all(Object.values(predefinedAddresses).map(address => isContract(provider, address))).then((r) => r.every((x) => x))) {
      console.log('Using predefined addresses for V1 contracts')

      return {
        version: 1,

        factory: predefinedAddresses.factory,
        mainModule: predefinedAddresses.mainModule,
        mainModuleUpgradable: predefinedAddresses.mainModuleUpgradable,
        guestModule: predefinedAddresses.guestModule,
        multiCallUtils: predefinedAddresses.multiCallUtils,

        walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
      }
    }
  }

  const factory = await deployContract(signer, v1.factory)
  const mainModule = await deployContract(signer, v1.mainModule, factory.address)
  const mainModuleUpgradable = await deployContract(signer, v1.mainModuleUpgradable)
  const guestModule = await deployContract(signer, v1.guestModule)
  const multiCallUtils = await deployContract(signer, v1.multiCallUtils)

  return {
    version: 1,

    factory: factory.address,
    mainModule: mainModule.address,
    mainModuleUpgradable: mainModuleUpgradable.address,
    guestModule: guestModule.address,
    multiCallUtils: multiCallUtils.address,

    walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
  }
}
