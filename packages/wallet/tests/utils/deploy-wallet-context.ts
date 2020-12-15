import { ethers } from 'ethers'
import { Provider } from '@ethersproject/providers'

import { Factory } from '@0xsequence/wallet-contracts/typings/contracts/ethers-v5/Factory'
import { GuestModule } from '@0xsequence/wallet-contracts/typings/contracts/ethers-v5/GuestModule'
import { MainModule } from '@0xsequence/wallet-contracts/typings/contracts/ethers-v5/MainModule'
import { MainModuleUpgradable } from '@0xsequence/wallet-contracts/typings/contracts/ethers-v5/MainModuleUpgradable'
import { RequireUtils } from '@0xsequence/wallet-contracts/typings/contracts/ethers-v5/RequireUtils'

const FactoryArtifact = require('@0xsequence/wallet-contracts/artifacts/Factory.json')
const GuestModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/GuestModule.json')
const MainModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/MainModule.json')
const MainModuleUpgradableArtifact = require('@0xsequence/wallet-contracts/artifacts/MainModuleUpgradable.json')
const RequireUtilsArtifact = require('@0xsequence/wallet-contracts/artifacts/RequireUtils.json')

export async function deployWalletContext(provider: Provider): Promise<[
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
