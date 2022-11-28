import { ethers } from "ethers"
import { Artifact } from "./builds"

export function deployContract(signer: ethers.Signer, artifact: Artifact, ...args: any[]): Promise<ethers.Contract> {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  return factory.deploy(...args)
}
