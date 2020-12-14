import { ethers, BytesLike, BigNumberish } from 'ethers'

// packMessageData encodes the specified data ready for the Sequence Wallet contracts
export const packMessageData = (walletAddress: string, chainId: BigNumberish, digest: BytesLike): string => {
  return ethers.utils.solidityPack(
    ['string', 'uint256', 'address', 'bytes32'],
    ['\x19\x01', chainId, walletAddress, digest]
  )
}
