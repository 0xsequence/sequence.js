import { ethers } from "ethers"
import { v2 } from '../builds'
import { deployContract } from "../utils"

const predefinedAddresses = {
  factory: '0x0D7604Bdf2cAcc2943b6388e1c26c3C33213f673',
  mainModule: '0xA507eF52f3fd34dd54566bf3055fA66bdabE2ef3',
  mainModuleUpgradable: '0x13Cc7b579e1acfDc8aD1F9996dd38ff744818a34',
  guestModule: '0xCcB6cA914c20fAde6F2be5827eE40d899076ac2A'
}

export async function deployV2Context(signer: ethers.Signer) {
  // See if signer's provider has the contracts already deployed
  const provider = signer.provider
  if (provider) {
    if (await provider.getCode(predefinedAddresses.factory).then((c) => ethers.utils.arrayify(c)).then((c) => c.length !== 0)) {
      console.log('Using predefined addresses for V2 contracts')
      return {
        version: 2,

        factory: predefinedAddresses.factory,
        mainModule: predefinedAddresses.mainModule,
        mainModuleUpgradable: predefinedAddresses.mainModuleUpgradable,
        guestModule: predefinedAddresses.guestModule,

        walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
      }
    }
  }

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
