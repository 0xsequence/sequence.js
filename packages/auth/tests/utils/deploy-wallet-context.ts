import { ethers } from 'ethers'
import { Provider } from '@ethersproject/providers'

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
  provider: Provider
): Promise<[Factory, MainModule, MainModuleUpgradable, GuestModule, SequenceUtils, RequireFreshSigner]> {
  const factory = (await new ethers.ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown as Factory

  const mainModule = (await new ethers.ContractFactory(
    MainModuleArtifact.abi,
    MainModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(factory.address)) as unknown as MainModule

  const mainModuleUpgradable = (await new ethers.ContractFactory(
    MainModuleUpgradableArtifact.abi,
    MainModuleUpgradableArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown as MainModuleUpgradable

  const guestModule = (await new ethers.ContractFactory(
    GuestModuleArtifact.abi,
    GuestModuleArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy()) as unknown as GuestModule

  const sequenceUtils = (await new ethers.ContractFactory(
    SequenceUtilsArtifact.abi,
    SequenceUtilsArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(factory.address, mainModule.address)) as unknown as SequenceUtils

  const requireFreshSigner = (await new ethers.ContractFactory(
    RequireFreshSignerArtifact.abi,
    RequireFreshSignerArtifact.bytecode,
    (provider as any).getSigner()
  ).deploy(sequenceUtils.address)) as unknown as RequireFreshSigner

  return [factory, mainModule, mainModuleUpgradable, guestModule, sequenceUtils, requireFreshSigner]
}
