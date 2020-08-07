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
    stateMutability: 'nonpayable'
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
    stateMutability: 'nonpayable'
  },
]
