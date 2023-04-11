import { Tenderly, TenderlyConfiguration, VerificationRequest } from '@tenderly/sdk'
import { ethers, ContractFactory } from 'ethers'
import { createLogger, Logger } from './utils/logger'
import { UniversalDeployer } from './UniversalDeployer'

let prompt: Logger
createLogger().then(logger => (prompt = logger))

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)

export class UniversalValidator extends UniversalDeployer {
  validateBytecode = <T extends ContractFactory>(
    contractFactory: new (signer: ethers.Signer) => T,
    expectedBytecode: string
  ): void => {
    // Validate contract bytecode
    const factory = new contractFactory(this.signer)
    if (factory.bytecode !== expectedBytecode) {
      throw new Error(`Bytecode mismatch`)
    }
  }

  verifyContract = async <T extends ContractFactory>(
    tenderlyConfig: TenderlyConfiguration,
    tenderVerificationRequest: VerificationRequest,
    contractAlias: string,
    contractFactory: new (signer: ethers.Signer) => T,
    instance: number | ethers.BigNumber,
    ...args: Parameters<T['deploy']>
  ): Promise<void> => {
    const address = await this.addressOf(contractFactory, instance ?? 0, ...args)

    const tenderly = new Tenderly(tenderlyConfig)
    await this.verifyContractTenderly(address, contractAlias, tenderly, tenderVerificationRequest)
  }

  verifyContractTenderly = async (
    address: string,
    contractAlias: string,
    tenderly: Tenderly,
    tenderVerificationRequest: VerificationRequest
  ): Promise<void> => {
    const addr = address.toLowerCase()

    await tenderly.contracts.add(addr, { displayName: contractAlias })
    await tenderly.contracts.verify(addr, tenderVerificationRequest)
  }

}
