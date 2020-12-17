import { ethers } from 'ethers'

export async function encodeData(contract: ethers.Contract, method: string, ...args: any): Promise<string> {
  return (await contract.populateTransaction[method](...args)).data
}
