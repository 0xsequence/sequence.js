import * as ora from 'ora'
import * as fs from 'fs'
import { ethers } from 'ethers'
import { promisify } from 'util'
import { UniversalDeployer2Factory } from "../../typings/contracts/UniversalDeployer2Factory"
import { ContractFactory, ContractTransaction } from 'ethers'
import { EOA_UNIVERSAL_DEPLOYER_ADDRESS, UNIVERSAL_DEPLOYER_ADDRESS, UNIVERSAL_DEPLOYER_2_ADDRESS, UNIVERSAL_DEPLOYER_FUNDING, UNIVERSAL_DEPLOYER_TX } from '../utils/constants'
import { ContractInstance } from './types'

const prompt = ora({ discardStdin: true })
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF);


export class UniversalDeployer {
  public provider: ethers.providers.JsonRpcProvider
  private deployedInstances: ContractInstance[] = []

  constructor(public networkName: string, public signer: ethers.Signer, private _provider?: ethers.providers.JsonRpcProvider) {
    const web3 = (global as any).web3
    if (!_provider) {
      this.provider = new ethers.providers.Web3Provider(web3.currentProvider)
    } else {
      this.provider = _provider
    }
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
      const universal_deployer_2_code = await this.provider.getCode(UNIVERSAL_DEPLOYER_2_ADDRESS)
      if (universal_deployer_2_code === '0x') await this.deployUniversalDeployer2(txParams)

      // Deploying contract
      prompt.start(`Deploying ${contractAlias}`)
      const factory = new contractFactory(this.signer)
      const deploy_tx = await factory.getDeployTransaction(...args)

      // Make sure instance number is specified
      let instance_number = instance !== undefined ? instance : 0

      // Verify if contract already deployed
      const contract_address = await this.addressOf(contractFactory, instance_number, ...args)
      const contract_code = await this.provider.getCode(contract_address)

      const deployer = UniversalDeployer2Factory.connect(UNIVERSAL_DEPLOYER_2_ADDRESS, this.signer)

      if (contract_code === '0x') {
        // Deploy contract if not already deployed
        const tx = await deployer.functions.deploy(deploy_tx.data!, instance_number, txParams) as ContractTransaction
        await tx.wait()

        // Verify that the deployment was successful since tx won't revert
        const post_deploy_code =  await this.provider.getCode(contract_address)
        post_deploy_code === '0x' ?  prompt.fail() : prompt.succeed()

      } else {
        prompt.warn(`ALREADY DEPLOYED: ${contractAlias}`)
      }

      const contract = factory.attach(contract_address)
      this.deployedInstances.push({contractAlias, contract})
      
      return contract
    } catch (error) {
      console.error(error)
      throw new Error('CONTRACT DEPLOY FAILED')
    }
  }

  deployUniversalDeployer = async (txParams?: ethers.providers.TransactionRequest) => {
    if (await this.provider.getBalance(EOA_UNIVERSAL_DEPLOYER_ADDRESS) < UNIVERSAL_DEPLOYER_FUNDING) {
      prompt.start("Funding universal deployer's EOA")
      let tx = await this.signer.sendTransaction({
        to: EOA_UNIVERSAL_DEPLOYER_ADDRESS,
        value: UNIVERSAL_DEPLOYER_FUNDING,
        ...txParams
      })
      await tx.wait()
      prompt.succeed()
    }
  
    prompt.start('Deploying universal deployer contract')
    await this.provider.sendTransaction(UNIVERSAL_DEPLOYER_TX)
    prompt.succeed()
  }

  // Deploy universal deployer via universal deployer 1
  deployUniversalDeployer2 = async (txParams?: ethers.providers.TransactionRequest) => {
    const universal_deployer_code = await this.provider.getCode(UNIVERSAL_DEPLOYER_ADDRESS)
    if (universal_deployer_code === '0x') {
      await this.deployUniversalDeployer(txParams)
    } else {
      'ALREADY DEPLOYED'
    }

    const universal_deployer_2_factory = new UniversalDeployer2Factory(this.signer)
    const universal_deployer_2_deploy_tx = await universal_deployer_2_factory.getDeployTransaction()

    prompt.start('Deploying universal deployer 2 contract')
    let tx = await this.signer.sendTransaction({
      to: UNIVERSAL_DEPLOYER_ADDRESS,
      data: universal_deployer_2_deploy_tx.data,
      ...txParams
    }) as ContractTransaction
    await tx.wait()
    prompt.succeed()
  }

  registerDeployment = async (filePath?: string) =>
    promisify(fs.writeFile)(
      filePath ? filePath : `./networks/${this.networkName}.json`,
      JSON.stringify(
        this.deployedInstances.map(({ contract, contractAlias }) => {
          if (contract as ethers.Contract) {
            return {
              contractName: contractAlias,
              address: contract.address,
              // abi: contract.interface.abi
            }
          } else {
            return {
              contractName: contractAlias, 
              address: contract.address,
            }
          }
        }),
        null,
        2
      ),
      { flag: 'w+' }
    )
  
  manualDeploymentRegistration = (
    contractAlias: string,
    address: string,
  ) => {
    this.deployedInstances.push({
      contractAlias,
      contract: {address: address}
    })
  }
  
  addressOf = async <T extends ContractFactory>(
    contractFactory: new (signer: ethers.Signer) => T,
    contractInstance: number | ethers.BigNumber,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const factory = new contractFactory(this.signer)
    const deploy_tx = await factory.getDeployTransaction(...args)
    const deploy_data = deploy_tx.data
  
    const codeHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes'], [deploy_data])
    )

    const salt = ethers.utils.solidityPack(['uint256'], [contractInstance])

    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', UNIVERSAL_DEPLOYER_2_ADDRESS, salt, codeHash])
    )

    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }

}