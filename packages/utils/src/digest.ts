import { BigNumberish, BytesLike, getBytes, keccak256, solidityPacked, toUtf8Bytes } from 'ethers'

export const encodeMessageDigest = (message: string | Uint8Array) => {
  if (typeof message === 'string') {
    return getBytes(keccak256(toUtf8Bytes(message)))
  } else {
    return getBytes(keccak256(message))
  }
}

// packMessageData encodes the specified data ready for the Sequence Wallet contracts.
export const packMessageData = (walletAddress: string, chainId: BigNumberish, digest: BytesLike): string => {
  return solidityPacked(['string', 'uint256', 'address', 'bytes32'], ['\x19\x01', chainId, walletAddress, digest])
}

export const subDigestOf = (address: string, chainId: BigNumberish, digest: BytesLike): string => {
  return keccak256(packMessageData(address, chainId, digest))
}
