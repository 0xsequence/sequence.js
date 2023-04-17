import { Tenderly, TenderlyConfiguration, VerificationRequest } from '@tenderly/sdk'
import { ethers, ContractFactory, Signer } from 'ethers'
import { createLogger, Logger } from './utils/logger'
import { EtherscanVerificationRequest, EtherscanVerifier } from './verifiers/EtherscanVerifier'
import { TenderlyVerifier } from './verifiers/TenderlyVerifier'

let prompt: Logger
createLogger().then(logger => (prompt = logger))

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)

export class ContractVerifier {

  private readonly tenderlyVerifier: TenderlyVerifier
  private readonly etherscanVerifier: EtherscanVerifier

  constructor(tenderly: TenderlyConfiguration | Tenderly, etherscanApiKey: string, private readonly signer: Signer, networkName = 'homestead') {
    this.tenderlyVerifier = new TenderlyVerifier(tenderly)
    this.etherscanVerifier = new EtherscanVerifier(etherscanApiKey, networkName)
  }

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

  verifyContract = async(
    address: string,
    tenderVerificationRequest: VerificationRequest,
    etherscanVerificationRequest: EtherscanVerificationRequest,
    contractAlias?: string,
  ): Promise<void> => {
    await this.tenderlyVerifier.verifyContract(address, contractAlias ?? etherscanVerificationRequest.contractToVerify, tenderVerificationRequest)
    await this.etherscanVerifier.verifyContract(address, etherscanVerificationRequest)
  }

}
