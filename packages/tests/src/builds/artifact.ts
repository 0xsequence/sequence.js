import { ethers } from 'ethers'

export type Artifact = {
  contractName: string
  sourceName: string
  abi: ethers.ContractInterface
  bytecode: string
  deployedBytecode: string
}
