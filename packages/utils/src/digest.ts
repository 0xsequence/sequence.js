import { ethers} from 'ethers'

export const encodeMessageDigest = (message: string | Uint8Array) => {
  if (typeof(message) === 'string') {
    return ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message)))
  } else {
    return ethers.utils.arrayify(ethers.utils.keccak256(message))
  }
}
