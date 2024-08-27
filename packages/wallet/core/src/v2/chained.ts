import { ethers } from 'ethers'

//                              = keccak256("SetImageHash(bytes32 imageHash)")
export const SetImageHashPrefix = '0x8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d1'

export function hashSetImageHash(imageHash: string): string {
  return ethers.keccak256(messageSetImageHash(imageHash))
}

export function messageSetImageHash(imageHash: string) {
  return ethers.solidityPacked(['bytes32', 'bytes32'], [SetImageHashPrefix, imageHash])
}

export function decodeMessageSetImageHash(message: ethers.BytesLike): string | undefined {
  const arr = ethers.getBytes(message)

  if (arr.length !== 64) {
    return undefined
  }

  if (ethers.hexlify(arr.slice(0, 32)) !== SetImageHashPrefix) {
    return undefined
  }

  return ethers.hexlify(arr.slice(32, 64))
}

export function isMessageSetImageHash(message: ethers.BytesLike): boolean {
  return decodeMessageSetImageHash(message) !== undefined
}
