import { ethers } from 'ethers'

export interface FactoryDeployedContract {
  address: string
}

export interface ContractInstance {
  contractAddress: string
  contractAlias: string
  contract?: ethers.BaseContract
}

export interface ContractInfo {
  contractName: string
  contractAlias?: string
}
