import { ethers, providers } from 'ethers'

import {
  Factory,
  GuestModule,
  MainModule,
  MainModuleUpgradable,
  SequenceUtils,
  RequireFreshSigner
} from '@0xsequence/wallet-contracts'

const FactoryArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/Factory.sol/Factory.json')
const GuestModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/GuestModule.sol/GuestModule.json')
const MainModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModule.sol/MainModule.json')
const MainModuleUpgradableArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModuleUpgradable.sol/MainModuleUpgradable.json')
const SequenceUtilsArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/SequenceUtils.sol/SequenceUtils.json')
const RequireFreshSignerArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/libs/RequireFreshSigner.sol/RequireFreshSigner.json')

export async function deployWalletContext(
  provider: providers.Provider
): Promise<[Factory, MainModule, MainModuleUpgradable, GuestModule, SequenceUtils, RequireFreshSigner]> {
  const factory = (await new ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown as Factory

  const mainModule = (await new ContractFactory(
    MainModuleArtifact.abi,
    MainModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(factory.address)) as unknown as MainModule

  const mainModuleUpgradable = (await new ContractFactory(
    MainModuleUpgradableArtifact.abi,
    MainModuleUpgradableArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown as MainModuleUpgradable

  const guestModule = (await new ContractFactory(
    GuestModuleArtifact.abi,
    GuestModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown as GuestModule

  const sequenceUtils = (await new ContractFactory(
    SequenceUtilsArtifact.abi,
    SequenceUtilsArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(factory.address, mainModule.address)) as unknown as SequenceUtils

  const requireFreshSigner = (await new ContractFactory(
    RequireFreshSignerArtifact.abi,
    RequireFreshSignerArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(sequenceUtils.address)) as unknown as RequireFreshSigner

  return [factory, mainModule, mainModuleUpgradable, guestModule, sequenceUtils, requireFreshSigner]
}
