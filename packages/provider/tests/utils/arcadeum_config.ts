import { Provider } from "ethers/providers"
import { ethers } from "ethers"

import { MainModule } from "arcadeum-wallet/typings/contracts/MainModule"
import { Factory } from "arcadeum-wallet/typings/contracts/Factory"

const FactoryArtifact = require("arcadeum-wallet/build/contracts/Factory.json")
const MainModuleArtifact = require("arcadeum-wallet/build/contracts/MainModule.json")

ethers.errors.setLogLevel("error")

export async function deployArcadeum(provider: Provider): Promise<[Factory, MainModule]> {
  const factory = await new ethers.ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy() as unknown as Factory

  const mainModule = await new ethers.ContractFactory(
    MainModuleArtifact.abi,
    MainModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(factory.address) as unknown as MainModule

  return [factory, mainModule]
}
