import { ethers } from 'ethers'
import { BigIntish } from './bigint'

export const encodeMessageDigest = (message: string | Uint8Array) => {
  if (typeof message === 'string') {
    return ethers.getBytes(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message)))
  } else {
    return ethers.getBytes(ethers.utils.keccak256(message))
  }
}

// packMessageData encodes the specified data ready for the Sequence Wallet contracts.
export const packMessageData = (walletAddress: string, chainId: BigIntish, digest: ethers.BytesLike): string => {
  return ethers.solidityPacked(['string', 'uint256', 'address', 'bytes32'], ['\x19\x01', chainId, walletAddress, digest])
}

export const subDigestOf = (address: string, chainId: BigIntish, digest: ethers.BytesLike): string => {
  return ethers.utils.keccak256(packMessageData(address, chainId, digest))
}
