import { ethers } from "ethers"
import { v2 } from '../builds'
import { deployContract } from "../utils"

export async function deployV2Context(signer: ethers.Signer) {
  const factory = await deployContract(signer, v2.factory)
  const mainModuleUpgradable = await deployContract(signer, v2.mainModuleUpgradable)
  const mainModule = await deployContract(signer, v2.mainModule, factory.address, mainModuleUpgradable.address)
  const guestModule = await deployContract(signer, v2.guestModule)

  return {
    version: 2,

    factory: factory.address,
    mainModule: mainModule.address,
    mainModuleUpgradable: mainModuleUpgradable.address,
    guestModule: guestModule.address,

    walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
  }
}
