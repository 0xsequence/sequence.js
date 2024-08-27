import { ethers } from 'ethers'

export async function encodeData(contract: ethers.Contract, method: string, ...args: any): Promise<string> {
  return (await contract[method].populateTransaction(...args)).data!
}
