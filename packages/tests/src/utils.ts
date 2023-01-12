import { ethers } from "ethers"
import { Artifact } from "./builds"

export function deployContract(signer: ethers.Signer, artifact: Artifact, ...args: any[]): Promise<ethers.Contract> {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  return factory.deploy(...args)
}

export function randomBigNumber(
  min: ethers.BigNumberish = 0,
  max: ethers.BigNumberish = ethers.constants.MaxUint256
): ethers.BigNumber {
  const randomHex = ethers.utils.hexlify(ethers.utils.randomBytes(32))
  const randomBn = ethers.BigNumber.from(randomHex)
  const minBn = ethers.BigNumber.from(min)
  const maxBn = ethers.BigNumber.from(max)
  const range = maxBn.sub(minBn)

  if (range.isNegative() || range.isZero()) {
    throw new Error('max must be greater than min')
  }

  return randomBn.mod(range).add(minBn)
}

export function maxForBits(bits: number): ethers.BigNumber {
  return ethers.BigNumber.from(2).pow(bits).sub(1)
}

export function randomBool(): boolean {
  return Math.random() >= 0.5
}

export async function waitForProvider<T extends ethers.providers.Provider>(provider: T, timeout: number = 30000): Promise<T> {
  const start = Date.now()
  while (true) {
    try {
      await provider.getBlockNumber()
      return provider
    } catch (e) {
      if (Date.now() - start > timeout) {
        throw e
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}
