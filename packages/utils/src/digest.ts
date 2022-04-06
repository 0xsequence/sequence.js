import { Bytes, BytesLike, ethers } from 'ethers'

export const messagePrefix = "\x19Ethereum Signed Message:\n"

// messageToSign returns the EIP191 prefixed message to sign.
export function messageToSign(message: Bytes | string): ethers.utils.Bytes {
  if (typeof(message) === 'string') {
    message = ethers.utils.toUtf8Bytes(message)
  }
  return ethers.utils.concat([
    ethers.utils.toUtf8Bytes(messagePrefix),
    ethers.utils.toUtf8Bytes(String(message.length)),
    message
  ])
}

export const encodeMessageDigest = (message: BytesLike) => {
  if (ethers.utils.isHexString(message)) {
    // signing hexdata
    return ethers.utils.arrayify(ethers.utils.keccak256(message))
  } else {
    // sign EIP191 message
    return ethers.utils.arrayify(ethers.utils.keccak256(messageToSign(message)))
  }
}

// packMessageData encodes the specified data ready for the Sequence Wallet contracts.
export const packMessageData = (walletAddress: string, chainId: ethers.BigNumberish, digest: ethers.BytesLike): string => {
  return ethers.utils.solidityPack(
    ['string', 'uint256', 'address', 'bytes32'],
    ['\x19\x01', chainId, walletAddress, digest]
  )
}

export const subDigestOf = (address: string, chainId: ethers.BigNumberish, digest: ethers.BytesLike): string => {
  return ethers.utils.keccak256(
    packMessageData(address, chainId, digest)
  )
}
