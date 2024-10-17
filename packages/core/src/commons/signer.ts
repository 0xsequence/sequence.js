import { ethers } from 'ethers'
import { isValidEIP1271Signature } from './validateEIP1271'

export enum SigType {
  EIP712 = 1,
  ETH_SIGN = 2,
  WALLET_BYTES32 = 3
}

export function canRecover(signature: ethers.BytesLike) {
  const bytes = ethers.getBytes(signature)
  const type = bytes[bytes.length - 1]

  return type === SigType.EIP712 || type === SigType.ETH_SIGN
}

export function recoverSigner(digest: ethers.BytesLike, signature: ethers.BytesLike) {
  const bytes = ethers.getBytes(signature)
  const digestBytes = ethers.getBytes(digest)

  // type is last byte
  const type = bytes[bytes.length - 1]

  // Split r:s:v
  const r = ethers.hexlify(bytes.slice(0, 32))
  const s = ethers.hexlify(bytes.slice(32, 64))
  const v = Number(ethers.hexlify(bytes.slice(64, 65)))

  const splitSignature = { r, s, v }

  if (type === SigType.EIP712) {
    return ethers.recoverAddress(digestBytes, splitSignature)
  }

  if (type === SigType.ETH_SIGN) {
    return ethers.recoverAddress(ethers.hashMessage(digestBytes), splitSignature)
  }

  throw new Error(`Unsupported signature type: ${type}`)
}

export function isValidSignature(
  address: string,
  digest: ethers.BytesLike,
  signature: ethers.BytesLike,
  provider: ethers.Provider
) {
  const bytes = ethers.getBytes(signature)

  // type is last byte
  const type = bytes[bytes.length - 1]

  if (type === SigType.EIP712 || type === SigType.ETH_SIGN) {
    return address === recoverSigner(digest, signature)
  }

  if (type === SigType.WALLET_BYTES32) {
    return isValidEIP1271Signature(address, ethers.hexlify(digest), bytes.slice(0, -1), provider)
  }

  throw new Error(`Unsupported signature type: ${type}`)
}

export function tryRecoverSigner(digest: ethers.BytesLike, signature: ethers.BytesLike): string | undefined {
  const bytes = ethers.getBytes(signature)
  if (bytes.length !== 66) return undefined

  try {
    return recoverSigner(digest, bytes)
  } catch {}

  return undefined
}
