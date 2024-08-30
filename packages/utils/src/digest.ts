import { ethers } from 'ethers'

export const encodeMessageDigest = (message: string | ethers.BytesLike) => {
  if (typeof message === 'string') {
    return ethers.getBytes(ethers.id(message))
  } else {
    return ethers.getBytes(ethers.keccak256(message))
  }
}

// packMessageData encodes the specified data ready for the Sequence Wallet contracts.
export const packMessageData = (walletAddress: string, chainId: ethers.BigNumberish, digest: ethers.BytesLike): string => {
  return ethers.solidityPacked(['string', 'uint256', 'address', 'bytes32'], ['\x19\x01', chainId, walletAddress, digest])
}

export const subDigestOf = (address: string, chainId: ethers.BigNumberish, digest: ethers.BytesLike): string => {
  return ethers.keccak256(packMessageData(address, chainId, digest))
}
