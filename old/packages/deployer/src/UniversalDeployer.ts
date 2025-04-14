import * as fs from 'fs'
import { ethers } from 'ethers'
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

export class UniversalDeployer {
  private deployedInstances: ContractInstance[] = []
  private signer: Promise<ethers.Signer>

  constructor(
    public networkName: string,
    public provider: ethers.JsonRpcProvider,
    public signerOverride?: ethers.Signer
  ) {
    if (signerOverride) {
      this.signer = Promise.resolve(signerOverride)
    } else {
      this.signer = provider.getSigner()
    }
  }

  deploy = async <T extends ethers.ContractFactory>(
    contractAlias: string,
    contractFactory: new (signer: ethers.Signer) => T,
    txParams?: ethers.TransactionRequest,
    instance?: number | bigint,
    ...args: Parameters<T['deploy']>
  ): Promise<ethers.BaseContract> => {
    try {
      // Deploy universal deployer 2 if not yet deployed on chain_id
      const universalDeployer2Code = await this.provider.getCode(UNIVERSAL_DEPLOYER_2_ADDRESS)
      if (universalDeployer2Code === '0x') {
        await this.deployUniversalDeployer2(txParams)
      }

      // Deploying contract
      prompt.start(`Deploying ${contractAlias}`)
      const factory = new contractFactory(await this.signer)
      const deployTx = await factory.getDeployTransaction(...args)

      // Make sure instance number is specified
      const instanceNumber = instance !== undefined ? BigInt(instance) : 0n

      // Verify if contract already deployed
      const contractAddress = await this.addressOf(contractFactory, instanceNumber, ...args)
      const contractCode = await this.provider.getCode(contractAddress)

      const deployer = UniversalDeployer2__factory.connect(UNIVERSAL_DEPLOYER_2_ADDRESS, await this.signer)

      if (contractCode === '0x') {
        // Deploy contract if not already deployed
        const tx = await deployer.deploy(deployTx.data!, instanceNumber, txParams!)
        await tx.wait()

        // Verify that the deployment was successful since tx won't revert
        const postDeployCode = await this.provider.getCode(contractAddress)
        if (postDeployCode === '0x') {
          prompt.fail(contractAddress)
        } else {
          prompt.succeed()
        }
      } else {
        prompt.warn(`ALREADY DEPLOYED: ${contractAlias}`)
      }

      const contract = factory.attach(contractAddress)
      this.deployedInstances.push({ contractAddress, contractAlias, contract })

      return contract
    } catch (error) {
      throw new Error(`CONTRACT DEPLOY FAILED: ${error}`)
    }
  }

  deployUniversalDeployer = async (txParams?: ethers.TransactionRequest) => {
    if ((await this.provider.getBalance(EOA_UNIVERSAL_DEPLOYER_ADDRESS)) < UNIVERSAL_DEPLOYER_FUNDING) {
      prompt.start("Funding universal deployer's EOA")

      const signer = await this.signer

      const tx = await signer.sendTransaction({
        to: EOA_UNIVERSAL_DEPLOYER_ADDRESS,
        value: UNIVERSAL_DEPLOYER_FUNDING,
        ...txParams
      })

      const receipt = await tx.wait()

      if (receipt?.status === 1) {
        prompt.succeed()
      } else {
        prompt.fail('txn receipt status failed')
      }
    }

    prompt.start('Deploying universal deployer contract')
    await this.provider.broadcastTransaction(UNIVERSAL_DEPLOYER_TX)

    // const universalDeployerCodeCheck = await this.provider.getCode(UNIVERSAL_DEPLOYER_ADDRESS)
    // if (universalDeployerCodeCheck === '0x') {
    //   prompt.fail(UNIVERSAL_DEPLOYER_ADDRESS)
    // } else {
    //   prompt.succeed()
    // }
    prompt.succeed()
  }

  // Deploy universal deployer via universal deployer 1
  deployUniversalDeployer2 = async (txParams?: ethers.TransactionRequest) => {
    const universalDeployerCode = await this.provider.getCode(UNIVERSAL_DEPLOYER_ADDRESS)
    if (universalDeployerCode === '0x') {
      await this.deployUniversalDeployer(txParams)
    } else {
      // NOTE: already deployed
      // eslint-disable-next-line
      ;('ALREADY DEPLOYED')
    }

    // NOTE: in case the getCode below fails, double check the UNIVERSAL_DEPLOYER_2_ADDRESS address
    // which is emitted from the deployer 1 contract creation logs. This address may change if
    // the UNIVERSAL_DEPLOYER_2_BYTECODE changes of the deployer -- which should never really happen.

    const signer = await this.signer

    prompt.start('Deploying universal deployer 2 contract')
    const tx = await signer.sendTransaction({
      to: UNIVERSAL_DEPLOYER_ADDRESS,
      data: UNIVERSAL_DEPLOYER_2_BYTECODE,
      ...txParams
    })
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
        const { contractAddress, contractAlias } = instance
        list[contractAlias] = contractAddress
        return list
      },
      {} as { [key: string]: string }
    )
  }

  getDeploymentList = () =>
    this.deployedInstances.map(({ contractAddress, contractAlias }) => {
      return {
        contractName: contractAlias,
        contractAddress
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

  manualDeploymentRegistration = (contractAlias: string, contractAddress: string) => {
    this.deployedInstances.push({
      contractAlias,
      contractAddress
    })
  }

  addressOf = async <T extends ethers.ContractFactory>(
    contractFactory: new (signer: ethers.Signer) => T,
    contractInstance: number | bigint,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const factory = new contractFactory(await this.signer)
    const deployTx = await factory.getDeployTransaction(...args)
    const deployData = deployTx.data

    const codeHash = ethers.solidityPackedKeccak256(['bytes'], [deployData])

    const salt = ethers.solidityPacked(['uint256'], [contractInstance])

    const hash = ethers.solidityPackedKeccak256(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', UNIVERSAL_DEPLOYER_2_ADDRESS, salt, codeHash]
    )

    return ethers.getAddress(ethers.dataSlice(hash, 12))
  }
}
