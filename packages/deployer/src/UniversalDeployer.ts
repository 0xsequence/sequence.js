import * as fs from 'fs'
import { ethers, ContractFactory, ContractTransaction } from 'ethers'
import { promisify, isNode } from '@0xsequence/utils'
import { UniversalDeployer2__factory } from './typings/contracts'
import {
  EOA_UNIVERSAL_DEPLOYER_ADDRESS,
  UNIVERSAL_DEPLOYER_ADDRESS,
  UNIVERSAL_DEPLOYER_2_ADDRESS,
  UNIVERSAL_DEPLOYER_FUNDING,
  UNIVERSAL_DEPLOYER_TX,
  UNIVERSAL_DEPLOYER_2_BYTECODE
} from './constants'
import { ContractInstance } from './types'
import { createLogger, Logger } from './utils/logger'

let prompt: Logger
createLogger().then(logger => (prompt = logger))

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)

export class UniversalDeployer {
  private deployedInstances: ContractInstance[] = []
  private signer: ethers.Signer

  constructor(
    public networkName: string,
    public provider: ethers.providers.JsonRpcProvider,
    public signerOverride?: ethers.Signer
  ) {
    this.signer = signerOverride || provider.getSigner()
  }

  deploy = async <T extends ContractFactory>(
    contractAlias: string,
    contractFactory: new (signer: ethers.Signer) => T,
    txParams?: ethers.providers.TransactionRequest,
    instance?: number | ethers.BigNumber,
    ...args: Parameters<T['deploy']>
  ): Promise<ethers.Contract> => {
    try {
      // Deploy universal deployer 2 if not yet deployed on chain_id
      const universalDeployer2Code = await this.provider.getCode(UNIVERSAL_DEPLOYER_2_ADDRESS)
      if (universalDeployer2Code === '0x') await this.deployUniversalDeployer2(txParams)

      // Deploying contract
      prompt.start(`Deploying ${contractAlias}`)
      const factory = new contractFactory(this.signer)
      const deployTx = await factory.getDeployTransaction(...args)

      // Make sure instance number is specified
      const instanceNumber = instance !== undefined ? instance : 0

      // Verify if contract already deployed
      const contractAddress = await this.addressOf(contractFactory, instanceNumber, ...args)
      const contractCode = await this.provider.getCode(contractAddress)

      const deployer = UniversalDeployer2__factory.connect(UNIVERSAL_DEPLOYER_2_ADDRESS, this.signer)

      if (contractCode === '0x') {
        // Deploy contract if not already deployed
        const tx = (await deployer.functions.deploy(deployTx.data!, instanceNumber, txParams)) as ContractTransaction
        await tx.wait()

        // Verify that the deployment was successful since tx won't revert
        const postDeployCode = await this.provider.getCode(contractAddress)
        postDeployCode === '0x' ? prompt.fail(contractAddress) : prompt.succeed()
      } else {
        prompt.warn(`ALREADY DEPLOYED: ${contractAlias}`)
      }

      const contract = factory.attach(contractAddress)
      this.deployedInstances.push({ contractAlias, contract })

      return contract
    } catch (error) {
      throw new Error(`CONTRACT DEPLOY FAILED: ${error}`)
    }
  }

  deployUniversalDeployer = async (txParams?: ethers.providers.TransactionRequest) => {
    if ((await this.provider.getBalance(EOA_UNIVERSAL_DEPLOYER_ADDRESS)) < UNIVERSAL_DEPLOYER_FUNDING) {
      prompt.start("Funding universal deployer's EOA")
      const tx = await this.signer.sendTransaction({
        to: EOA_UNIVERSAL_DEPLOYER_ADDRESS,
        value: UNIVERSAL_DEPLOYER_FUNDING,
        ...txParams
      })
      const receipt = await tx.wait()
      if (receipt.status !== 1) {
        prompt.fail('txn receipt status failed')
      } else {
        prompt.succeed()
      }
    }

    prompt.start('Deploying universal deployer contract')
    const tx2 = await this.provider.sendTransaction(UNIVERSAL_DEPLOYER_TX)
    // await tx2.wait()

    // const universalDeployerCodeCheck = await this.provider.getCode(UNIVERSAL_DEPLOYER_ADDRESS)
    // if (universalDeployerCodeCheck === '0x') {
    //   prompt.fail(UNIVERSAL_DEPLOYER_ADDRESS)
    // } else {
    //   prompt.succeed()
    // }
    prompt.succeed()
  }

  // Deploy universal deployer via universal deployer 1
  deployUniversalDeployer2 = async (txParams?: ethers.providers.TransactionRequest) => {
    const universalDeployerCode = await this.provider.getCode(UNIVERSAL_DEPLOYER_ADDRESS)
    if (universalDeployerCode === '0x') {
      await this.deployUniversalDeployer(txParams)
    } else {
      ;('ALREADY DEPLOYED')
    }

    // NOTE: in case the getCode below fails, double check the UNIVERSAL_DEPLOYER_2_ADDRESS address
    // which is emitted from the deployer 1 contract creation logs. This address may change if
    // the UNIVERSAL_DEPLOYER_2_BYTECODE changes of the deployer -- which should never really happen.

    prompt.start('Deploying universal deployer 2 contract')
    const tx = (await this.signer.sendTransaction({
      to: UNIVERSAL_DEPLOYER_ADDRESS,
      data: UNIVERSAL_DEPLOYER_2_BYTECODE,
      ...txParams
    })) as ContractTransaction
    await tx.wait()

    // const universalDeployer2CodeCheck = await this.provider.getCode(UNIVERSAL_DEPLOYER_2_ADDRESS)
    // if (universalDeployer2CodeCheck === '0x') {
    //   prompt.fail(UNIVERSAL_DEPLOYER_2_ADDRESS)
    // } else {
    //   prompt.succeed()
    // }
    prompt.succeed()
  }

  getDeployment = () => {
    return this.deployedInstances.reduce(
      (list, instance) => {
        const { contract, contractAlias } = instance
        list[contractAlias] = contract
        return list
      },
      {} as { [key: string]: ethers.Contract | { address: string } }
    )
  }

  getDeploymentList = () =>
    this.deployedInstances.map(({ contract, contractAlias }) => {
      if (contract as ethers.Contract) {
        return {
          contractName: contractAlias,
          address: contract.address
          // abi: contract.interface.abi
        }
      } else {
        return {
          contractName: contractAlias,
          address: contract.address
        }
      }
    })

  registerDeployment = async (filePath?: string) => {
    if (!isNode()) {
      throw new Error('registerDeployment cannot be run in a browser. Node is required. Try the getDeployment() method.')
    }

    return promisify<any, any, any, any>(fs.writeFile)(
      filePath ? filePath : `./networks/${this.networkName}.json`,
      JSON.stringify(this.getDeployment(), null, 2),
      { flag: 'w+' }
    )
  }

  manualDeploymentRegistration = (contractAlias: string, address: string) => {
    this.deployedInstances.push({
      contractAlias,
      contract: { address: address }
    })
  }

  addressOf = async <T extends ContractFactory>(
    contractFactory: new (signer: ethers.Signer) => T,
    contractInstance: number | ethers.BigNumber,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const factory = new contractFactory(this.signer)
    const deployTx = await factory.getDeployTransaction(...args)
    const deployData = deployTx.data

    const codeHash = ethers.utils.keccak256(ethers.utils.solidityPack(['bytes'], [deployData]))

    const salt = ethers.utils.solidityPack(['uint256'], [contractInstance])

    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        ['0xff', UNIVERSAL_DEPLOYER_2_ADDRESS, salt, codeHash]
      )
    )

    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }
}
