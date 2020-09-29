import { Contract } from 'ethers'

export interface FactoryDeployedContract {
  address: string
}

export interface ContractInstance {
  contractAlias: string
  contract: Contract | {address: string}
}

export interface ContractInfo {
  contractName: string
  contractAlias?: string
}
