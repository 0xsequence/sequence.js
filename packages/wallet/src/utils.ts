import { ethers, BytesLike, BigNumberish } from 'ethers'
import { Deferrable, resolveProperties } from 'ethers/lib/utils'

// packMessageData encodes the specified data ready for the Sequence Wallet contracts.
export const packMessageData = (walletAddress: string, chainId: BigNumberish, digest: BytesLike): string => {
  return ethers.utils.solidityPack(
    ['string', 'uint256', 'address', 'bytes32'],
    ['\x19\x01', chainId, walletAddress, digest]
  )
}

export async function resolveArrayProperties<T>(object: Readonly<Deferrable<T>> | Readonly<Deferrable<T>>[]): Promise<T> {
  if (Array.isArray(object)) {
    // T must include array type
    return Promise.all(object.map((o) => resolveProperties(o))) as any
  }

  return resolveProperties(object)
}
