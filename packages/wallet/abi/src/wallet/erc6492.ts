export const abi = [
  { inputs: [{ internalType: 'bytes', name: 'error', type: 'bytes' }], name: 'ERC1271Revert', type: 'error' },
  { inputs: [{ internalType: 'bytes', name: 'error', type: 'bytes' }], name: 'ERC6492DeployFailed', type: 'error' },
  {
    inputs: [
      { internalType: 'address', name: '_signer', type: 'address' },
      { internalType: 'bytes32', name: '_hash', type: 'bytes32' },
      { internalType: 'bytes', name: '_signature', type: 'bytes' }
    ],
    name: 'isValidSig',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: '_signer', type: 'address' },
      { internalType: 'bytes32', name: '_hash', type: 'bytes32' },
      { internalType: 'bytes', name: '_signature', type: 'bytes' },
      { internalType: 'bool', name: 'allowSideEffects', type: 'bool' },
      { internalType: 'bool', name: 'deployAlreadyDeployed', type: 'bool' }
    ],
    name: 'isValidSigImpl',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: '_signer', type: 'address' },
      { internalType: 'bytes32', name: '_hash', type: 'bytes32' },
      { internalType: 'bytes', name: '_signature', type: 'bytes' }
    ],
    name: 'isValidSigNoThrow',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: '_signer', type: 'address' },
      { internalType: 'bytes32', name: '_hash', type: 'bytes32' },
      { internalType: 'bytes', name: '_signature', type: 'bytes' }
    ],
    name: 'isValidSigWithSideEffects',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: '_signer', type: 'address' },
      { internalType: 'bytes32', name: '_hash', type: 'bytes32' },
      { internalType: 'bytes', name: '_signature', type: 'bytes' }
    ],
    name: 'isValidSigWithSideEffectsNoThrow',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
]
