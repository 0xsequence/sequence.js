import { ethers } from 'ethers'

export function messageIsExemptFromEIP191Prefix(message: Uint8Array, origin: string | undefined): boolean {
  return EIP_191_PREFIX_EXCEPTIONS.some(e => e.predicate(message, origin))
}

const EIP_191_PREFIX_EXCEPTIONS: Array<{
  name: string
  predicate: (message: Uint8Array, origin?: string) => boolean
}> = [
  // NOTE: Decentraland does not support 191 correctly.
  { name: 'Decentraland Exception', predicate: (_message, origin) => origin === 'https://play.decentraland.org' },

  // NOTE: 0x v3 does not support 191 correctly.
  // See https://gov.0x.org/t/zeip-proposal-fix-v3-eip-191-non-compliance-when-validating-eip-1271-signatures/3396 for more info.
  { name: '0x v3 Exception', predicate: isZeroExV3Order }
]

// try to interpret bytes as abi-encoded 0x v3 OrderWithHash -
// see https://github.com/0xProject/0x-protocol-specification/blob/master/v3/v3-specification.md
export function isZeroExV3Order(bytes: Uint8Array): boolean {
  const abi = new ethers.utils.Interface(ZeroXV3EIP1271OrderWithHashAbi)
  try {
    abi.decodeFunctionData('OrderWithHash', bytes)
    return true
  } catch (err) {
    // failed to decode ABI, so it's not a v3 order.
    return false
  }
}

const ZeroXV3EIP1271OrderWithHashAbi = [
  {
    inputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'makerAddress',
            type: 'address'
          },
          {
            internalType: 'address',
            name: 'takerAddress',
            type: 'address'
          },
          {
            internalType: 'address',
            name: 'feeRecipientAddress',
            type: 'address'
          },
          {
            internalType: 'address',
            name: 'senderAddress',
            type: 'address'
          },
          {
            internalType: 'uint256',
            name: 'makerAssetAmount',
            type: 'uint256'
          },
          {
            internalType: 'uint256',
            name: 'takerAssetAmount',
            type: 'uint256'
          },
          {
            internalType: 'uint256',
            name: 'makerFee',
            type: 'uint256'
          },
          {
            internalType: 'uint256',
            name: 'takerFee',
            type: 'uint256'
          },
          {
            internalType: 'uint256',
            name: 'expirationTimeSeconds',
            type: 'uint256'
          },
          {
            internalType: 'uint256',
            name: 'salt',
            type: 'uint256'
          },
          {
            internalType: 'bytes',
            name: 'makerAssetData',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'takerAssetData',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'makerFeeAssetData',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'takerFeeAssetData',
            type: 'bytes'
          }
        ],
        internalType: 'struct IEIP1271Data.Order',
        name: 'order',
        type: 'tuple'
      },
      {
        internalType: 'bytes32',
        name: 'orderHash',
        type: 'bytes32'
      }
    ],
    name: 'OrderWithHash',
    outputs: [],
    stateMutability: 'pure',
    type: 'function'
  }
]
