import { ethers } from 'ethers'
import { v2 } from '../builds'
import { deployContract } from '../singletonFactory'
import { WalletContext } from '@0xsequence/core/src/v2/context'

export async function deployV2Context(signer: ethers.Signer): Promise<WalletContext> {
  // See if signer's provider has the contracts already deployed
  const factory = await deployContract(signer, v2.factory)
  const mainModuleUpgradable = await deployContract(signer, v2.mainModuleUpgradable)
  const mainModule = await deployContract(signer, v2.mainModule, factory.address, mainModuleUpgradable.address)
  const guestModule = await deployContract(signer, v2.guestModule)
  const universalSigValidator = await deployContract(signer, v2.universalSigValidator)

  return {
    version: 2,

    factory: await factory.getAddress(),
    mainModule: await mainModule.getAddress(),
    mainModuleUpgradable: await mainModuleUpgradable.getAddress(),
    guestModule: await guestModule.getAddress(),
    universalSigValidator: await universalSigValidator.getAddress(),

    walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
  }
}
