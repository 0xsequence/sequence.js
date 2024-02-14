import { ethers } from 'ethers'

import { Factory, GuestModule, MainModule, MainModuleUpgradable, SequenceUtils } from '@0xsequence/wallet-contracts'

const FactoryArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/Factory.sol/Factory.json')
const GuestModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/GuestModule.sol/GuestModule.json')
const MainModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModule.sol/MainModule.json')
const MainModuleUpgradableArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModuleUpgradable.sol/MainModuleUpgradable.json')
const SequenceUtilsArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/SequenceUtils.sol/SequenceUtils.json')
const RequireFreshSignerArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/libs/RequireFreshSigner.sol/RequireFreshSigner.json')

export async function deployWalletContext(
  signer: ethers.Signer
): Promise<[Factory, MainModule, MainModuleUpgradable, GuestModule, SequenceUtils, ethers.BaseContract]> {
  const factory = (await new ethers.ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode,
    signer
  ).deploy()) as unknown as Factory

  const mainModule = (await new ethers.ContractFactory(MainModuleArtifact.abi, MainModuleArtifact.bytecode, signer).deploy(
    factory.address
  )) as unknown as MainModule

  const mainModuleUpgradable = (await new ethers.ContractFactory(
    MainModuleUpgradableArtifact.abi,
    MainModuleUpgradableArtifact.bytecode,
    signer
  ).deploy()) as unknown as MainModuleUpgradable

  const guestModule = (await new ethers.ContractFactory(
    GuestModuleArtifact.abi,
    GuestModuleArtifact.bytecode,
    signer
  ).deploy()) as unknown as GuestModule

  const sequenceUtils = (await new ethers.ContractFactory(
    SequenceUtilsArtifact.abi,
    SequenceUtilsArtifact.bytecode,
    signer
  ).deploy(factory.address, mainModule.address)) as unknown as SequenceUtils

  const requireFreshSigner = await new ethers.ContractFactory(
    RequireFreshSignerArtifact.abi,
    RequireFreshSignerArtifact.bytecode,
    signer
  ).deploy(sequenceUtils.address)

  return [factory, mainModule, mainModuleUpgradable, guestModule, sequenceUtils, requireFreshSigner]
}
