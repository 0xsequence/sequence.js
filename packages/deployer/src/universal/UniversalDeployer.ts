import ora from 'ora'
import * as fs from 'fs'
import { ethers } from 'ethers'
import { promisify } from 'util'
import { ContractFactory, ContractTransaction } from 'ethers/contract'
import { EOA_UNIVERSAL_DEPLOYER_ADDRESS, UNIVERSAL_DEPLOYER_ADDRESS, UNIVERSAL_DEPLOYER_FUNDING, UNIVERSAL_DEPLOYER_TX } from '../utils/constants'
import { ContractInstance, FactoryDeployedContract } from './types'

const web3 = (global as any).web3

const prompt = ora({ discardStdin: true })
const provider = new ethers.providers.Web3Provider(web3.currentProvider)
ethers.errors.setLogLevel("off");

export class UniversalDeployer {
  private deployedInstances: ContractInstance[] = []
  constructor(public networkName: string, public signer: ethers.Signer) {}

  deploy = async <T extends ContractFactory>(
    contractAlias: string,
    contractFactory: new (signer: ethers.Signer) => T,
    txParams?: ethers.providers.TransactionRequest,
    ...args: Parameters<T['deploy']>
  ): Promise<ethers.Contract|FactoryDeployedContract> => {
    try {

      const universal_deployer_code = await provider.getCode(UNIVERSAL_DEPLOYER_ADDRESS)
      if (universal_deployer_code === '0x') {
    
        if (await provider.getBalance(EOA_UNIVERSAL_DEPLOYER_ADDRESS) < UNIVERSAL_DEPLOYER_FUNDING) {
          prompt.start("Funding universal deployer's EOA")
          await this.signer.sendTransaction({
            to: EOA_UNIVERSAL_DEPLOYER_ADDRESS,
            value: UNIVERSAL_DEPLOYER_FUNDING,
            ...txParams
          })
          prompt.succeed()
        }
      
        prompt.start('Deploying universal deployer contract')
        await provider.sendTransaction(UNIVERSAL_DEPLOYER_TX)
        prompt.succeed()
      } 

      prompt.start(`Deploying ${contractAlias}`)
      const factory = new contractFactory(this.signer)
      const deploy_tx = await factory.getDeployTransaction(...args)

      // Verify if contract already deployed
      const contract_address = await this.addressOf(contractFactory, ...args)
      const contract_code = await provider.getCode(contract_address)

      const contract: FactoryDeployedContract = {address: contract_address}

      if (contract_code === '0x') {

        // Deploy contract if not already deployed
        const tx = await this.signer.sendTransaction({
          to: UNIVERSAL_DEPLOYER_ADDRESS,
          data: deploy_tx.data,
          ...txParams
        }) as ContractTransaction
        const receipt = await tx.wait(1)
        const logs = receipt.logs![0].data
        const contract_address_log: string = ethers.utils.defaultAbiCoder.decode(['address'], logs)[0]

        // Verify that the deployment was successful since tx won't revert
        if (contract_address_log === ethers.constants.AddressZero || contract_address_log !== contract_address) {
          prompt.fail()
        } else {
          prompt.succeed()
        }

      } else {
        prompt.warn(`ALREADY DEPLOYED: ${contractAlias}`)
      }

      this.deployedInstances.push({contractAlias, contract})
      return contract
    } catch (error) {
      console.error(error)
      throw new Error('CONTRACT DEPLOY FAILED')
    }
  }

  manualDeploymentRegistration = (
    contractAlias: string,
    address: string,
    transactionHash: string
  ) => {
    this.deployedInstances.push({
      contractAlias,
      contract: { address, transactionHash }
    })
  }

  registerDeployment = async () =>
    promisify(fs.writeFile)(
      `./networks/${this.networkName}.json`,
      JSON.stringify(
        this.deployedInstances.map(({ contract, contractAlias }) => {
          if (contract instanceof ethers.Contract) {
            return {
              contractName: contractAlias,
              address: contract.address,
              transactionHash: contract.deployTransaction.hash
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
      )
    )
  

  addressOf = async <T extends ContractFactory>(
    contractFactory: new (signer: ethers.Signer) => T,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const factory = new contractFactory(this.signer)
    const deploy_tx = await factory.getDeployTransaction(...args)
    const deploy_data = deploy_tx.data
  
    const codeHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes'], [deploy_data])
    )

    const salt = ethers.utils.formatBytes32String('')

    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', UNIVERSAL_DEPLOYER_ADDRESS, salt, codeHash])
    )

    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }

}