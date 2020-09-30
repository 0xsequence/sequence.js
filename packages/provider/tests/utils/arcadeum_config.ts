import { Provider } from '@ethersproject/providers'
import { ethers } from 'ethers'

import { MainModule } from 'arcadeum-wallet/typings/contracts/MainModule'
import { MainModuleUpgradable } from 'arcadeum-wallet/typings/contracts/MainModuleUpgradable'
import { Factory } from 'arcadeum-wallet/typings/contracts/Factory'
import { GuestModule } from 'arcadeum-wallet/typings/contracts/GuestModule'
import { RequireUtils } from 'arcadeum-wallet/typings/contracts/RequireUtils'

const FactoryArtifact = require('arcadeum-wallet/artifacts/Factory.json')
const MainModuleArtifact = require('arcadeum-wallet/artifacts/MainModule.json')
const MainModuleUpgradableArtifact = require('arcadeum-wallet/artifacts/MainModuleUpgradable.json')
const GuestModuleArtifact = require('arcadeum-wallet/artifacts/GuestModule.json')
const RequireUtilsArtifact = require('arcadeum-wallet/artifacts/RequireUtils.json')

export async function deployArcadeum(provider: Provider): Promise<[
  Factory,
  MainModule,
  MainModuleUpgradable,
  GuestModule,
  RequireUtils
]> {
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

  const guestModule = ((await new ethers.ContractFactory(
    GuestModuleArtifact.abi,
    GuestModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown) as GuestModule

  const requireUtils = ((await new ethers.ContractFactory(
    RequireUtilsArtifact.abi,
    RequireUtilsArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(
    factory.address,
    mainModule.address
  )) as unknown) as RequireUtils

  return [
    factory,
    mainModule,
    mainModuleUpgradable,
    guestModule,
    requireUtils
  ]
}
