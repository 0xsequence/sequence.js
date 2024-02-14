import { ethers } from 'ethers'

const EIP1271_MAGIC_VALUE = '0x1626ba7e'

const EIP1271_ABI = [
  {
    inputs: [
      {
        internalType: 'bytes32',
        type: 'bytes32'
      },
      {
        internalType: 'bytes',
        type: 'bytes'
      }
    ],
    name: 'isValidSignature',
    outputs: [
      {
        internalType: 'bytes4',
        type: 'bytes4'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

export async function isValidEIP1271Signature(
  address: string,
  digest: string,
  signature: ethers.BytesLike,
  provider: ethers.Provider
): Promise<boolean> {
  const contract = new ethers.Contract(address, EIP1271_ABI, provider)
  const result = await contract.isValidSignature(digest, signature)
  return result === EIP1271_MAGIC_VALUE
}
