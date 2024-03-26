import { ethers } from 'ethers'

export type Artifact = {
  contractName: string
  sourceName: string
  abi: ethers.InterfaceAbi
  bytecode: string
  deployedBytecode: string
}
