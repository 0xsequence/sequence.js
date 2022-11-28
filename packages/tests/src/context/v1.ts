import { ethers } from "ethers"
import { v1 } from '../builds'
import { deployContract } from "../utils"

export async function deployV1Context(signer: ethers.Signer) {
  const factory = await deployContract(signer, v1.Factory)
  const mainModule = await deployContract(signer, v1.MainModule, factory.address)
  const mainModuleUpgradable = await deployContract(signer, v1.MainModuleUpgradable)
  const guestModule = await deployContract(signer, v1.GuestModule)
  const multiCallUtils = await deployContract(signer, v1.MultiCallUtils)

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
