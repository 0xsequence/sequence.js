import { ethers } from 'ethers'

export const encodeMessageDigest = (message: string | Uint8Array) => {
  if (typeof(message) === 'string') {
    return ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message)))
  } else {
    return ethers.utils.arrayify(ethers.utils.keccak256(message))
  }
}

// packMessageData encodes the specified data ready for the Sequence Wallet contracts.
export const packMessageData = (walletAddress: string, chainId: ethers.BigNumberish, digest: ethers.BytesLike): string => {
  // Optimized alternative for:
  //
  // return ethers.utils.solidityPack(
  //   ['string', 'uint256', 'address', 'bytes32'],
  //   ['\x19\x01', chainId, walletAddress, digest]
  // )
  //
  // Example:
  //
  // 0x1901
  // 00000000000000000000000000000000000000000000000000000000000006e1
  // 03bb3ed142863f4e73ec136bc9cb140d8c66130f
  // e11f6a86a886588c25bca4ca39ead4e6eccbadf61141762b85585ff12346a3b8

  const res = "0x1901" +
    ethers.utils.hexlify(chainId).slice(2).padStart(64, '0') +
    walletAddress.toLowerCase().slice(2) +
    ethers.utils.hexlify(digest).slice(2)

  return res
}

export const subDigestOf = (address: string, chainId: ethers.BigNumberish, digest: ethers.BytesLike): string => {
  return ethers.utils.keccak256(
    packMessageData(address, chainId, digest)
  )
}
