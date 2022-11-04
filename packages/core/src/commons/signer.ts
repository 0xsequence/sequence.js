import { ethers } from "ethers"
import { isValidEIP1271Signature } from "./validateEIP1271"

export enum SigType {
  EIP712 = 1,
  ETH_SIGN = 2,
  WALLET_BYTES32 = 3
}

export function recoverSigner(digest: ethers.BytesLike, signature: ethers.BytesLike) {
  const bytes = ethers.utils.arrayify(signature)

  // type is last byte
  const type = bytes[bytes.length - 1]

  // Split r:s:v
  const r = ethers.utils.hexlify(bytes.slice(0, 32))
  const s = ethers.utils.hexlify(bytes.slice(32, 64))
  const v = ethers.BigNumber.from(bytes.slice(64, 65)).toNumber()

  const splitSignature = { r, s, v }

  if (type === SigType.EIP712) {
    return ethers.utils.recoverAddress(digest, splitSignature)
  }

  if (type === SigType.ETH_SIGN) {
    return ethers.utils.recoverAddress(ethers.utils.hashMessage(digest), splitSignature)
  }

  throw new Error(`Unsupported signature type: ${type}`)
}

export function isValidSignature(
  address: string,
  digest: string,
  signature: ethers.BytesLike,
  provider: ethers.providers.Provider
) {
  const bytes = ethers.utils.arrayify(signature)

  // type is last byte
  const type = bytes[bytes.length - 1]

  if (type === SigType.EIP712 || type === SigType.ETH_SIGN) {
    return address === recoverSigner(digest, signature)
  }

  if (type === SigType.WALLET_BYTES32) {
    return isValidEIP1271Signature(address, digest, bytes.slice(0, -1), provider)
  }

  throw new Error(`Unsupported signature type: ${type}`)
}
