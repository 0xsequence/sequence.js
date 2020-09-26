import { Contract } from 'ethers'

export interface FactoryDeployedContract {
  address: string
}

export interface ContractInstance {
  contractAlias: string
  contract: Contract | FactoryDeployedContract
}

export interface ContractInfo {
  contractName: string
  contractAlias?: string
}
