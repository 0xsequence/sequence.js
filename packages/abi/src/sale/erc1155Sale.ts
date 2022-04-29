export const ERC1155_SALE_ABI = [
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'checkMerkleProof',
    inputs: [
      { name: 'root', type: 'bytes32', internalType: 'bytes32' },
      { name: 'proof', type: 'bytes32[]', internalType: 'bytes32[]' },
      { name: 'addr', type: 'address', internalType: 'address' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRoleAdmin',
    inputs: [{ name: 'role', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRoleMember',
    inputs: [
      { name: 'role', type: 'bytes32', internalType: 'bytes32' },
      { name: 'index', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRoleMemberCount',
    inputs: [{ name: 'role', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'grantRole',
    inputs: [
      { name: 'role', type: 'bytes32', internalType: 'bytes32' },
      { name: 'account', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32', internalType: 'bytes32' },
      { name: 'account', type: 'address', internalType: 'address' }
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'items', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'itemsContract',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      {
        name: 'paymentToken',
        type: 'address',
        internalType: 'address'
      },
      { name: 'maxTotal', type: 'uint256', internalType: 'uint256' },
      { name: 'proof', type: 'bytes32[]', internalType: 'bytes32[]' }
    ],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'renounceRole',
    inputs: [
      { name: 'role', type: 'bytes32', internalType: 'bytes32' },
      { name: 'account', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'revokeRole',
    inputs: [
      { name: 'role', type: 'bytes32', internalType: 'bytes32' },
      { name: 'account', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'saleDetails',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IERC721SaleFunctions.SaleDetails',
        components: [
          {
            name: 'supplyCap',
            type: 'uint256',
            internalType: 'uint256'
          },
          { name: 'cost', type: 'uint256', internalType: 'uint256' },
          {
            name: 'paymentToken',
            type: 'address',
            internalType: 'address'
          },
          { name: 'startTime', type: 'uint64', internalType: 'uint64' },
          { name: 'endTime', type: 'uint64', internalType: 'uint64' },
          {
            name: 'merkleRoot',
            type: 'bytes32',
            internalType: 'bytes32'
          }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'setSaleDetails',
    inputs: [
      { name: 'supplyCap', type: 'uint256', internalType: 'uint256' },
      { name: 'cost', type: 'uint256', internalType: 'uint256' },
      {
        name: 'paymentToken',
        type: 'address',
        internalType: 'address'
      },
      { name: 'startTime', type: 'uint64', internalType: 'uint64' },
      { name: 'endTime', type: 'uint64', internalType: 'uint64' },
      { name: 'merkleRoot', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [{ name: 'interfaceId', type: 'bytes4', internalType: 'bytes4' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'withdrawERC20',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'withdrawETH',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    name: 'RoleAdminChanged',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'previousAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'newAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'RoleGranted',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'RoleRevoked',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'SaleDetailsUpdated',
    inputs: [
      {
        name: 'supplyCap',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'cost',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'paymentToken',
        type: 'address',
        indexed: false,
        internalType: 'address'
      },
      {
        name: 'startTime',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64'
      },
      {
        name: 'endTime',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64'
      },
      {
        name: 'merkleRoot',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32'
      }
    ],
    anonymous: false
  },
  {
    type: 'error',
    name: 'InsufficientPayment',
    inputs: [
      { name: 'currency', type: 'address', internalType: 'address' },
      { name: 'expected', type: 'uint256', internalType: 'uint256' },
      { name: 'actual', type: 'uint256', internalType: 'uint256' }
    ]
  },
  {
    type: 'error',
    name: 'InsufficientSupply',
    inputs: [
      {
        name: 'currentSupply',
        type: 'uint256',
        internalType: 'uint256'
      },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'maxSupply', type: 'uint256', internalType: 'uint256' }
    ]
  },
  { type: 'error', name: 'InvalidInitialization', inputs: [] },
  { type: 'error', name: 'InvalidSaleDetails', inputs: [] },
  {
    type: 'error',
    name: 'MerkleProofInvalid',
    inputs: [
      { name: 'root', type: 'bytes32', internalType: 'bytes32' },
      { name: 'proof', type: 'bytes32[]', internalType: 'bytes32[]' },
      { name: 'addr', type: 'address', internalType: 'address' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' }
    ]
  },
  { type: 'error', name: 'SaleInactive', inputs: [] },
  { type: 'error', name: 'WithdrawFailed', inputs: [] }
] as const
