import { ethers } from 'ethers'
import { Artifact } from './builds'
import { MAX_UINT_256 } from '@0xsequence/utils'

export function deployContract(signer: ethers.Signer, artifact: Artifact, ...args: any[]) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  return factory.deploy(...args)
}

export function randomBigInt(min: ethers.BigNumberish = 0, max: ethers.BigNumberish = MAX_UINT_256): bigint {
  const randomHex = ethers.hexlify(ethers.randomBytes(32))
  const randomNumber = BigInt(randomHex)
  const minNumber = BigInt(min)
  const maxNumber = BigInt(max)
  const range = maxNumber - minNumber

  if (range <= 0n) {
    throw new Error('max must be greater than min')
  }

  return (randomNumber % range) + minNumber
}

export function maxForBits(bits: number): bigint {
  return 2n ** BigInt(bits) - 1n
}

export function randomBool(): boolean {
  return Math.random() >= 0.5
}

export async function isContract(provider: ethers.Provider, address: string): Promise<boolean> {
  const c = await provider.getCode(address)
  return ethers.getBytes(c).length > 0
}
