export const abi = [
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: '_signature',
        type: 'bytes4'
      }
    ],
    name: 'HookAlreadyExists',
    type: 'error'
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: '_signature',
        type: 'bytes4'
      }
    ],
    name: 'HookDoesNotExist',
    type: 'error'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_sender',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_self',
        type: 'address'
      }
    ],
    name: 'OnlySelfAuth',
    type: 'error'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes4',
        name: '_signature',
        type: 'bytes4'
      },
      {
        indexed: false,
        internalType: 'address',
        name: '_implementation',
        type: 'address'
      }
    ],
    name: 'DefinedHook',
    type: 'event'
  },
  {
    stateMutability: 'payable',
    type: 'fallback'
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: '_signature',
        type: 'bytes4'
      },
      {
        internalType: 'address',
        name: '_implementation',
        type: 'address'
      }
    ],
    name: 'addHook',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]'
      },
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]'
      },
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes'
      }
    ],
    name: 'onERC1155BatchReceived',
    outputs: [
      {
        internalType: 'bytes4',
        name: '',
        type: 'bytes4'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      },
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes'
      }
    ],
    name: 'onERC1155Received',
    outputs: [
      {
        internalType: 'bytes4',
        name: '',
        type: 'bytes4'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      },
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes'
      }
    ],
    name: 'onERC721Received',
    outputs: [
      {
        internalType: 'bytes4',
        name: '',
        type: 'bytes4'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: '_signature',
        type: 'bytes4'
      }
    ],
    name: 'readHook',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: '_signature',
        type: 'bytes4'
      }
    ],
    name: 'removeHook',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: '_interfaceID',
        type: 'bytes4'
      }
    ],
    name: 'supportsInterface',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'pure',
    type: 'function'
  },
  {
    stateMutability: 'payable',
    type: 'receive'
  }
] as const
