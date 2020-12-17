export const abi = [
  {
    type: 'function',
    name: 'updateImageHash',
    constant: true,
    inputs: [
      {
        type: 'bytes32'
      }
    ],
    outputs: [],
    payable: false,
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'imageHash',
    constant: true,
    inputs: [],
    outputs: [
      {
        type: 'bytes32'
      }
    ],
    payable: false,
    stateMutability: 'view'
  }
]
