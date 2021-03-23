import { ethers } from 'ethers'
import { Provider } from '@ethersproject/providers'

import { Factory } from '@0xsequence/wallet-contracts/typings/contracts/Factory'
import { GuestModule } from '@0xsequence/wallet-contracts/typings/contracts/GuestModule'
import { MainModule } from '@0xsequence/wallet-contracts/typings/contracts/MainModule'
import { MainModuleUpgradable } from '@0xsequence/wallet-contracts/typings/contracts/MainModuleUpgradable'
import { SequenceUtils } from '@0xsequence/wallet-contracts/typings/contracts/SequenceUtils'

const FactoryArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/Factory.sol/Factory.json')
const GuestModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/GuestModule.sol/GuestModule.json')
const MainModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModule.sol/MainModule.json')
const MainModuleUpgradableArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModuleUpgradable.sol/MainModuleUpgradable.json')
const SequenceUtilsArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/SequenceUtils.sol/SequenceUtils.json')

export async function deployWalletContext(signer: ethers.Signer): Promise<[
  Factory,
  MainModule,
  MainModuleUpgradable,
  GuestModule,
  SequenceUtils
]> {
  const factory = ((await new ethers.ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode,
    signer
  ).deploy()) as unknown) as Factory

  const mainModule = ((await new ethers.ContractFactory(
    MainModuleArtifact.abi,
    MainModuleArtifact.bytecode,
    signer
  ).deploy(factory.address)) as unknown) as MainModule

  const mainModuleUpgradable = ((await new ethers.ContractFactory(
    MainModuleUpgradableArtifact.abi,
    MainModuleUpgradableArtifact.bytecode,
    signer
  ).deploy()) as unknown) as MainModuleUpgradable

  const guestModule = ((await new ethers.ContractFactory(
    GuestModuleArtifact.abi,
    GuestModuleArtifact.bytecode,
    signer
  ).deploy()) as unknown) as GuestModule

  const sequenceUtils = ((await new ethers.ContractFactory(
    SequenceUtilsArtifact.abi,
    SequenceUtilsArtifact.bytecode,
    signer
  ).deploy(
    factory.address,
    mainModule.address
  )) as unknown) as SequenceUtils

  return [
    factory,
    mainModule,
    mainModuleUpgradable,
    guestModule,
    sequenceUtils
  ]
}
