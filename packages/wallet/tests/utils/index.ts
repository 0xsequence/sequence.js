import { Contract } from 'ethers'

export async function encodeData(contract: Contract, method: string, ...args: any): Promise<string> {
  return (await contract.populateTransaction[method](...args)).data!
}
