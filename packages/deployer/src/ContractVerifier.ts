import { SolidityCompilerVersions, Tenderly, TenderlyConfiguration, VerificationRequest } from '@tenderly/sdk'
import { ethers, ContractFactory, Signer } from 'ethers'
import { createLogger, Logger } from './utils/logger'
import { EtherscanVerificationRequest, EtherscanVerifier } from './verifiers/EtherscanVerifier'
import { TenderlyVerifier } from './verifiers/TenderlyVerifier'

let prompt: Logger
createLogger().then(logger => (prompt = logger))

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)

type SolidityCompilerVersion = `v${number}.${number}.${number}` | `v${number}.${number}.${number}+commit.${string}`;
type Path = string
type Web3Address = string

export type ContractVerificationRequest = {
  contractToVerify: string,
  version: SolidityCompilerVersion,
  sources: Record<Path, { // File path to source content
      content: string;
  }>,
  settings: {
    optimizer: {
      enabled: boolean,
      runs: number,
      details?: {
        yul?: boolean,
      },
    },
    libraries?: Record<Path, Record<string, Web3Address>>;
    remappings?: string[];
  },
  waitForSuccess: boolean,
}

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
    verificationRequest: ContractVerificationRequest,
  ): Promise<void> => {

    const version = verificationRequest.version.split('+')[0] as SolidityCompilerVersions // Simple version for tenderly

    // Construct different verification requests
    const tenderVerificationRequest: VerificationRequest = {
      contractToVerify: verificationRequest.contractToVerify,
      solc: {
        version,
        sources: verificationRequest.sources,
        settings: {
          optimizer: verificationRequest.settings.optimizer,
        },
      },
      config: { // Default mode public
        mode: 'public',
      },
    }

    const etherscanVerificationRequest: EtherscanVerificationRequest = {
      contractToVerify: verificationRequest.contractToVerify,
      version,
      compilerInput: {
        language: 'Solidity',
        sources: verificationRequest.sources,
        settings: {
          optimizer: verificationRequest.settings.optimizer,
          outputSelection: { // Default output selection
            '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers', 'metadata'], '': ['ast'] }
          },
          remappings: verificationRequest.settings.remappings,
        },
      },
      waitForSuccess: verificationRequest.waitForSuccess,
    }

    await this.tenderlyVerifier.verifyContract(address, verificationRequest.contractToVerify, tenderVerificationRequest)
    await this.etherscanVerifier.verifyContract(address, etherscanVerificationRequest)
  }

}
