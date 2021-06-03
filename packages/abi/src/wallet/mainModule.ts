export const abi = [
  {
    type: 'function',
    name: 'nonce',
    constant: true,
    inputs: [],
    outputs: [
      {
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'readNonce',
    constant: true,
    inputs: [
      {
        type: 'uint256'
      }
    ],
    outputs: [
      {
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'updateImplementation',
    constant: false,
    inputs: [
      {
        type: 'address'
      }
    ],
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'selfExecute',
    constant: false,
    inputs: [
      {
        components: [
          {
            type: 'bool',
            name: 'delegateCall'
          },
          {
            type: 'bool',
            name: 'revertOnError'
          },
          {
            type: 'uint256',
            name: 'gasLimit'
          },
          {
            type: 'address',
            name: 'target'
          },
          {
            type: 'uint256',
            name: 'value'
          },
          {
            type: 'bytes',
            name: 'data'
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
    type: 'function',
    name: 'execute',
    constant: false,
    inputs: [
      {
        components: [
          {
            type: 'bool',
            name: 'delegateCall'
          },
          {
            type: 'bool',
            name: 'revertOnError'
          },
          {
            type: 'uint256',
            name: 'gasLimit'
          },
          {
            type: 'address',
            name: 'target'
          },
          {
            type: 'uint256',
            name: 'value'
          },
          {
            type: 'bytes',
            name: 'data'
          }
        ],
        type: 'tuple[]'
      },
      {
        type: 'uint256'
      },
      {
        type: 'bytes'
      }
    ],
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'createContract',
    inputs: [
      {
        type: 'bytes'
      }
    ],
    payable: true,
    stateMutability: 'payable'
  }
]
