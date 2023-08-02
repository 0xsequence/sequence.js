export const mainModuleUpgradable = {
  _format: 'hh-sol-artifact-1',
  contractName: 'MainModuleUpgradable',
  sourceName: 'contracts/modules/MainModuleUpgradable.sol',
  abi: [
    {
      inputs: [
        {
          internalType: 'uint256',
          name: '_space',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: '_provided',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: '_current',
          type: 'uint256'
        }
      ],
      name: 'BadNonce',
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
      inputs: [],
      name: 'ImageHashIsZero',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_implementation',
          type: 'address'
        }
      ],
      name: 'InvalidImplementation',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_hash',
          type: 'bytes32'
        },
        {
          internalType: 'address',
          name: '_addr',
          type: 'address'
        },
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        }
      ],
      name: 'InvalidNestedSignature',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        },
        {
          internalType: 'bytes32',
          name: '_s',
          type: 'bytes32'
        }
      ],
      name: 'InvalidSValue',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_hash',
          type: 'bytes32'
        },
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        }
      ],
      name: 'InvalidSignature',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: '_flag',
          type: 'uint256'
        }
      ],
      name: 'InvalidSignatureFlag',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        }
      ],
      name: 'InvalidSignatureLength',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes1',
          name: '_type',
          type: 'bytes1'
        }
      ],
      name: 'InvalidSignatureType',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        },
        {
          internalType: 'uint256',
          name: '_v',
          type: 'uint256'
        }
      ],
      name: 'InvalidVValue',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        },
        {
          internalType: 'uint256',
          name: 'threshold',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: '_weight',
          type: 'uint256'
        }
      ],
      name: 'LowWeightChainedSignature',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: '_index',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: '_requested',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: '_available',
          type: 'uint256'
        }
      ],
      name: 'NotEnoughGas',
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
      inputs: [
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        }
      ],
      name: 'SignerIsAddress0',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        },
        {
          internalType: 'uint256',
          name: '_type',
          type: 'uint256'
        },
        {
          internalType: 'bool',
          name: '_recoverMode',
          type: 'bool'
        }
      ],
      name: 'UnsupportedSignatureType',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: '_current',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: '_prev',
          type: 'uint256'
        }
      ],
      name: 'WrongChainedCheckpointOrder',
      type: 'error'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'address',
          name: '_contract',
          type: 'address'
        }
      ],
      name: 'CreatedContract',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'bytes32',
          name: '_hash',
          type: 'bytes32'
        }
      ],
      name: 'IPFSRootUpdated',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'bytes32',
          name: 'newImageHash',
          type: 'bytes32'
        }
      ],
      name: 'ImageHashUpdated',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'address',
          name: 'newImplementation',
          type: 'address'
        }
      ],
      name: 'ImplementationUpdated',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'uint256',
          name: '_space',
          type: 'uint256'
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: '_newNonce',
          type: 'uint256'
        }
      ],
      name: 'NonceChange',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'bytes32',
          name: '_imageHash',
          type: 'bytes32'
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: '_expiration',
          type: 'uint256'
        }
      ],
      name: 'SetExtraImageHash',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'bytes32',
          name: '_digest',
          type: 'bytes32'
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: '_expiration',
          type: 'uint256'
        }
      ],
      name: 'SetStaticDigest',
      type: 'event'
    },
    {
      anonymous: true,
      inputs: [
        {
          indexed: false,
          internalType: 'bytes32',
          name: '_tx',
          type: 'bytes32'
        }
      ],
      name: 'TxExecuted',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'bytes32',
          name: '_tx',
          type: 'bytes32'
        },
        {
          indexed: false,
          internalType: 'bytes',
          name: '_reason',
          type: 'bytes'
        }
      ],
      name: 'TxFailed',
      type: 'event'
    },
    {
      stateMutability: 'payable',
      type: 'fallback'
    },
    {
      inputs: [],
      name: 'SET_IMAGE_HASH_TYPE_HASH',
      outputs: [
        {
          internalType: 'bytes32',
          name: '',
          type: 'bytes32'
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
          internalType: 'bytes32[]',
          name: '_digests',
          type: 'bytes32[]'
        }
      ],
      name: 'addStaticDigests',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32[]',
          name: '_imageHashes',
          type: 'bytes32[]'
        }
      ],
      name: 'clearExtraImageHashes',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_code',
          type: 'bytes'
        }
      ],
      name: 'createContract',
      outputs: [
        {
          internalType: 'address',
          name: 'addr',
          type: 'address'
        }
      ],
      stateMutability: 'payable',
      type: 'function'
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: 'bool',
              name: 'delegateCall',
              type: 'bool'
            },
            {
              internalType: 'bool',
              name: 'revertOnError',
              type: 'bool'
            },
            {
              internalType: 'uint256',
              name: 'gasLimit',
              type: 'uint256'
            },
            {
              internalType: 'address',
              name: 'target',
              type: 'address'
            },
            {
              internalType: 'uint256',
              name: 'value',
              type: 'uint256'
            },
            {
              internalType: 'bytes',
              name: 'data',
              type: 'bytes'
            }
          ],
          internalType: 'struct IModuleCalls.Transaction[]',
          name: '_txs',
          type: 'tuple[]'
        },
        {
          internalType: 'uint256',
          name: '_nonce',
          type: 'uint256'
        },
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        }
      ],
      name: 'execute',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_imageHash',
          type: 'bytes32'
        }
      ],
      name: 'extraImageHash',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'imageHash',
      outputs: [
        {
          internalType: 'bytes32',
          name: '',
          type: 'bytes32'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'ipfsRoot',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'ipfsRootBytes32',
      outputs: [
        {
          internalType: 'bytes32',
          name: '',
          type: 'bytes32'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_hash',
          type: 'bytes32'
        },
        {
          internalType: 'bytes',
          name: '_signatures',
          type: 'bytes'
        }
      ],
      name: 'isValidSignature',
      outputs: [
        {
          internalType: 'bytes4',
          name: '',
          type: 'bytes4'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes',
          name: '_data',
          type: 'bytes'
        },
        {
          internalType: 'bytes',
          name: '_signatures',
          type: 'bytes'
        }
      ],
      name: 'isValidSignature',
      outputs: [
        {
          internalType: 'bytes4',
          name: '',
          type: 'bytes4'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'nonce',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
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
          internalType: 'uint256',
          name: '_space',
          type: 'uint256'
        }
      ],
      name: 'readNonce',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
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
          components: [
            {
              internalType: 'bool',
              name: 'delegateCall',
              type: 'bool'
            },
            {
              internalType: 'bool',
              name: 'revertOnError',
              type: 'bool'
            },
            {
              internalType: 'uint256',
              name: 'gasLimit',
              type: 'uint256'
            },
            {
              internalType: 'address',
              name: 'target',
              type: 'address'
            },
            {
              internalType: 'uint256',
              name: 'value',
              type: 'uint256'
            },
            {
              internalType: 'bytes',
              name: 'data',
              type: 'bytes'
            }
          ],
          internalType: 'struct IModuleCalls.Transaction[]',
          name: '_txs',
          type: 'tuple[]'
        }
      ],
      name: 'selfExecute',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_imageHash',
          type: 'bytes32'
        },
        {
          internalType: 'uint256',
          name: '_expiration',
          type: 'uint256'
        }
      ],
      name: 'setExtraImageHash',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_digest',
          type: 'bytes32'
        },
        {
          internalType: 'uint256',
          name: '_expiration',
          type: 'uint256'
        }
      ],
      name: 'setStaticDigest',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_digest',
          type: 'bytes32'
        },
        {
          internalType: 'bytes',
          name: '_signature',
          type: 'bytes'
        }
      ],
      name: 'signatureRecovery',
      outputs: [
        {
          internalType: 'uint256',
          name: 'threshold',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: 'weight',
          type: 'uint256'
        },
        {
          internalType: 'bytes32',
          name: 'imageHash',
          type: 'bytes32'
        },
        {
          internalType: 'bytes32',
          name: 'subDigest',
          type: 'bytes32'
        },
        {
          internalType: 'uint256',
          name: 'checkpoint',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_digest',
          type: 'bytes32'
        }
      ],
      name: 'staticDigest',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
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
      inputs: [
        {
          internalType: 'bytes32',
          name: '_hash',
          type: 'bytes32'
        }
      ],
      name: 'updateIPFSRoot',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_imageHash',
          type: 'bytes32'
        }
      ],
      name: 'updateImageHash',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'bytes32',
          name: '_imageHash',
          type: 'bytes32'
        },
        {
          internalType: 'bytes32',
          name: '_ipfsRoot',
          type: 'bytes32'
        }
      ],
      name: 'updateImageHashAndIPFS',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_implementation',
          type: 'address'
        }
      ],
      name: 'updateImplementation',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      stateMutability: 'payable',
      type: 'receive'
    }
  ],
  bytecode:
    '0x608060405234801561001057600080fd5b506138f9806100206000396000f3fe6080604052600436106101c65760003560e01c806379e472c9116100f7578063a4ab5f9f11610095578063c71f1f9611610064578063c71f1f96146106a2578063d0748f71146106b7578063d59f7885146106d7578063f23a6e61146106f7576101cd565b8063a4ab5f9f14610605578063affed0e014610625578063b93ea7ad1461063a578063bc197c811461065a576101cd565b80638c3f5563116100d15780638c3f5563146105905780638efa6441146105b057806390042baf146105d2578063a38cef19146105e5576101cd565b806379e472c9146105085780637a9a162814610528578063853c506814610548576101cd565b806329561426116101645780634fcf3eca1161013e5780634fcf3eca1461047f57806351605d801461049f57806357c56d6b146104b457806361c2926c146104e8576101cd565b8063295614261461041157806341ea0302146104315780634598154f1461045f576101cd565b8063150b7a02116101a0578063150b7a02146103165780631626ba7e1461038c5780631a9b2337146103ac57806320c13b0b146103f1576101cd565b806301ffc9a7146102a1578063025b22bc146102d6578063038dbaac146102f6576101cd565b366101cd57005b60006101fc6000357fffffffff000000000000000000000000000000000000000000000000000000001661073d565b905073ffffffffffffffffffffffffffffffffffffffff81161561029f576000808273ffffffffffffffffffffffffffffffffffffffff16600036604051610245929190612d57565b600060405180830381855af49150503d8060008114610280576040519150601f19603f3d011682016040523d82523d6000602084013e610285565b606091505b50915091508161029757805160208201fd5b805160208201f35b005b3480156102ad57600080fd5b506102c16102bc366004612d95565b610791565b60405190151581526020015b60405180910390f35b3480156102e257600080fd5b5061029f6102f1366004612ddb565b61079c565b34801561030257600080fd5b5061029f610311366004612e42565b6107ee565b34801561032257600080fd5b5061035b610331366004612ec6565b7f150b7a020000000000000000000000000000000000000000000000000000000095945050505050565b6040517fffffffff0000000000000000000000000000000000000000000000000000000090911681526020016102cd565b34801561039857600080fd5b5061035b6103a7366004612f35565b6108f9565b3480156103b857600080fd5b506103cc6103c7366004612d95565b610946565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020016102cd565b3480156103fd57600080fd5b5061035b61040c366004612f81565b610951565b34801561041d57600080fd5b5061029f61042c366004612fed565b6109b6565b34801561043d57600080fd5b5061045161044c366004612fed565b610a00565b6040519081526020016102cd565b34801561046b57600080fd5b5061029f61047a366004613006565b610a0b565b34801561048b57600080fd5b5061029f61049a366004612d95565b610ad1565b3480156104ab57600080fd5b50610451610c00565b3480156104c057600080fd5b506104517f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d181565b3480156104f457600080fd5b5061029f610503366004612e42565b610c2f565b34801561051457600080fd5b5061029f610523366004613006565b610cb5565b34801561053457600080fd5b5061029f610543366004613028565b610d73565b34801561055457600080fd5b50610568610563366004612f35565b610e09565b604080519586526020860194909452928401919091526060830152608082015260a0016102cd565b34801561059c57600080fd5b506104516105ab366004612fed565b610fd1565b3480156105bc57600080fd5b506105c5610ffd565b6040516102cd91906130ff565b6103cc6105e0366004613141565b61107e565b3480156105f157600080fd5b5061029f610600366004612fed565b61111a565b34801561061157600080fd5b50610451610620366004612fed565b611164565b34801561063157600080fd5b5061045161116f565b34801561064657600080fd5b5061029f610655366004613210565b61117b565b34801561066657600080fd5b5061035b610675366004613245565b7fbc197c810000000000000000000000000000000000000000000000000000000098975050505050505050565b3480156106ae57600080fd5b506104516112c4565b3480156106c357600080fd5b5061029f6106d2366004613006565b6112ee565b3480156106e357600080fd5b5061029f6106f2366004612e42565b611341565b34801561070357600080fd5b5061035b610712366004613300565b7ff23a6e61000000000000000000000000000000000000000000000000000000009695505050505050565b600061078b7fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1207fffffffff000000000000000000000000000000000000000000000000000000008416611484565b92915050565b600061078b826114e2565b3330146107e2576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044015b60405180910390fd5b6107eb8161153e565b50565b33301461082f576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b8060005b818110156108f357600084848381811061084f5761084f613378565b9050602002013590506108af816000604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c60006040516108e291815260200190565b60405180910390a250600101610833565b50505050565b6000806109078585856115f9565b509050801561093957507f1626ba7e00000000000000000000000000000000000000000000000000000000905061093f565b50600090505b9392505050565b600061078b8261073d565b6000806109768686604051610967929190612d57565b604051809103902085856115f9565b50905080156109a857507f20c13b0b0000000000000000000000000000000000000000000000000000000090506109ae565b50600090505b949350505050565b3330146109f7576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6107eb81611614565b600061078b826116a4565b333014610a4c576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c906080015b60405180910390a25050565b333014610b12576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6000610b1d8261073d565b73ffffffffffffffffffffffffffffffffffffffff1603610b8e576040517f1c3812cc0000000000000000000000000000000000000000000000000000000081527fffffffff00000000000000000000000000000000000000000000000000000000821660048201526024016107d9565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff00000000000000000000000000000000000000000000000000000000841682840152825180830384018152606090920190925280519101206000905550565b6000610c2a7fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf85490565b905090565b333014610c70576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6000610ca38383604051602001610c8892919061354f565b604051602081830303815290604052805190602001206116d0565b9050610cb0818484611755565b505050565b333014610cf6576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e290608001610ac5565b610d7c836118b3565b600080610db4858888604051602001610d9793929190613597565b6040516020818303038152906040528051906020012085856115f9565b9150915081610df5578084846040517f8f4a234f0000000000000000000000000000000000000000000000000000000081526004016107d9939291906135ba565b610e00818888611755565b50505050505050565b60008060008060008087876000818110610e2557610e25613378565b909101357fff00000000000000000000000000000000000000000000000000000000000000169150819050610e7b57610e5d896116d0565b9250610e6a8389896119b0565b92985090965094509150610fc69050565b7fff0000000000000000000000000000000000000000000000000000000000000081811601610eba57610ead896116d0565b9250610e6a838989611a01565b7ffe000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610f0c57610ead89611a2d565b7ffd000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610f7057610f60898989611a9a565b9550955095509550955050610fc6565b6040517f6085cd820000000000000000000000000000000000000000000000000000000081527fff00000000000000000000000000000000000000000000000000000000000000821660048201526024016107d9565b939792965093509350565b600061078b7f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e83611484565b606061105a61105561100d6112c4565b6040517f017012200000000000000000000000000000000000000000000000000000000060208201526024810191909152604401604051602081830303815290604052611c17565b611e30565b60405160200161106a91906135d4565b604051602081830303815290604052905090565b60003330146110c1576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b81516020830134f060405173ffffffffffffffffffffffffffffffffffffffff821681529091507fa506ad4e7f05eceba62a023c3219e5bd98a615f4fa87e2afb08a2da5cf62bf0c9060200160405180910390a1919050565b33301461115b576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6107eb81611e59565b600061078b82611eb2565b6000610c2a6000610fd1565b3330146111bc576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b60006111c78361073d565b73ffffffffffffffffffffffffffffffffffffffff1614611238576040517f5b4d6d6a0000000000000000000000000000000000000000000000000000000081527fffffffff00000000000000000000000000000000000000000000000000000000831660048201526024016107d9565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff000000000000000000000000000000000000000000000000000000008516828401528251808303840181526060909201909252805191012073ffffffffffffffffffffffffffffffffffffffff821690555050565b5050565b6000610c2a7f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d0335490565b33301461132f576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b61133882611614565b6112c081611e59565b333014611382576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b8060005b818110156108f35760008484838181106113a2576113a2613378565b905060200201359050611421817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e27fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60405161147391815260200190565b60405180910390a250600101611386565b60008083836040516020016114a3929190918252602082015260400190565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0818403018152919052805160209091012054949350505050565b60007f6ffbd451000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083160161153557506001919050565b61078b82611ede565b73ffffffffffffffffffffffffffffffffffffffff81163b6115a4576040517f0c76093700000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff821660048201526024016107d9565b6115ac813055565b60405173ffffffffffffffffffffffffffffffffffffffff821681527f310ba5f1d2ed074b51e2eccd052a47ae9ab7c6b800d1fca3db3999d6a592ca03906020015b60405180910390a150565b60008061160785858561201f565b915091505b935093915050565b8061164b576040517f4294d12700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6116747fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf8829055565b6040518181527f307ed6bd941ee9fc80f369c94af5fa11e25bab5102a6140191756c5474a30bfa906020016115ee565b600061078b7f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd945483611484565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201524660228201527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b166042820152605681018290526000906076015b604051602081830303815290604052805190602001209050919050565b8060005b818110156118ac573684848381811061177457611774613378565b90506020028101906117869190613619565b90506040810135805a10156117db5782815a6040517f2bb3e3ba0000000000000000000000000000000000000000000000000000000081526004810193909352602483019190915260448201526064016107d9565b60006117ea6020840184613657565b15611829576118226118026080850160608601612ddb565b831561180e5783611810565b5a5b61181d60a0870187613672565b612053565b9050611864565b61186161183c6080850160608601612ddb565b6080850135841561184d578461184f565b5a5b61185c60a0880188613672565b61206e565b90505b80156118805760405188815260200160405180910390a06118a1565b6118a16118936040850160208601613657565b8961189c61208b565b6120aa565b505050600101611759565b5050505050565b606081901c6bffffffffffffffffffffffff821660006118d283610fd1565b905081811461191e576040517f9b6514f40000000000000000000000000000000000000000000000000000000081526004810184905260248101839052604481018290526064016107d9565b604080517f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e60208083019190915281830186905282518083038401815260609092019092528051910120600183019081905560408051858152602081018390527f1f180c27086c7a39ea2a7b25239d1ab92348f07ca7bb59d1438fcf527568f881910160405180910390a15050505050565b60008080806119cb876119c6876006818b6136d7565b6120f6565b6000908152873560f01c6020818152604080842084526002909a013560e01c908190529890912090999198509695509350505050565b6000808080611a1c87611a17876001818b6136d7565b6119b0565b935093509350935093509350935093565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201526000602282018190527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b1660428301526056820183905290607601611738565b6000808080806004600188013560e81c82611ab58383613730565b9050611ac78b61056383868d8f6136d7565b939b5091995097509550935087871015611b1f57611ae781848b8d6136d7565b89896040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016107d99493929190613743565b8092505b88831015611c095760038301928a013560e81c9150611b428383613730565b90506000611b64611b528861258c565b8c8c87908692610563939291906136d7565b939c50919a5098509091505088881015611bbc57611b8482858c8e6136d7565b8a8a6040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016107d99493929190613743565b848110611bff576040517f37daf62b00000000000000000000000000000000000000000000000000000000815260048101829052602481018690526044016107d9565b9350915081611b23565b505050939792965093509350565b8051606090600381901b60006005600483010467ffffffffffffffff811115611c4257611c42613112565b6040519080825280601f01601f191660200182016040528015611c6c576020820181803683370190505b5090506000806000805b86811015611d8057888181518110611c9057611c90613378565b01602001516008948501949390931b60f89390931c92909217915b60058410611d78576040805180820190915260208082527f6162636465666768696a6b6c6d6e6f707172737475767778797a323334353637818301527ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffb90950194601f85871c16908110611d2157611d21613378565b602001015160f81c60f81b858381518110611d3e57611d3e613378565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350600190910190611cab565b600101611c76565b508215611e24576040518060400160405280602081526020017f6162636465666768696a6b6c6d6e6f707172737475767778797a3233343536378152508360050383901b601f1681518110611dd757611dd7613378565b602001015160f81c60f81b848281518110611df457611df4613378565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053505b50919695505050505050565b606081604051602001611e43919061376a565b6040516020818303038152906040529050919050565b611e827f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d033829055565b6040518181527f20d3ef1b5738a9f6d7beae515432206e7a8e2740ca6dcf46a952190ad01bcb51906020016115ee565b600061078b7f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de83611484565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fec6aba50000000000000000000000000000000000000000000000000000000001480611f7157507fffffffff0000000000000000000000000000000000000000000000000000000082167f4e2312e000000000000000000000000000000000000000000000000000000000145b80611fbd57507fffffffff0000000000000000000000000000000000000000000000000000000082167f150b7a0200000000000000000000000000000000000000000000000000000000145b8061200957507fffffffff0000000000000000000000000000000000000000000000000000000082167fc0ee0b8a00000000000000000000000000000000000000000000000000000000145b1561201657506001919050565b61078b826125c0565b6000804261202c866116a4565b1191508115612048578161203f8661261c565b9150915061160c565b611607858585612657565b60006040518284823760008084838989f49695505050505050565b6000604051828482376000808483898b8af1979650505050505050565b60603d604051915060208201818101604052818352816000823e505090565b82156120b857805160208201fd5b7f3dbd1590ea96dd3253a91f24e64e3a502e1225d602a5731357bc12643070ccd782826040516120e99291906137af565b60405180910390a1505050565b60008060005b8381101561258357600181019085013560f81c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff810161219d57601582019186013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff81169074ff0000000000000000000000000000000000000000168117856121835780612192565b60008681526020829052604090205b9550505050506120fc565b806122335760018201918681013560f81c9060430160006121c98a6121c484888c8e6136d7565b612695565b60ff841697909701969194508491905060a083901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff821617866122185780612227565b60008781526020829052604090205b965050505050506120fc565b6002810361235b576000808784013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff16601586019550909250905060008885013560e81c600386018162ffffff1691508096508192505050600081860190506122ac8b848c8c8a9086926122a7939291906136d7565b612958565b6122f4578a836122be83898d8f6136d7565b6040517f9a9462320000000000000000000000000000000000000000000000000000000081526004016107d994939291906137c8565b60ff8416979097019694508460a084901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff8416178761233f578061234e565b60008881526020829052604090205b97505050505050506120fc565b6003810361238e576020820191860135836123765780612385565b60008481526020829052604090205b935050506120fc565b600481036123da576003808301928781013560e81c91908201016000806123bb8b6119c685898d8f6136d7565b600098895260205260409097209690970196509093506120fc92505050565b600681036124e25760008287013560f81c60018401935060ff16905060008784013560f01c60028501945061ffff16905060008885013560e81c600386018162ffffff1691508096508192505050600081860190506000806124488d8d8d8b9087926119c6939291906136d7565b9398508893909250905084821061245e57988501985b604080517f53657175656e6365206e657374656420636f6e6669673a0a0000000000000000602080830191909152603882018490526058820188905260788083018a90528351808403909101815260989092019092528051910120896124c457806124d3565b60008a81526020829052604090205b995050505050505050506120fc565b6005810361254e57602082019186013587810361251d577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff94505b600061252882612b05565b9050846125355780612544565b60008581526020829052604090205b94505050506120fc565b6040517fb2505f7c000000000000000000000000000000000000000000000000000000008152600481018290526024016107d9565b50935093915050565b7f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d1600090815260208290526040812061078b565b60007ffda4dd44000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083160161261357506001919050565b61078b82612b40565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd94546020820152908101829052600090606001611738565b600080600080600061266a888888610e09565b50965091945092509050828210801590612688575061268881612b9c565b9450505050935093915050565b6000604282146126d55782826040517f2ee17a3d0000000000000000000000000000000000000000000000000000000081526004016107d9929190613808565b60006126ee6126e560018561381c565b85013560f81c90565b60ff169050604084013560f81c843560208601357f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0811115612762578686826040517fad4aac760000000000000000000000000000000000000000000000000000000081526004016107d99392919061382f565b8260ff16601b1415801561277a57508260ff16601c14155b156127b7578686846040517fe578897e0000000000000000000000000000000000000000000000000000000081526004016107d993929190613853565b60018403612824576040805160008152602081018083528a905260ff851691810191909152606081018390526080810182905260019060a0015b6020604051602081039080840390855afa158015612813573d6000803e3d6000fd5b5050506020604051035194506128fc565b600284036128c1576040517f19457468657265756d205369676e6564204d6573736167653a0a3332000000006020820152603c8101899052600190605c01604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181528282528051602091820120600084529083018083525260ff861690820152606081018490526080810183905260a0016127f1565b86868560016040517f9dfba8520000000000000000000000000000000000000000000000000000000081526004016107d9949392919061387a565b73ffffffffffffffffffffffffffffffffffffffff851661294d5786866040517f6c1719d20000000000000000000000000000000000000000000000000000000081526004016107d9929190613808565b505050509392505050565b600080838361296860018261381c565b81811061297757612977613378565b919091013560f81c91505060018114806129915750600281145b156129d6578473ffffffffffffffffffffffffffffffffffffffff166129b8878686612695565b73ffffffffffffffffffffffffffffffffffffffff16149150612afc565b60038103612ac15773ffffffffffffffffffffffffffffffffffffffff8516631626ba7e8786600087612a0a60018261381c565b92612a17939291906136d7565b6040518463ffffffff1660e01b8152600401612a35939291906135ba565b602060405180830381865afa158015612a52573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612a7691906138a6565b7fffffffff00000000000000000000000000000000000000000000000000000000167f1626ba7e00000000000000000000000000000000000000000000000000000000149150612afc565b83838260006040517f9dfba8520000000000000000000000000000000000000000000000000000000081526004016107d9949392919061387a565b50949350505050565b6040517f53657175656e636520737461746963206469676573743a0a0000000000000000602082015260388101829052600090605801611738565b60007fe4a77bbc000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831601612b9357506001919050565b61078b82612ba7565b600061078b82612c03565b60007fae9fa280000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831601612bfa57506001919050565b61078b82612c3a565b6000612c0e82612d24565b15612c1b57506001919050565b6000612c2683611eb2565b9050801580159061093f5750421092915050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fac6a444e000000000000000000000000000000000000000000000000000000001480612ccd57507fffffffff0000000000000000000000000000000000000000000000000000000082167f36e7817500000000000000000000000000000000000000000000000000000000145b15612cda57506001919050565b7f01ffc9a7000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083161461078b565b6000811580159061078b5750507fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf8541490565b8183823760009101908152919050565b7fffffffff00000000000000000000000000000000000000000000000000000000811681146107eb57600080fd5b600060208284031215612da757600080fd5b813561093f81612d67565b803573ffffffffffffffffffffffffffffffffffffffff81168114612dd657600080fd5b919050565b600060208284031215612ded57600080fd5b61093f82612db2565b60008083601f840112612e0857600080fd5b50813567ffffffffffffffff811115612e2057600080fd5b6020830191508360208260051b8501011115612e3b57600080fd5b9250929050565b60008060208385031215612e5557600080fd5b823567ffffffffffffffff811115612e6c57600080fd5b612e7885828601612df6565b90969095509350505050565b60008083601f840112612e9657600080fd5b50813567ffffffffffffffff811115612eae57600080fd5b602083019150836020828501011115612e3b57600080fd5b600080600080600060808688031215612ede57600080fd5b612ee786612db2565b9450612ef560208701612db2565b935060408601359250606086013567ffffffffffffffff811115612f1857600080fd5b612f2488828901612e84565b969995985093965092949392505050565b600080600060408486031215612f4a57600080fd5b83359250602084013567ffffffffffffffff811115612f6857600080fd5b612f7486828701612e84565b9497909650939450505050565b60008060008060408587031215612f9757600080fd5b843567ffffffffffffffff80821115612faf57600080fd5b612fbb88838901612e84565b90965094506020870135915080821115612fd457600080fd5b50612fe187828801612e84565b95989497509550505050565b600060208284031215612fff57600080fd5b5035919050565b6000806040838503121561301957600080fd5b50508035926020909101359150565b60008060008060006060868803121561304057600080fd5b853567ffffffffffffffff8082111561305857600080fd5b61306489838a01612df6565b909750955060208801359450604088013591508082111561308457600080fd5b50612f2488828901612e84565b60005b838110156130ac578181015183820152602001613094565b50506000910152565b600081518084526130cd816020860160208601613091565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b60208152600061093f60208301846130b5565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b60006020828403121561315357600080fd5b813567ffffffffffffffff8082111561316b57600080fd5b818401915084601f83011261317f57600080fd5b81358181111561319157613191613112565b604051601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0908116603f011681019083821181831017156131d7576131d7613112565b816040528281528760208487010111156131f057600080fd5b826020860160208301376000928101602001929092525095945050505050565b6000806040838503121561322357600080fd5b823561322e81612d67565b915061323c60208401612db2565b90509250929050565b60008060008060008060008060a0898b03121561326157600080fd5b61326a89612db2565b975061327860208a01612db2565b9650604089013567ffffffffffffffff8082111561329557600080fd5b6132a18c838d01612df6565b909850965060608b01359150808211156132ba57600080fd5b6132c68c838d01612df6565b909650945060808b01359150808211156132df57600080fd5b506132ec8b828c01612e84565b999c989b5096995094979396929594505050565b60008060008060008060a0878903121561331957600080fd5b61332287612db2565b955061333060208801612db2565b94506040870135935060608701359250608087013567ffffffffffffffff81111561335a57600080fd5b61336689828a01612e84565b979a9699509497509295939492505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b80358015158114612dd657600080fd5b8183528181602085013750600060208284010152600060207fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f840116840101905092915050565b81835260006020808501808196508560051b810191508460005b8781101561354257828403895281357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4188360301811261345957600080fd5b870160c0613466826133a7565b151586526134758783016133a7565b15158688015260408281013590870152606073ffffffffffffffffffffffffffffffffffffffff6134a7828501612db2565b16908701526080828101359087015260a080830135368490037fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe10181126134ed57600080fd5b90920187810192903567ffffffffffffffff81111561350b57600080fd5b80360384131561351a57600080fd5b828289015261352c83890182866133b7565b9c89019c9750505092860192505060010161341a565b5091979650505050505050565b60408152600560408201527f73656c663a00000000000000000000000000000000000000000000000000000060608201526080602082015260006109ae608083018486613400565b8381526040602082015260006135b1604083018486613400565b95945050505050565b8381526040602082015260006135b16040830184866133b7565b7f697066733a2f2f0000000000000000000000000000000000000000000000000081526000825161360c816007850160208701613091565b9190910160070192915050565b600082357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4183360301811261364d57600080fd5b9190910192915050565b60006020828403121561366957600080fd5b61093f826133a7565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe18436030181126136a757600080fd5b83018035915067ffffffffffffffff8211156136c257600080fd5b602001915036819003821315612e3b57600080fd5b600080858511156136e757600080fd5b838611156136f457600080fd5b5050820193919092039150565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b8082018082111561078b5761078b613701565b6060815260006137576060830186886133b7565b6020830194909452506040015292915050565b7f62000000000000000000000000000000000000000000000000000000000000008152600082516137a2816001850160208701613091565b9190910160010192915050565b8281526040602082015260006109ae60408301846130b5565b84815273ffffffffffffffffffffffffffffffffffffffff841660208201526060604082015260006137fe6060830184866133b7565b9695505050505050565b6020815260006109ae6020830184866133b7565b8181038181111561078b5761078b613701565b6040815260006138436040830185876133b7565b9050826020830152949350505050565b6040815260006138676040830185876133b7565b905060ff83166020830152949350505050565b60608152600061388e6060830186886133b7565b60208301949094525090151560409091015292915050565b6000602082840312156138b857600080fd5b815161093f81612d6756fea264697066735822122030f6a03eecf061513999472455e58728f2693e3a3541e4333a309b089861d90064736f6c63430008110033',
  deployedBytecode:
    '0x6080604052600436106101c65760003560e01c806379e472c9116100f7578063a4ab5f9f11610095578063c71f1f9611610064578063c71f1f96146106a2578063d0748f71146106b7578063d59f7885146106d7578063f23a6e61146106f7576101cd565b8063a4ab5f9f14610605578063affed0e014610625578063b93ea7ad1461063a578063bc197c811461065a576101cd565b80638c3f5563116100d15780638c3f5563146105905780638efa6441146105b057806390042baf146105d2578063a38cef19146105e5576101cd565b806379e472c9146105085780637a9a162814610528578063853c506814610548576101cd565b806329561426116101645780634fcf3eca1161013e5780634fcf3eca1461047f57806351605d801461049f57806357c56d6b146104b457806361c2926c146104e8576101cd565b8063295614261461041157806341ea0302146104315780634598154f1461045f576101cd565b8063150b7a02116101a0578063150b7a02146103165780631626ba7e1461038c5780631a9b2337146103ac57806320c13b0b146103f1576101cd565b806301ffc9a7146102a1578063025b22bc146102d6578063038dbaac146102f6576101cd565b366101cd57005b60006101fc6000357fffffffff000000000000000000000000000000000000000000000000000000001661073d565b905073ffffffffffffffffffffffffffffffffffffffff81161561029f576000808273ffffffffffffffffffffffffffffffffffffffff16600036604051610245929190612d57565b600060405180830381855af49150503d8060008114610280576040519150601f19603f3d011682016040523d82523d6000602084013e610285565b606091505b50915091508161029757805160208201fd5b805160208201f35b005b3480156102ad57600080fd5b506102c16102bc366004612d95565b610791565b60405190151581526020015b60405180910390f35b3480156102e257600080fd5b5061029f6102f1366004612ddb565b61079c565b34801561030257600080fd5b5061029f610311366004612e42565b6107ee565b34801561032257600080fd5b5061035b610331366004612ec6565b7f150b7a020000000000000000000000000000000000000000000000000000000095945050505050565b6040517fffffffff0000000000000000000000000000000000000000000000000000000090911681526020016102cd565b34801561039857600080fd5b5061035b6103a7366004612f35565b6108f9565b3480156103b857600080fd5b506103cc6103c7366004612d95565b610946565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020016102cd565b3480156103fd57600080fd5b5061035b61040c366004612f81565b610951565b34801561041d57600080fd5b5061029f61042c366004612fed565b6109b6565b34801561043d57600080fd5b5061045161044c366004612fed565b610a00565b6040519081526020016102cd565b34801561046b57600080fd5b5061029f61047a366004613006565b610a0b565b34801561048b57600080fd5b5061029f61049a366004612d95565b610ad1565b3480156104ab57600080fd5b50610451610c00565b3480156104c057600080fd5b506104517f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d181565b3480156104f457600080fd5b5061029f610503366004612e42565b610c2f565b34801561051457600080fd5b5061029f610523366004613006565b610cb5565b34801561053457600080fd5b5061029f610543366004613028565b610d73565b34801561055457600080fd5b50610568610563366004612f35565b610e09565b604080519586526020860194909452928401919091526060830152608082015260a0016102cd565b34801561059c57600080fd5b506104516105ab366004612fed565b610fd1565b3480156105bc57600080fd5b506105c5610ffd565b6040516102cd91906130ff565b6103cc6105e0366004613141565b61107e565b3480156105f157600080fd5b5061029f610600366004612fed565b61111a565b34801561061157600080fd5b50610451610620366004612fed565b611164565b34801561063157600080fd5b5061045161116f565b34801561064657600080fd5b5061029f610655366004613210565b61117b565b34801561066657600080fd5b5061035b610675366004613245565b7fbc197c810000000000000000000000000000000000000000000000000000000098975050505050505050565b3480156106ae57600080fd5b506104516112c4565b3480156106c357600080fd5b5061029f6106d2366004613006565b6112ee565b3480156106e357600080fd5b5061029f6106f2366004612e42565b611341565b34801561070357600080fd5b5061035b610712366004613300565b7ff23a6e61000000000000000000000000000000000000000000000000000000009695505050505050565b600061078b7fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1207fffffffff000000000000000000000000000000000000000000000000000000008416611484565b92915050565b600061078b826114e2565b3330146107e2576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044015b60405180910390fd5b6107eb8161153e565b50565b33301461082f576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b8060005b818110156108f357600084848381811061084f5761084f613378565b9050602002013590506108af816000604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c60006040516108e291815260200190565b60405180910390a250600101610833565b50505050565b6000806109078585856115f9565b509050801561093957507f1626ba7e00000000000000000000000000000000000000000000000000000000905061093f565b50600090505b9392505050565b600061078b8261073d565b6000806109768686604051610967929190612d57565b604051809103902085856115f9565b50905080156109a857507f20c13b0b0000000000000000000000000000000000000000000000000000000090506109ae565b50600090505b949350505050565b3330146109f7576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6107eb81611614565b600061078b826116a4565b333014610a4c576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c906080015b60405180910390a25050565b333014610b12576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6000610b1d8261073d565b73ffffffffffffffffffffffffffffffffffffffff1603610b8e576040517f1c3812cc0000000000000000000000000000000000000000000000000000000081527fffffffff00000000000000000000000000000000000000000000000000000000821660048201526024016107d9565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff00000000000000000000000000000000000000000000000000000000841682840152825180830384018152606090920190925280519101206000905550565b6000610c2a7fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf85490565b905090565b333014610c70576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6000610ca38383604051602001610c8892919061354f565b604051602081830303815290604052805190602001206116d0565b9050610cb0818484611755565b505050565b333014610cf6576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e290608001610ac5565b610d7c836118b3565b600080610db4858888604051602001610d9793929190613597565b6040516020818303038152906040528051906020012085856115f9565b9150915081610df5578084846040517f8f4a234f0000000000000000000000000000000000000000000000000000000081526004016107d9939291906135ba565b610e00818888611755565b50505050505050565b60008060008060008087876000818110610e2557610e25613378565b909101357fff00000000000000000000000000000000000000000000000000000000000000169150819050610e7b57610e5d896116d0565b9250610e6a8389896119b0565b92985090965094509150610fc69050565b7fff0000000000000000000000000000000000000000000000000000000000000081811601610eba57610ead896116d0565b9250610e6a838989611a01565b7ffe000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610f0c57610ead89611a2d565b7ffd000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610f7057610f60898989611a9a565b9550955095509550955050610fc6565b6040517f6085cd820000000000000000000000000000000000000000000000000000000081527fff00000000000000000000000000000000000000000000000000000000000000821660048201526024016107d9565b939792965093509350565b600061078b7f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e83611484565b606061105a61105561100d6112c4565b6040517f017012200000000000000000000000000000000000000000000000000000000060208201526024810191909152604401604051602081830303815290604052611c17565b611e30565b60405160200161106a91906135d4565b604051602081830303815290604052905090565b60003330146110c1576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b81516020830134f060405173ffffffffffffffffffffffffffffffffffffffff821681529091507fa506ad4e7f05eceba62a023c3219e5bd98a615f4fa87e2afb08a2da5cf62bf0c9060200160405180910390a1919050565b33301461115b576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b6107eb81611e59565b600061078b82611eb2565b6000610c2a6000610fd1565b3330146111bc576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b60006111c78361073d565b73ffffffffffffffffffffffffffffffffffffffff1614611238576040517f5b4d6d6a0000000000000000000000000000000000000000000000000000000081527fffffffff00000000000000000000000000000000000000000000000000000000831660048201526024016107d9565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff000000000000000000000000000000000000000000000000000000008516828401528251808303840181526060909201909252805191012073ffffffffffffffffffffffffffffffffffffffff821690555050565b5050565b6000610c2a7f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d0335490565b33301461132f576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b61133882611614565b6112c081611e59565b333014611382576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044016107d9565b8060005b818110156108f35760008484838181106113a2576113a2613378565b905060200201359050611421817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e27fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60405161147391815260200190565b60405180910390a250600101611386565b60008083836040516020016114a3929190918252602082015260400190565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0818403018152919052805160209091012054949350505050565b60007f6ffbd451000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083160161153557506001919050565b61078b82611ede565b73ffffffffffffffffffffffffffffffffffffffff81163b6115a4576040517f0c76093700000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff821660048201526024016107d9565b6115ac813055565b60405173ffffffffffffffffffffffffffffffffffffffff821681527f310ba5f1d2ed074b51e2eccd052a47ae9ab7c6b800d1fca3db3999d6a592ca03906020015b60405180910390a150565b60008061160785858561201f565b915091505b935093915050565b8061164b576040517f4294d12700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6116747fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf8829055565b6040518181527f307ed6bd941ee9fc80f369c94af5fa11e25bab5102a6140191756c5474a30bfa906020016115ee565b600061078b7f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd945483611484565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201524660228201527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b166042820152605681018290526000906076015b604051602081830303815290604052805190602001209050919050565b8060005b818110156118ac573684848381811061177457611774613378565b90506020028101906117869190613619565b90506040810135805a10156117db5782815a6040517f2bb3e3ba0000000000000000000000000000000000000000000000000000000081526004810193909352602483019190915260448201526064016107d9565b60006117ea6020840184613657565b15611829576118226118026080850160608601612ddb565b831561180e5783611810565b5a5b61181d60a0870187613672565b612053565b9050611864565b61186161183c6080850160608601612ddb565b6080850135841561184d578461184f565b5a5b61185c60a0880188613672565b61206e565b90505b80156118805760405188815260200160405180910390a06118a1565b6118a16118936040850160208601613657565b8961189c61208b565b6120aa565b505050600101611759565b5050505050565b606081901c6bffffffffffffffffffffffff821660006118d283610fd1565b905081811461191e576040517f9b6514f40000000000000000000000000000000000000000000000000000000081526004810184905260248101839052604481018290526064016107d9565b604080517f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e60208083019190915281830186905282518083038401815260609092019092528051910120600183019081905560408051858152602081018390527f1f180c27086c7a39ea2a7b25239d1ab92348f07ca7bb59d1438fcf527568f881910160405180910390a15050505050565b60008080806119cb876119c6876006818b6136d7565b6120f6565b6000908152873560f01c6020818152604080842084526002909a013560e01c908190529890912090999198509695509350505050565b6000808080611a1c87611a17876001818b6136d7565b6119b0565b935093509350935093509350935093565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201526000602282018190527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b1660428301526056820183905290607601611738565b6000808080806004600188013560e81c82611ab58383613730565b9050611ac78b61056383868d8f6136d7565b939b5091995097509550935087871015611b1f57611ae781848b8d6136d7565b89896040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016107d99493929190613743565b8092505b88831015611c095760038301928a013560e81c9150611b428383613730565b90506000611b64611b528861258c565b8c8c87908692610563939291906136d7565b939c50919a5098509091505088881015611bbc57611b8482858c8e6136d7565b8a8a6040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016107d99493929190613743565b848110611bff576040517f37daf62b00000000000000000000000000000000000000000000000000000000815260048101829052602481018690526044016107d9565b9350915081611b23565b505050939792965093509350565b8051606090600381901b60006005600483010467ffffffffffffffff811115611c4257611c42613112565b6040519080825280601f01601f191660200182016040528015611c6c576020820181803683370190505b5090506000806000805b86811015611d8057888181518110611c9057611c90613378565b01602001516008948501949390931b60f89390931c92909217915b60058410611d78576040805180820190915260208082527f6162636465666768696a6b6c6d6e6f707172737475767778797a323334353637818301527ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffb90950194601f85871c16908110611d2157611d21613378565b602001015160f81c60f81b858381518110611d3e57611d3e613378565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350600190910190611cab565b600101611c76565b508215611e24576040518060400160405280602081526020017f6162636465666768696a6b6c6d6e6f707172737475767778797a3233343536378152508360050383901b601f1681518110611dd757611dd7613378565b602001015160f81c60f81b848281518110611df457611df4613378565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053505b50919695505050505050565b606081604051602001611e43919061376a565b6040516020818303038152906040529050919050565b611e827f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d033829055565b6040518181527f20d3ef1b5738a9f6d7beae515432206e7a8e2740ca6dcf46a952190ad01bcb51906020016115ee565b600061078b7f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de83611484565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fec6aba50000000000000000000000000000000000000000000000000000000001480611f7157507fffffffff0000000000000000000000000000000000000000000000000000000082167f4e2312e000000000000000000000000000000000000000000000000000000000145b80611fbd57507fffffffff0000000000000000000000000000000000000000000000000000000082167f150b7a0200000000000000000000000000000000000000000000000000000000145b8061200957507fffffffff0000000000000000000000000000000000000000000000000000000082167fc0ee0b8a00000000000000000000000000000000000000000000000000000000145b1561201657506001919050565b61078b826125c0565b6000804261202c866116a4565b1191508115612048578161203f8661261c565b9150915061160c565b611607858585612657565b60006040518284823760008084838989f49695505050505050565b6000604051828482376000808483898b8af1979650505050505050565b60603d604051915060208201818101604052818352816000823e505090565b82156120b857805160208201fd5b7f3dbd1590ea96dd3253a91f24e64e3a502e1225d602a5731357bc12643070ccd782826040516120e99291906137af565b60405180910390a1505050565b60008060005b8381101561258357600181019085013560f81c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff810161219d57601582019186013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff81169074ff0000000000000000000000000000000000000000168117856121835780612192565b60008681526020829052604090205b9550505050506120fc565b806122335760018201918681013560f81c9060430160006121c98a6121c484888c8e6136d7565b612695565b60ff841697909701969194508491905060a083901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff821617866122185780612227565b60008781526020829052604090205b965050505050506120fc565b6002810361235b576000808784013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff16601586019550909250905060008885013560e81c600386018162ffffff1691508096508192505050600081860190506122ac8b848c8c8a9086926122a7939291906136d7565b612958565b6122f4578a836122be83898d8f6136d7565b6040517f9a9462320000000000000000000000000000000000000000000000000000000081526004016107d994939291906137c8565b60ff8416979097019694508460a084901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff8416178761233f578061234e565b60008881526020829052604090205b97505050505050506120fc565b6003810361238e576020820191860135836123765780612385565b60008481526020829052604090205b935050506120fc565b600481036123da576003808301928781013560e81c91908201016000806123bb8b6119c685898d8f6136d7565b600098895260205260409097209690970196509093506120fc92505050565b600681036124e25760008287013560f81c60018401935060ff16905060008784013560f01c60028501945061ffff16905060008885013560e81c600386018162ffffff1691508096508192505050600081860190506000806124488d8d8d8b9087926119c6939291906136d7565b9398508893909250905084821061245e57988501985b604080517f53657175656e6365206e657374656420636f6e6669673a0a0000000000000000602080830191909152603882018490526058820188905260788083018a90528351808403909101815260989092019092528051910120896124c457806124d3565b60008a81526020829052604090205b995050505050505050506120fc565b6005810361254e57602082019186013587810361251d577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff94505b600061252882612b05565b9050846125355780612544565b60008581526020829052604090205b94505050506120fc565b6040517fb2505f7c000000000000000000000000000000000000000000000000000000008152600481018290526024016107d9565b50935093915050565b7f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d1600090815260208290526040812061078b565b60007ffda4dd44000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083160161261357506001919050565b61078b82612b40565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd94546020820152908101829052600090606001611738565b600080600080600061266a888888610e09565b50965091945092509050828210801590612688575061268881612b9c565b9450505050935093915050565b6000604282146126d55782826040517f2ee17a3d0000000000000000000000000000000000000000000000000000000081526004016107d9929190613808565b60006126ee6126e560018561381c565b85013560f81c90565b60ff169050604084013560f81c843560208601357f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0811115612762578686826040517fad4aac760000000000000000000000000000000000000000000000000000000081526004016107d99392919061382f565b8260ff16601b1415801561277a57508260ff16601c14155b156127b7578686846040517fe578897e0000000000000000000000000000000000000000000000000000000081526004016107d993929190613853565b60018403612824576040805160008152602081018083528a905260ff851691810191909152606081018390526080810182905260019060a0015b6020604051602081039080840390855afa158015612813573d6000803e3d6000fd5b5050506020604051035194506128fc565b600284036128c1576040517f19457468657265756d205369676e6564204d6573736167653a0a3332000000006020820152603c8101899052600190605c01604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181528282528051602091820120600084529083018083525260ff861690820152606081018490526080810183905260a0016127f1565b86868560016040517f9dfba8520000000000000000000000000000000000000000000000000000000081526004016107d9949392919061387a565b73ffffffffffffffffffffffffffffffffffffffff851661294d5786866040517f6c1719d20000000000000000000000000000000000000000000000000000000081526004016107d9929190613808565b505050509392505050565b600080838361296860018261381c565b81811061297757612977613378565b919091013560f81c91505060018114806129915750600281145b156129d6578473ffffffffffffffffffffffffffffffffffffffff166129b8878686612695565b73ffffffffffffffffffffffffffffffffffffffff16149150612afc565b60038103612ac15773ffffffffffffffffffffffffffffffffffffffff8516631626ba7e8786600087612a0a60018261381c565b92612a17939291906136d7565b6040518463ffffffff1660e01b8152600401612a35939291906135ba565b602060405180830381865afa158015612a52573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612a7691906138a6565b7fffffffff00000000000000000000000000000000000000000000000000000000167f1626ba7e00000000000000000000000000000000000000000000000000000000149150612afc565b83838260006040517f9dfba8520000000000000000000000000000000000000000000000000000000081526004016107d9949392919061387a565b50949350505050565b6040517f53657175656e636520737461746963206469676573743a0a0000000000000000602082015260388101829052600090605801611738565b60007fe4a77bbc000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831601612b9357506001919050565b61078b82612ba7565b600061078b82612c03565b60007fae9fa280000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831601612bfa57506001919050565b61078b82612c3a565b6000612c0e82612d24565b15612c1b57506001919050565b6000612c2683611eb2565b9050801580159061093f5750421092915050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fac6a444e000000000000000000000000000000000000000000000000000000001480612ccd57507fffffffff0000000000000000000000000000000000000000000000000000000082167f36e7817500000000000000000000000000000000000000000000000000000000145b15612cda57506001919050565b7f01ffc9a7000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083161461078b565b6000811580159061078b5750507fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf8541490565b8183823760009101908152919050565b7fffffffff00000000000000000000000000000000000000000000000000000000811681146107eb57600080fd5b600060208284031215612da757600080fd5b813561093f81612d67565b803573ffffffffffffffffffffffffffffffffffffffff81168114612dd657600080fd5b919050565b600060208284031215612ded57600080fd5b61093f82612db2565b60008083601f840112612e0857600080fd5b50813567ffffffffffffffff811115612e2057600080fd5b6020830191508360208260051b8501011115612e3b57600080fd5b9250929050565b60008060208385031215612e5557600080fd5b823567ffffffffffffffff811115612e6c57600080fd5b612e7885828601612df6565b90969095509350505050565b60008083601f840112612e9657600080fd5b50813567ffffffffffffffff811115612eae57600080fd5b602083019150836020828501011115612e3b57600080fd5b600080600080600060808688031215612ede57600080fd5b612ee786612db2565b9450612ef560208701612db2565b935060408601359250606086013567ffffffffffffffff811115612f1857600080fd5b612f2488828901612e84565b969995985093965092949392505050565b600080600060408486031215612f4a57600080fd5b83359250602084013567ffffffffffffffff811115612f6857600080fd5b612f7486828701612e84565b9497909650939450505050565b60008060008060408587031215612f9757600080fd5b843567ffffffffffffffff80821115612faf57600080fd5b612fbb88838901612e84565b90965094506020870135915080821115612fd457600080fd5b50612fe187828801612e84565b95989497509550505050565b600060208284031215612fff57600080fd5b5035919050565b6000806040838503121561301957600080fd5b50508035926020909101359150565b60008060008060006060868803121561304057600080fd5b853567ffffffffffffffff8082111561305857600080fd5b61306489838a01612df6565b909750955060208801359450604088013591508082111561308457600080fd5b50612f2488828901612e84565b60005b838110156130ac578181015183820152602001613094565b50506000910152565b600081518084526130cd816020860160208601613091565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b60208152600061093f60208301846130b5565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b60006020828403121561315357600080fd5b813567ffffffffffffffff8082111561316b57600080fd5b818401915084601f83011261317f57600080fd5b81358181111561319157613191613112565b604051601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0908116603f011681019083821181831017156131d7576131d7613112565b816040528281528760208487010111156131f057600080fd5b826020860160208301376000928101602001929092525095945050505050565b6000806040838503121561322357600080fd5b823561322e81612d67565b915061323c60208401612db2565b90509250929050565b60008060008060008060008060a0898b03121561326157600080fd5b61326a89612db2565b975061327860208a01612db2565b9650604089013567ffffffffffffffff8082111561329557600080fd5b6132a18c838d01612df6565b909850965060608b01359150808211156132ba57600080fd5b6132c68c838d01612df6565b909650945060808b01359150808211156132df57600080fd5b506132ec8b828c01612e84565b999c989b5096995094979396929594505050565b60008060008060008060a0878903121561331957600080fd5b61332287612db2565b955061333060208801612db2565b94506040870135935060608701359250608087013567ffffffffffffffff81111561335a57600080fd5b61336689828a01612e84565b979a9699509497509295939492505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b80358015158114612dd657600080fd5b8183528181602085013750600060208284010152600060207fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f840116840101905092915050565b81835260006020808501808196508560051b810191508460005b8781101561354257828403895281357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4188360301811261345957600080fd5b870160c0613466826133a7565b151586526134758783016133a7565b15158688015260408281013590870152606073ffffffffffffffffffffffffffffffffffffffff6134a7828501612db2565b16908701526080828101359087015260a080830135368490037fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe10181126134ed57600080fd5b90920187810192903567ffffffffffffffff81111561350b57600080fd5b80360384131561351a57600080fd5b828289015261352c83890182866133b7565b9c89019c9750505092860192505060010161341a565b5091979650505050505050565b60408152600560408201527f73656c663a00000000000000000000000000000000000000000000000000000060608201526080602082015260006109ae608083018486613400565b8381526040602082015260006135b1604083018486613400565b95945050505050565b8381526040602082015260006135b16040830184866133b7565b7f697066733a2f2f0000000000000000000000000000000000000000000000000081526000825161360c816007850160208701613091565b9190910160070192915050565b600082357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4183360301811261364d57600080fd5b9190910192915050565b60006020828403121561366957600080fd5b61093f826133a7565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe18436030181126136a757600080fd5b83018035915067ffffffffffffffff8211156136c257600080fd5b602001915036819003821315612e3b57600080fd5b600080858511156136e757600080fd5b838611156136f457600080fd5b5050820193919092039150565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b8082018082111561078b5761078b613701565b6060815260006137576060830186886133b7565b6020830194909452506040015292915050565b7f62000000000000000000000000000000000000000000000000000000000000008152600082516137a2816001850160208701613091565b9190910160010192915050565b8281526040602082015260006109ae60408301846130b5565b84815273ffffffffffffffffffffffffffffffffffffffff841660208201526060604082015260006137fe6060830184866133b7565b9695505050505050565b6020815260006109ae6020830184866133b7565b8181038181111561078b5761078b613701565b6040815260006138436040830185876133b7565b9050826020830152949350505050565b6040815260006138676040830185876133b7565b905060ff83166020830152949350505050565b60608152600061388e6060830186886133b7565b60208301949094525090151560409091015292915050565b6000602082840312156138b857600080fd5b815161093f81612d6756fea264697066735822122030f6a03eecf061513999472455e58728f2693e3a3541e4333a309b089861d90064736f6c63430008110033',
  linkReferences: {},
  deployedLinkReferences: {}
}
