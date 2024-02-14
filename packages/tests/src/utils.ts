import { ethers } from 'ethers'
import { Artifact } from './builds'
import { BigIntish, MAX_UINT_256 } from '@0xsequence/utils'

export function deployContract(signer: ethers.Signer, artifact: Artifact, ...args: any[]): Promise<ethers.Contract> {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  return factory.deploy(...args)
}

export function randomBigInt(min: BigIntish = 0, max: BigIntish = MAX_UINT_256): bigint {
  const randomHex = ethers.utils.hexlify(ethers.utils.randomBytes(32))
  const randomNumber = BigInt(randomHex)
  const minNumber = BigInt(min)
  const maxNumber = BigInt(max)
  const range = maxNumber - minNumber

  if (range < 0n || range === 0n) {
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

export async function isContract(provider: ethers.providers.Provider, address: string): Promise<boolean> {
  const c = await provider.getCode(address)
  return ethers.getBytes(c).length > 0
}
