import { Provider } from 'ethers/providers'
import { ethers } from 'ethers'

import { MainModule } from 'arcadeum-wallet/typings/contracts/MainModule'
import { MainModuleUpgradable } from 'arcadeum-wallet/typings/contracts/MainModuleUpgradable'
import { Factory } from 'arcadeum-wallet/typings/contracts/Factory'

const FactoryArtifact = require('arcadeum-wallet/artifacts/Factory.json')
const MainModuleArtifact = require('arcadeum-wallet/artifacts/MainModule.json')
const MainModuleUpgradableArtifact = require('arcadeum-wallet/artifacts/MainModuleUpgradable.json')

ethers.errors.setLogLevel('error')

export async function deployArcadeum(provider: Provider): Promise<[Factory, MainModule, MainModuleUpgradable]> {
  const factory = ((await new ethers.ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown) as Factory

  const mainModule = ((await new ethers.ContractFactory(
    MainModuleArtifact.abi,
    MainModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(factory.address)) as unknown) as MainModule

  const mainModuleUpgradable = ((await new ethers.ContractFactory(
    MainModuleUpgradableArtifact.abi,
    MainModuleUpgradableArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown) as MainModuleUpgradable

  return [factory, mainModule, mainModuleUpgradable]
}
