export const abi = [
  {
    type: 'function',
    name: 'requireNonExpired',
    constant: true,
    inputs: [
      {
        type: 'uint256'
      }
    ],
    outputs: [],
    payable: false,
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'requireMinNonce',
    constant: true,
    inputs: [
      {
        type: 'address'
      },
      {
        type: 'uint256'
      }
    ],
    outputs: [],
    payable: false,
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'requireConfig',
    constant: false,
    inputs: [
      {
        type: 'address'
      },
      {
        type: 'uint256'
      },
      {
        components: [
          {
            type: 'uint256',
            name: 'weight'
          },
          {
            type: 'address',
            name: 'signer'
          }
        ],
        type: 'tuple[]'
      }
    ],
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: '_wallet',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: '_imageHash',
        type: 'bytes32'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: '_threshold',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: '_signers',
        type: 'bytes'
      }
    ],
    name: 'RequiredConfig',
    type: 'event'
  }
]
