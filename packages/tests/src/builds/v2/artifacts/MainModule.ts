export const mainModule = {
  _format: 'hh-sol-artifact-1',
  contractName: 'MainModule',
  sourceName: 'contracts/modules/MainModule.sol',
  abi: [
    {
      inputs: [
        {
          internalType: 'address',
          name: '_factory',
          type: 'address'
        },
        {
          internalType: 'address',
          name: '_mainModuleUpgradable',
          type: 'address'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'constructor'
    },
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
      name: 'FACTORY',
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
      inputs: [],
      name: 'INIT_CODE_HASH',
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
      inputs: [],
      name: 'UPGRADEABLE_IMPLEMENTATION',
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
    '0x60e06040523480156200001157600080fd5b5060405162003b9e38038062003b9e8339810160408190526200003491620000ba565b8181600060405180606001604052806028815260200162003b76602891396040516200006691903090602001620000f2565b60408051601f198184030181529190528051602090910120608052506001600160a01b0391821660a0521660c05250620001269050565b80516001600160a01b0381168114620000b557600080fd5b919050565b60008060408385031215620000ce57600080fd5b620000d9836200009d565b9150620000e9602084016200009d565b90509250929050565b6000835160005b81811015620001155760208187018101518583015201620000f9565b509190910191825250602001919050565b60805160a05160c051613a0b6200016b6000396000818161060b015261171f01526000818161049b0152612ca30152600081816104390152612cd40152613a0b6000f3fe6080604052600436106101dc5760003560e01c806379e472c911610102578063a4ab5f9f11610095578063c71f1f9611610064578063c71f1f961461073f578063d0748f7114610754578063d59f788514610774578063f23a6e6114610794576101e3565b8063a4ab5f9f146106a2578063affed0e0146106c2578063b93ea7ad146106d7578063bc197c81146106f7576101e3565b80638c3f5563116100d15780638c3f55631461062d5780638efa64411461064d57806390042baf1461066f578063a38cef1914610682576101e3565b806379e472c9146105715780637a9a162814610591578063853c5068146105b1578063888eeec6146105f9576101e3565b8063257671f51161017a5780634598154f116101495780634598154f146104dd5780634fcf3eca146104fd57806357c56d6b1461051d57806361c2926c14610551576101e3565b8063257671f51461042757806329561426146104695780632dd310001461048957806341ea0302146104bd576101e3565b8063150b7a02116101b6578063150b7a021461032c5780631626ba7e146103a25780631a9b2337146103c257806320c13b0b14610407576101e3565b806301ffc9a7146102b7578063025b22bc146102ec578063038dbaac1461030c576101e3565b366101e357005b60006102126000357fffffffff00000000000000000000000000000000000000000000000000000000166107da565b905073ffffffffffffffffffffffffffffffffffffffff8116156102b5576000808273ffffffffffffffffffffffffffffffffffffffff1660003660405161025b929190612e69565b600060405180830381855af49150503d8060008114610296576040519150601f19603f3d011682016040523d82523d6000602084013e61029b565b606091505b5091509150816102ad57805160208201fd5b805160208201f35b005b3480156102c357600080fd5b506102d76102d2366004612ea7565b61082e565b60405190151581526020015b60405180910390f35b3480156102f857600080fd5b506102b5610307366004612eed565b610839565b34801561031857600080fd5b506102b5610327366004612f54565b61088b565b34801561033857600080fd5b50610371610347366004612fd8565b7f150b7a020000000000000000000000000000000000000000000000000000000095945050505050565b6040517fffffffff0000000000000000000000000000000000000000000000000000000090911681526020016102e3565b3480156103ae57600080fd5b506103716103bd366004613047565b610996565b3480156103ce57600080fd5b506103e26103dd366004612ea7565b6109e3565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020016102e3565b34801561041357600080fd5b50610371610422366004613093565b6109ee565b34801561043357600080fd5b5061045b7f000000000000000000000000000000000000000000000000000000000000000081565b6040519081526020016102e3565b34801561047557600080fd5b506102b56104843660046130ff565b610a53565b34801561049557600080fd5b506103e27f000000000000000000000000000000000000000000000000000000000000000081565b3480156104c957600080fd5b5061045b6104d83660046130ff565b610a9d565b3480156104e957600080fd5b506102b56104f8366004613118565b610aa8565b34801561050957600080fd5b506102b5610518366004612ea7565b610b6e565b34801561052957600080fd5b5061045b7f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d181565b34801561055d57600080fd5b506102b561056c366004612f54565b610c9d565b34801561057d57600080fd5b506102b561058c366004613118565b610d23565b34801561059d57600080fd5b506102b56105ac36600461313a565b610de1565b3480156105bd57600080fd5b506105d16105cc366004613047565b610e77565b604080519586526020860194909452928401919091526060830152608082015260a0016102e3565b34801561060557600080fd5b506103e27f000000000000000000000000000000000000000000000000000000000000000081565b34801561063957600080fd5b5061045b6106483660046130ff565b61103f565b34801561065957600080fd5b5061066261106b565b6040516102e39190613211565b6103e261067d366004613253565b6110ec565b34801561068e57600080fd5b506102b561069d3660046130ff565b611188565b3480156106ae57600080fd5b5061045b6106bd3660046130ff565b6111d2565b3480156106ce57600080fd5b5061045b6111dd565b3480156106e357600080fd5b506102b56106f2366004613322565b6111ee565b34801561070357600080fd5b50610371610712366004613357565b7fbc197c810000000000000000000000000000000000000000000000000000000098975050505050505050565b34801561074b57600080fd5b5061045b611337565b34801561076057600080fd5b506102b561076f366004613118565b611361565b34801561078057600080fd5b506102b561078f366004612f54565b6113b4565b3480156107a057600080fd5b506103716107af366004613412565b7ff23a6e61000000000000000000000000000000000000000000000000000000009695505050505050565b60006108287fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1207fffffffff0000000000000000000000000000000000000000000000000000000084166114f7565b92915050565b600061082882611555565b33301461087f576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044015b60405180910390fd5b610888816115b1565b50565b3330146108cc576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b8060005b818110156109905760008484838181106108ec576108ec61348a565b90506020020135905061094c816000604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c600060405161097f91815260200190565b60405180910390a2506001016108d0565b50505050565b6000806109a485858561166c565b50905080156109d657507f1626ba7e0000000000000000000000000000000000000000000000000000000090506109dc565b50600090505b9392505050565b6000610828826107da565b600080610a138686604051610a04929190612e69565b6040518091039020858561166c565b5090508015610a4557507f20c13b0b000000000000000000000000000000000000000000000000000000009050610a4b565b50600090505b949350505050565b333014610a94576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b61088881611687565b600061082882611743565b333014610ae9576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c906080015b60405180910390a25050565b333014610baf576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b6000610bba826107da565b73ffffffffffffffffffffffffffffffffffffffff1603610c2b576040517f1c3812cc0000000000000000000000000000000000000000000000000000000081527fffffffff0000000000000000000000000000000000000000000000000000000082166004820152602401610876565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff00000000000000000000000000000000000000000000000000000000841682840152825180830384018152606090920190925280519101206000905550565b333014610cde576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b6000610d118383604051602001610cf6929190613661565b6040516020818303038152906040528051906020012061176f565b9050610d1e8184846117f4565b505050565b333014610d64576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e290608001610b62565b610dea83611952565b600080610e22858888604051602001610e05939291906136a9565b60405160208183030381529060405280519060200120858561166c565b9150915081610e63578084846040517f8f4a234f000000000000000000000000000000000000000000000000000000008152600401610876939291906136cc565b610e6e8188886117f4565b50505050505050565b60008060008060008087876000818110610e9357610e9361348a565b909101357fff00000000000000000000000000000000000000000000000000000000000000169150819050610ee957610ecb8961176f565b9250610ed8838989611a4f565b929850909650945091506110349050565b7fff0000000000000000000000000000000000000000000000000000000000000081811601610f2857610f1b8961176f565b9250610ed8838989611aa0565b7ffe000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610f7a57610f1b89611acc565b7ffd000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610fde57610fce898989611b39565b9550955095509550955050611034565b6040517f6085cd820000000000000000000000000000000000000000000000000000000081527fff0000000000000000000000000000000000000000000000000000000000000082166004820152602401610876565b939792965093509350565b60006108287f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e836114f7565b60606110c86110c361107b611337565b6040517f017012200000000000000000000000000000000000000000000000000000000060208201526024810191909152604401604051602081830303815290604052611cb6565b611ecf565b6040516020016110d891906136e6565b604051602081830303815290604052905090565b600033301461112f576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b81516020830134f060405173ffffffffffffffffffffffffffffffffffffffff821681529091507fa506ad4e7f05eceba62a023c3219e5bd98a615f4fa87e2afb08a2da5cf62bf0c9060200160405180910390a1919050565b3330146111c9576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b61088881611ef8565b600061082882611f51565b60006111e9600061103f565b905090565b33301461122f576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b600061123a836107da565b73ffffffffffffffffffffffffffffffffffffffff16146112ab576040517f5b4d6d6a0000000000000000000000000000000000000000000000000000000081527fffffffff0000000000000000000000000000000000000000000000000000000083166004820152602401610876565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff000000000000000000000000000000000000000000000000000000008516828401528251808303840181526060909201909252805191012073ffffffffffffffffffffffffffffffffffffffff821690555050565b5050565b60006111e97f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d0335490565b3330146113a2576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b6113ab82611687565b61133381611ef8565b3330146113f5576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b8060005b818110156109905760008484838181106114155761141561348a565b905060200201359050611494817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e27fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6040516114e691815260200190565b60405180910390a2506001016113f9565b6000808383604051602001611516929190918252602082015260400190565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0818403018152919052805160209091012054949350505050565b60007f6ffbd451000000000000000000000000000000000000000000000000000000007fffffffff000000000000000000000000000000000000000000000000000000008316016115a857506001919050565b61082882611f7d565b73ffffffffffffffffffffffffffffffffffffffff81163b611617576040517f0c76093700000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff82166004820152602401610876565b61161f813055565b60405173ffffffffffffffffffffffffffffffffffffffff821681527f310ba5f1d2ed074b51e2eccd052a47ae9ab7c6b800d1fca3db3999d6a592ca03906020015b60405180910390a150565b60008061167a8585856120be565b915091505b935093915050565b806116be576040517f4294d12700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6116e77fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf8829055565b6040518181527f307ed6bd941ee9fc80f369c94af5fa11e25bab5102a6140191756c5474a30bfa9060200160405180910390a16108887f00000000000000000000000000000000000000000000000000000000000000006115b1565b60006108287f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454836114f7565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201524660228201527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b166042820152605681018290526000906076015b604051602081830303815290604052805190602001209050919050565b8060005b8181101561194b57368484838181106118135761181361348a565b9050602002810190611825919061372b565b90506040810135805a101561187a5782815a6040517f2bb3e3ba000000000000000000000000000000000000000000000000000000008152600481019390935260248301919091526044820152606401610876565b60006118896020840184613769565b156118c8576118c16118a16080850160608601612eed565b83156118ad57836118af565b5a5b6118bc60a0870187613784565b6120f2565b9050611903565b6119006118db6080850160608601612eed565b608085013584156118ec57846118ee565b5a5b6118fb60a0880188613784565b61210d565b90505b801561191f5760405188815260200160405180910390a0611940565b6119406119326040850160208601613769565b8961193b61212a565b612149565b5050506001016117f8565b5050505050565b606081901c6bffffffffffffffffffffffff821660006119718361103f565b90508181146119bd576040517f9b6514f4000000000000000000000000000000000000000000000000000000008152600481018490526024810183905260448101829052606401610876565b604080517f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e60208083019190915281830186905282518083038401815260609092019092528051910120600183019081905560408051858152602081018390527f1f180c27086c7a39ea2a7b25239d1ab92348f07ca7bb59d1438fcf527568f881910160405180910390a15050505050565b6000808080611a6a87611a65876006818b6137e9565b612195565b6000908152873560f01c6020818152604080842084526002909a013560e01c908190529890912090999198509695509350505050565b6000808080611abb87611ab6876001818b6137e9565b611a4f565b935093509350935093509350935093565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201526000602282018190527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b16604283015260568201839052906076016117d7565b6000808080806004600188013560e81c82611b548383613842565b9050611b668b6105cc83868d8f6137e9565b939b5091995097509550935087871015611bbe57611b8681848b8d6137e9565b89896040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016108769493929190613855565b8092505b88831015611ca85760038301928a013560e81c9150611be18383613842565b90506000611c03611bf18861262b565b8c8c879086926105cc939291906137e9565b939c50919a5098509091505088881015611c5b57611c2382858c8e6137e9565b8a8a6040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016108769493929190613855565b848110611c9e576040517f37daf62b0000000000000000000000000000000000000000000000000000000081526004810182905260248101869052604401610876565b9350915081611bc2565b505050939792965093509350565b8051606090600381901b60006005600483010467ffffffffffffffff811115611ce157611ce1613224565b6040519080825280601f01601f191660200182016040528015611d0b576020820181803683370190505b5090506000806000805b86811015611e1f57888181518110611d2f57611d2f61348a565b01602001516008948501949390931b60f89390931c92909217915b60058410611e17576040805180820190915260208082527f6162636465666768696a6b6c6d6e6f707172737475767778797a323334353637818301527ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffb90950194601f85871c16908110611dc057611dc061348a565b602001015160f81c60f81b858381518110611ddd57611ddd61348a565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350600190910190611d4a565b600101611d15565b508215611ec3576040518060400160405280602081526020017f6162636465666768696a6b6c6d6e6f707172737475767778797a3233343536378152508360050383901b601f1681518110611e7657611e7661348a565b602001015160f81c60f81b848281518110611e9357611e9361348a565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053505b50919695505050505050565b606081604051602001611ee2919061387c565b6040516020818303038152906040529050919050565b611f217f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d033829055565b6040518181527f20d3ef1b5738a9f6d7beae515432206e7a8e2740ca6dcf46a952190ad01bcb5190602001611661565b60006108287f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de836114f7565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fec6aba5000000000000000000000000000000000000000000000000000000000148061201057507fffffffff0000000000000000000000000000000000000000000000000000000082167f4e2312e000000000000000000000000000000000000000000000000000000000145b8061205c57507fffffffff0000000000000000000000000000000000000000000000000000000082167f150b7a0200000000000000000000000000000000000000000000000000000000145b806120a857507fffffffff0000000000000000000000000000000000000000000000000000000082167fc0ee0b8a00000000000000000000000000000000000000000000000000000000145b156120b557506001919050565b6108288261265f565b600080426120cb86611743565b11915081156120e757816120de866126bb565b9150915061167f565b61167a8585856126f6565b60006040518284823760008084838989f49695505050505050565b6000604051828482376000808483898b8af1979650505050505050565b60603d604051915060208201818101604052818352816000823e505090565b821561215757805160208201fd5b7f3dbd1590ea96dd3253a91f24e64e3a502e1225d602a5731357bc12643070ccd782826040516121889291906138c1565b60405180910390a1505050565b60008060005b8381101561262257600181019085013560f81c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff810161223c57601582019186013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff81169074ff0000000000000000000000000000000000000000168117856122225780612231565b60008681526020829052604090205b95505050505061219b565b806122d25760018201918681013560f81c9060430160006122688a61226384888c8e6137e9565b612734565b60ff841697909701969194508491905060a083901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff821617866122b757806122c6565b60008781526020829052604090205b9650505050505061219b565b600281036123fa576000808784013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff16601586019550909250905060008885013560e81c600386018162ffffff16915080965081925050506000818601905061234b8b848c8c8a908692612346939291906137e9565b6129f7565b612393578a8361235d83898d8f6137e9565b6040517f9a94623200000000000000000000000000000000000000000000000000000000815260040161087694939291906138da565b60ff8416979097019694508460a084901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff841617876123de57806123ed565b60008881526020829052604090205b975050505050505061219b565b6003810361242d576020820191860135836124155780612424565b60008481526020829052604090205b9350505061219b565b60048103612479576003808301928781013560e81c919082010160008061245a8b611a6585898d8f6137e9565b6000988952602052604090972096909701965090935061219b92505050565b600681036125815760008287013560f81c60018401935060ff16905060008784013560f01c60028501945061ffff16905060008885013560e81c600386018162ffffff1691508096508192505050600081860190506000806124e78d8d8d8b908792611a65939291906137e9565b939850889390925090508482106124fd57988501985b604080517f53657175656e6365206e657374656420636f6e6669673a0a0000000000000000602080830191909152603882018490526058820188905260788083018a90528351808403909101815260989092019092528051910120896125635780612572565b60008a81526020829052604090205b9950505050505050505061219b565b600581036125ed5760208201918601358781036125bc577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff94505b60006125c782612ba4565b9050846125d457806125e3565b60008581526020829052604090205b945050505061219b565b6040517fb2505f7c00000000000000000000000000000000000000000000000000000000815260048101829052602401610876565b50935093915050565b7f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d16000908152602082905260408120610828565b60007fe4a77bbc000000000000000000000000000000000000000000000000000000007fffffffff000000000000000000000000000000000000000000000000000000008316016126b257506001919050565b61082882612bdf565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd945460208201529081018290526000906060016117d7565b6000806000806000612709888888610e77565b50965091945092509050828210801590612727575061272781612bea565b9450505050935093915050565b6000604282146127745782826040517f2ee17a3d00000000000000000000000000000000000000000000000000000000815260040161087692919061391a565b600061278d61278460018561392e565b85013560f81c90565b60ff169050604084013560f81c843560208601357f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0811115612801578686826040517fad4aac7600000000000000000000000000000000000000000000000000000000815260040161087693929190613941565b8260ff16601b1415801561281957508260ff16601c14155b15612856578686846040517fe578897e00000000000000000000000000000000000000000000000000000000815260040161087693929190613965565b600184036128c3576040805160008152602081018083528a905260ff851691810191909152606081018390526080810182905260019060a0015b6020604051602081039080840390855afa1580156128b2573d6000803e3d6000fd5b50505060206040510351945061299b565b60028403612960576040517f19457468657265756d205369676e6564204d6573736167653a0a3332000000006020820152603c8101899052600190605c01604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181528282528051602091820120600084529083018083525260ff861690820152606081018490526080810183905260a001612890565b86868560016040517f9dfba852000000000000000000000000000000000000000000000000000000008152600401610876949392919061398c565b73ffffffffffffffffffffffffffffffffffffffff85166129ec5786866040517f6c1719d200000000000000000000000000000000000000000000000000000000815260040161087692919061391a565b505050509392505050565b6000808383612a0760018261392e565b818110612a1657612a1661348a565b919091013560f81c9150506001811480612a305750600281145b15612a75578473ffffffffffffffffffffffffffffffffffffffff16612a57878686612734565b73ffffffffffffffffffffffffffffffffffffffff16149150612b9b565b60038103612b605773ffffffffffffffffffffffffffffffffffffffff8516631626ba7e8786600087612aa960018261392e565b92612ab6939291906137e9565b6040518463ffffffff1660e01b8152600401612ad4939291906136cc565b602060405180830381865afa158015612af1573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612b1591906139b8565b7fffffffff00000000000000000000000000000000000000000000000000000000167f1626ba7e00000000000000000000000000000000000000000000000000000000149150612b9b565b83838260006040517f9dfba852000000000000000000000000000000000000000000000000000000008152600401610876949392919061398c565b50949350505050565b6040517f53657175656e636520737461746963206469676573743a0a00000000000000006020820152603881018290526000906058016117d7565b600061082882612bf5565b600061082882612c51565b60007ffda4dd44000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831601612c4857506001919050565b61082882612d7f565b6000612d53826040517fff0000000000000000000000000000000000000000000000000000000000000060208201527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000007f000000000000000000000000000000000000000000000000000000000000000060601b166021820152603581018290527f000000000000000000000000000000000000000000000000000000000000000060558201526000903090607501604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0818403018152919052805160209091012073ffffffffffffffffffffffffffffffffffffffff161492915050565b15612d6057506001919050565b6000612d6b83611f51565b905080158015906109dc5750421092915050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fac6a444e000000000000000000000000000000000000000000000000000000001480612e1257507fffffffff0000000000000000000000000000000000000000000000000000000082167f36e7817500000000000000000000000000000000000000000000000000000000145b15612e1f57506001919050565b7f01ffc9a7000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831614610828565b8183823760009101908152919050565b7fffffffff000000000000000000000000000000000000000000000000000000008116811461088857600080fd5b600060208284031215612eb957600080fd5b81356109dc81612e79565b803573ffffffffffffffffffffffffffffffffffffffff81168114612ee857600080fd5b919050565b600060208284031215612eff57600080fd5b6109dc82612ec4565b60008083601f840112612f1a57600080fd5b50813567ffffffffffffffff811115612f3257600080fd5b6020830191508360208260051b8501011115612f4d57600080fd5b9250929050565b60008060208385031215612f6757600080fd5b823567ffffffffffffffff811115612f7e57600080fd5b612f8a85828601612f08565b90969095509350505050565b60008083601f840112612fa857600080fd5b50813567ffffffffffffffff811115612fc057600080fd5b602083019150836020828501011115612f4d57600080fd5b600080600080600060808688031215612ff057600080fd5b612ff986612ec4565b945061300760208701612ec4565b935060408601359250606086013567ffffffffffffffff81111561302a57600080fd5b61303688828901612f96565b969995985093965092949392505050565b60008060006040848603121561305c57600080fd5b83359250602084013567ffffffffffffffff81111561307a57600080fd5b61308686828701612f96565b9497909650939450505050565b600080600080604085870312156130a957600080fd5b843567ffffffffffffffff808211156130c157600080fd5b6130cd88838901612f96565b909650945060208701359150808211156130e657600080fd5b506130f387828801612f96565b95989497509550505050565b60006020828403121561311157600080fd5b5035919050565b6000806040838503121561312b57600080fd5b50508035926020909101359150565b60008060008060006060868803121561315257600080fd5b853567ffffffffffffffff8082111561316a57600080fd5b61317689838a01612f08565b909750955060208801359450604088013591508082111561319657600080fd5b5061303688828901612f96565b60005b838110156131be5781810151838201526020016131a6565b50506000910152565b600081518084526131df8160208601602086016131a3565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b6020815260006109dc60208301846131c7565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b60006020828403121561326557600080fd5b813567ffffffffffffffff8082111561327d57600080fd5b818401915084601f83011261329157600080fd5b8135818111156132a3576132a3613224565b604051601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0908116603f011681019083821181831017156132e9576132e9613224565b8160405282815287602084870101111561330257600080fd5b826020860160208301376000928101602001929092525095945050505050565b6000806040838503121561333557600080fd5b823561334081612e79565b915061334e60208401612ec4565b90509250929050565b60008060008060008060008060a0898b03121561337357600080fd5b61337c89612ec4565b975061338a60208a01612ec4565b9650604089013567ffffffffffffffff808211156133a757600080fd5b6133b38c838d01612f08565b909850965060608b01359150808211156133cc57600080fd5b6133d88c838d01612f08565b909650945060808b01359150808211156133f157600080fd5b506133fe8b828c01612f96565b999c989b5096995094979396929594505050565b60008060008060008060a0878903121561342b57600080fd5b61343487612ec4565b955061344260208801612ec4565b94506040870135935060608701359250608087013567ffffffffffffffff81111561346c57600080fd5b61347889828a01612f96565b979a9699509497509295939492505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b80358015158114612ee857600080fd5b8183528181602085013750600060208284010152600060207fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f840116840101905092915050565b81835260006020808501808196508560051b810191508460005b8781101561365457828403895281357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4188360301811261356b57600080fd5b870160c0613578826134b9565b151586526135878783016134b9565b15158688015260408281013590870152606073ffffffffffffffffffffffffffffffffffffffff6135b9828501612ec4565b16908701526080828101359087015260a080830135368490037fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe10181126135ff57600080fd5b90920187810192903567ffffffffffffffff81111561361d57600080fd5b80360384131561362c57600080fd5b828289015261363e83890182866134c9565b9c89019c9750505092860192505060010161352c565b5091979650505050505050565b60408152600560408201527f73656c663a0000000000000000000000000000000000000000000000000000006060820152608060208201526000610a4b608083018486613512565b8381526040602082015260006136c3604083018486613512565b95945050505050565b8381526040602082015260006136c36040830184866134c9565b7f697066733a2f2f0000000000000000000000000000000000000000000000000081526000825161371e8160078501602087016131a3565b9190910160070192915050565b600082357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4183360301811261375f57600080fd5b9190910192915050565b60006020828403121561377b57600080fd5b6109dc826134b9565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe18436030181126137b957600080fd5b83018035915067ffffffffffffffff8211156137d457600080fd5b602001915036819003821315612f4d57600080fd5b600080858511156137f957600080fd5b8386111561380657600080fd5b5050820193919092039150565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b8082018082111561082857610828613813565b6060815260006138696060830186886134c9565b6020830194909452506040015292915050565b7f62000000000000000000000000000000000000000000000000000000000000008152600082516138b48160018501602087016131a3565b9190910160010192915050565b828152604060208201526000610a4b60408301846131c7565b84815273ffffffffffffffffffffffffffffffffffffffff841660208201526060604082015260006139106060830184866134c9565b9695505050505050565b602081526000610a4b6020830184866134c9565b8181038181111561082857610828613813565b6040815260006139556040830185876134c9565b9050826020830152949350505050565b6040815260006139796040830185876134c9565b905060ff83166020830152949350505050565b6060815260006139a06060830186886134c9565b60208301949094525090151560409091015292915050565b6000602082840312156139ca57600080fd5b81516109dc81612e7956fea2646970667358221220e6905b82ca2ea91a0c6cc4a371ce0a85eb88794fb3bc7734ed5414f524c47c4264736f6c63430008110033603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3',
  deployedBytecode:
    '0x6080604052600436106101dc5760003560e01c806379e472c911610102578063a4ab5f9f11610095578063c71f1f9611610064578063c71f1f961461073f578063d0748f7114610754578063d59f788514610774578063f23a6e6114610794576101e3565b8063a4ab5f9f146106a2578063affed0e0146106c2578063b93ea7ad146106d7578063bc197c81146106f7576101e3565b80638c3f5563116100d15780638c3f55631461062d5780638efa64411461064d57806390042baf1461066f578063a38cef1914610682576101e3565b806379e472c9146105715780637a9a162814610591578063853c5068146105b1578063888eeec6146105f9576101e3565b8063257671f51161017a5780634598154f116101495780634598154f146104dd5780634fcf3eca146104fd57806357c56d6b1461051d57806361c2926c14610551576101e3565b8063257671f51461042757806329561426146104695780632dd310001461048957806341ea0302146104bd576101e3565b8063150b7a02116101b6578063150b7a021461032c5780631626ba7e146103a25780631a9b2337146103c257806320c13b0b14610407576101e3565b806301ffc9a7146102b7578063025b22bc146102ec578063038dbaac1461030c576101e3565b366101e357005b60006102126000357fffffffff00000000000000000000000000000000000000000000000000000000166107da565b905073ffffffffffffffffffffffffffffffffffffffff8116156102b5576000808273ffffffffffffffffffffffffffffffffffffffff1660003660405161025b929190612e69565b600060405180830381855af49150503d8060008114610296576040519150601f19603f3d011682016040523d82523d6000602084013e61029b565b606091505b5091509150816102ad57805160208201fd5b805160208201f35b005b3480156102c357600080fd5b506102d76102d2366004612ea7565b61082e565b60405190151581526020015b60405180910390f35b3480156102f857600080fd5b506102b5610307366004612eed565b610839565b34801561031857600080fd5b506102b5610327366004612f54565b61088b565b34801561033857600080fd5b50610371610347366004612fd8565b7f150b7a020000000000000000000000000000000000000000000000000000000095945050505050565b6040517fffffffff0000000000000000000000000000000000000000000000000000000090911681526020016102e3565b3480156103ae57600080fd5b506103716103bd366004613047565b610996565b3480156103ce57600080fd5b506103e26103dd366004612ea7565b6109e3565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020016102e3565b34801561041357600080fd5b50610371610422366004613093565b6109ee565b34801561043357600080fd5b5061045b7f000000000000000000000000000000000000000000000000000000000000000081565b6040519081526020016102e3565b34801561047557600080fd5b506102b56104843660046130ff565b610a53565b34801561049557600080fd5b506103e27f000000000000000000000000000000000000000000000000000000000000000081565b3480156104c957600080fd5b5061045b6104d83660046130ff565b610a9d565b3480156104e957600080fd5b506102b56104f8366004613118565b610aa8565b34801561050957600080fd5b506102b5610518366004612ea7565b610b6e565b34801561052957600080fd5b5061045b7f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d181565b34801561055d57600080fd5b506102b561056c366004612f54565b610c9d565b34801561057d57600080fd5b506102b561058c366004613118565b610d23565b34801561059d57600080fd5b506102b56105ac36600461313a565b610de1565b3480156105bd57600080fd5b506105d16105cc366004613047565b610e77565b604080519586526020860194909452928401919091526060830152608082015260a0016102e3565b34801561060557600080fd5b506103e27f000000000000000000000000000000000000000000000000000000000000000081565b34801561063957600080fd5b5061045b6106483660046130ff565b61103f565b34801561065957600080fd5b5061066261106b565b6040516102e39190613211565b6103e261067d366004613253565b6110ec565b34801561068e57600080fd5b506102b561069d3660046130ff565b611188565b3480156106ae57600080fd5b5061045b6106bd3660046130ff565b6111d2565b3480156106ce57600080fd5b5061045b6111dd565b3480156106e357600080fd5b506102b56106f2366004613322565b6111ee565b34801561070357600080fd5b50610371610712366004613357565b7fbc197c810000000000000000000000000000000000000000000000000000000098975050505050505050565b34801561074b57600080fd5b5061045b611337565b34801561076057600080fd5b506102b561076f366004613118565b611361565b34801561078057600080fd5b506102b561078f366004612f54565b6113b4565b3480156107a057600080fd5b506103716107af366004613412565b7ff23a6e61000000000000000000000000000000000000000000000000000000009695505050505050565b60006108287fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1207fffffffff0000000000000000000000000000000000000000000000000000000084166114f7565b92915050565b600061082882611555565b33301461087f576040517fe12588940000000000000000000000000000000000000000000000000000000081523360048201523060248201526044015b60405180910390fd5b610888816115b1565b50565b3330146108cc576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b8060005b818110156109905760008484838181106108ec576108ec61348a565b90506020020135905061094c816000604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c600060405161097f91815260200190565b60405180910390a2506001016108d0565b50505050565b6000806109a485858561166c565b50905080156109d657507f1626ba7e0000000000000000000000000000000000000000000000000000000090506109dc565b50600090505b9392505050565b6000610828826107da565b600080610a138686604051610a04929190612e69565b6040518091039020858561166c565b5090508015610a4557507f20c13b0b000000000000000000000000000000000000000000000000000000009050610a4b565b50600090505b949350505050565b333014610a94576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b61088881611687565b600061082882611743565b333014610ae9576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b604080517f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f804f6171d6008d9e16ee3aa0561fec328397f4ba2827a6605db388cfdefa3b0c906080015b60405180910390a25050565b333014610baf576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b6000610bba826107da565b73ffffffffffffffffffffffffffffffffffffffff1603610c2b576040517f1c3812cc0000000000000000000000000000000000000000000000000000000081527fffffffff0000000000000000000000000000000000000000000000000000000082166004820152602401610876565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff00000000000000000000000000000000000000000000000000000000841682840152825180830384018152606090920190925280519101206000905550565b333014610cde576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b6000610d118383604051602001610cf6929190613661565b6040516020818303038152906040528051906020012061176f565b9050610d1e8184846117f4565b505050565b333014610d64576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606083019384905280519101208390559082905282907f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e290608001610b62565b610dea83611952565b600080610e22858888604051602001610e05939291906136a9565b60405160208183030381529060405280519060200120858561166c565b9150915081610e63578084846040517f8f4a234f000000000000000000000000000000000000000000000000000000008152600401610876939291906136cc565b610e6e8188886117f4565b50505050505050565b60008060008060008087876000818110610e9357610e9361348a565b909101357fff00000000000000000000000000000000000000000000000000000000000000169150819050610ee957610ecb8961176f565b9250610ed8838989611a4f565b929850909650945091506110349050565b7fff0000000000000000000000000000000000000000000000000000000000000081811601610f2857610f1b8961176f565b9250610ed8838989611aa0565b7ffe000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610f7a57610f1b89611acc565b7ffd000000000000000000000000000000000000000000000000000000000000007fff00000000000000000000000000000000000000000000000000000000000000821601610fde57610fce898989611b39565b9550955095509550955050611034565b6040517f6085cd820000000000000000000000000000000000000000000000000000000081527fff0000000000000000000000000000000000000000000000000000000000000082166004820152602401610876565b939792965093509350565b60006108287f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e836114f7565b60606110c86110c361107b611337565b6040517f017012200000000000000000000000000000000000000000000000000000000060208201526024810191909152604401604051602081830303815290604052611cb6565b611ecf565b6040516020016110d891906136e6565b604051602081830303815290604052905090565b600033301461112f576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b81516020830134f060405173ffffffffffffffffffffffffffffffffffffffff821681529091507fa506ad4e7f05eceba62a023c3219e5bd98a615f4fa87e2afb08a2da5cf62bf0c9060200160405180910390a1919050565b3330146111c9576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b61088881611ef8565b600061082882611f51565b60006111e9600061103f565b905090565b33301461122f576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b600061123a836107da565b73ffffffffffffffffffffffffffffffffffffffff16146112ab576040517f5b4d6d6a0000000000000000000000000000000000000000000000000000000081527fffffffff0000000000000000000000000000000000000000000000000000000083166004820152602401610876565b604080517fbe27a319efc8734e89e26ba4bc95f5c788584163b959f03fa04e2d7ab4b9a1206020808301919091527fffffffff000000000000000000000000000000000000000000000000000000008516828401528251808303840181526060909201909252805191012073ffffffffffffffffffffffffffffffffffffffff821690555050565b5050565b60006111e97f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d0335490565b3330146113a2576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b6113ab82611687565b61133381611ef8565b3330146113f5576040517fe1258894000000000000000000000000000000000000000000000000000000008152336004820152306024820152604401610876565b8060005b818110156109905760008484838181106114155761141561348a565b905060200201359050611494817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454602080830191909152818301859052825180830384018152606090920190925280519101208190555050565b807f180e56184e3025975e8449fab79ff135cc5c3b3fe517a19bf8f111d69b33d2e27fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6040516114e691815260200190565b60405180910390a2506001016113f9565b6000808383604051602001611516929190918252602082015260400190565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0818403018152919052805160209091012054949350505050565b60007f6ffbd451000000000000000000000000000000000000000000000000000000007fffffffff000000000000000000000000000000000000000000000000000000008316016115a857506001919050565b61082882611f7d565b73ffffffffffffffffffffffffffffffffffffffff81163b611617576040517f0c76093700000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff82166004820152602401610876565b61161f813055565b60405173ffffffffffffffffffffffffffffffffffffffff821681527f310ba5f1d2ed074b51e2eccd052a47ae9ab7c6b800d1fca3db3999d6a592ca03906020015b60405180910390a150565b60008061167a8585856120be565b915091505b935093915050565b806116be576040517f4294d12700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6116e77fea7157fa25e3aa17d0ae2d5280fa4e24d421c61842aa85e45194e1145aa72bf8829055565b6040518181527f307ed6bd941ee9fc80f369c94af5fa11e25bab5102a6140191756c5474a30bfa9060200160405180910390a16108887f00000000000000000000000000000000000000000000000000000000000000006115b1565b60006108287f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd9454836114f7565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201524660228201527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b166042820152605681018290526000906076015b604051602081830303815290604052805190602001209050919050565b8060005b8181101561194b57368484838181106118135761181361348a565b9050602002810190611825919061372b565b90506040810135805a101561187a5782815a6040517f2bb3e3ba000000000000000000000000000000000000000000000000000000008152600481019390935260248301919091526044820152606401610876565b60006118896020840184613769565b156118c8576118c16118a16080850160608601612eed565b83156118ad57836118af565b5a5b6118bc60a0870187613784565b6120f2565b9050611903565b6119006118db6080850160608601612eed565b608085013584156118ec57846118ee565b5a5b6118fb60a0880188613784565b61210d565b90505b801561191f5760405188815260200160405180910390a0611940565b6119406119326040850160208601613769565b8961193b61212a565b612149565b5050506001016117f8565b5050505050565b606081901c6bffffffffffffffffffffffff821660006119718361103f565b90508181146119bd576040517f9b6514f4000000000000000000000000000000000000000000000000000000008152600481018490526024810183905260448101829052606401610876565b604080517f8d0bf1fd623d628c741362c1289948e57b3e2905218c676d3e69abee36d6ae2e60208083019190915281830186905282518083038401815260609092019092528051910120600183019081905560408051858152602081018390527f1f180c27086c7a39ea2a7b25239d1ab92348f07ca7bb59d1438fcf527568f881910160405180910390a15050505050565b6000808080611a6a87611a65876006818b6137e9565b612195565b6000908152873560f01c6020818152604080842084526002909a013560e01c908190529890912090999198509695509350505050565b6000808080611abb87611ab6876001818b6137e9565b611a4f565b935093509350935093509350935093565b6040517f190100000000000000000000000000000000000000000000000000000000000060208201526000602282018190527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003060601b16604283015260568201839052906076016117d7565b6000808080806004600188013560e81c82611b548383613842565b9050611b668b6105cc83868d8f6137e9565b939b5091995097509550935087871015611bbe57611b8681848b8d6137e9565b89896040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016108769493929190613855565b8092505b88831015611ca85760038301928a013560e81c9150611be18383613842565b90506000611c03611bf18861262b565b8c8c879086926105cc939291906137e9565b939c50919a5098509091505088881015611c5b57611c2382858c8e6137e9565b8a8a6040517fb006aba00000000000000000000000000000000000000000000000000000000081526004016108769493929190613855565b848110611c9e576040517f37daf62b0000000000000000000000000000000000000000000000000000000081526004810182905260248101869052604401610876565b9350915081611bc2565b505050939792965093509350565b8051606090600381901b60006005600483010467ffffffffffffffff811115611ce157611ce1613224565b6040519080825280601f01601f191660200182016040528015611d0b576020820181803683370190505b5090506000806000805b86811015611e1f57888181518110611d2f57611d2f61348a565b01602001516008948501949390931b60f89390931c92909217915b60058410611e17576040805180820190915260208082527f6162636465666768696a6b6c6d6e6f707172737475767778797a323334353637818301527ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffb90950194601f85871c16908110611dc057611dc061348a565b602001015160f81c60f81b858381518110611ddd57611ddd61348a565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350600190910190611d4a565b600101611d15565b508215611ec3576040518060400160405280602081526020017f6162636465666768696a6b6c6d6e6f707172737475767778797a3233343536378152508360050383901b601f1681518110611e7657611e7661348a565b602001015160f81c60f81b848281518110611e9357611e9361348a565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053505b50919695505050505050565b606081604051602001611ee2919061387c565b6040516020818303038152906040529050919050565b611f217f0eecac93ced8722d209199364cda3bc33da3bc3a23daef6be49ebd780511d033829055565b6040518181527f20d3ef1b5738a9f6d7beae515432206e7a8e2740ca6dcf46a952190ad01bcb5190602001611661565b60006108287f849e7bdc245db17e50b9f43086f1914d70eb4dab6dd89af4d541d53353ad97de836114f7565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fec6aba5000000000000000000000000000000000000000000000000000000000148061201057507fffffffff0000000000000000000000000000000000000000000000000000000082167f4e2312e000000000000000000000000000000000000000000000000000000000145b8061205c57507fffffffff0000000000000000000000000000000000000000000000000000000082167f150b7a0200000000000000000000000000000000000000000000000000000000145b806120a857507fffffffff0000000000000000000000000000000000000000000000000000000082167fc0ee0b8a00000000000000000000000000000000000000000000000000000000145b156120b557506001919050565b6108288261265f565b600080426120cb86611743565b11915081156120e757816120de866126bb565b9150915061167f565b61167a8585856126f6565b60006040518284823760008084838989f49695505050505050565b6000604051828482376000808483898b8af1979650505050505050565b60603d604051915060208201818101604052818352816000823e505090565b821561215757805160208201fd5b7f3dbd1590ea96dd3253a91f24e64e3a502e1225d602a5731357bc12643070ccd782826040516121889291906138c1565b60405180910390a1505050565b60008060005b8381101561262257600181019085013560f81c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff810161223c57601582019186013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff81169074ff0000000000000000000000000000000000000000168117856122225780612231565b60008681526020829052604090205b95505050505061219b565b806122d25760018201918681013560f81c9060430160006122688a61226384888c8e6137e9565b612734565b60ff841697909701969194508491905060a083901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff821617866122b757806122c6565b60008781526020829052604090205b9650505050505061219b565b600281036123fa576000808784013560f881901c9060581c73ffffffffffffffffffffffffffffffffffffffff16601586019550909250905060008885013560e81c600386018162ffffff16915080965081925050506000818601905061234b8b848c8c8a908692612346939291906137e9565b6129f7565b612393578a8361235d83898d8f6137e9565b6040517f9a94623200000000000000000000000000000000000000000000000000000000815260040161087694939291906138da565b60ff8416979097019694508460a084901b74ff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff841617876123de57806123ed565b60008881526020829052604090205b975050505050505061219b565b6003810361242d576020820191860135836124155780612424565b60008481526020829052604090205b9350505061219b565b60048103612479576003808301928781013560e81c919082010160008061245a8b611a6585898d8f6137e9565b6000988952602052604090972096909701965090935061219b92505050565b600681036125815760008287013560f81c60018401935060ff16905060008784013560f01c60028501945061ffff16905060008885013560e81c600386018162ffffff1691508096508192505050600081860190506000806124e78d8d8d8b908792611a65939291906137e9565b939850889390925090508482106124fd57988501985b604080517f53657175656e6365206e657374656420636f6e6669673a0a0000000000000000602080830191909152603882018490526058820188905260788083018a90528351808403909101815260989092019092528051910120896125635780612572565b60008a81526020829052604090205b9950505050505050505061219b565b600581036125ed5760208201918601358781036125bc577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff94505b60006125c782612ba4565b9050846125d457806125e3565b60008581526020829052604090205b945050505061219b565b6040517fb2505f7c00000000000000000000000000000000000000000000000000000000815260048101829052602401610876565b50935093915050565b7f8713a7c4465f6fbee2b6e9d6646d1d9f83fec929edfc4baf661f3c865bdd04d16000908152602082905260408120610828565b60007fe4a77bbc000000000000000000000000000000000000000000000000000000007fffffffff000000000000000000000000000000000000000000000000000000008316016126b257506001919050565b61082882612bdf565b604080517f7f25a23abc421d10864063e9a8ae5fd3fbd5116e156f148428b6a3a02ffd945460208201529081018290526000906060016117d7565b6000806000806000612709888888610e77565b50965091945092509050828210801590612727575061272781612bea565b9450505050935093915050565b6000604282146127745782826040517f2ee17a3d00000000000000000000000000000000000000000000000000000000815260040161087692919061391a565b600061278d61278460018561392e565b85013560f81c90565b60ff169050604084013560f81c843560208601357f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0811115612801578686826040517fad4aac7600000000000000000000000000000000000000000000000000000000815260040161087693929190613941565b8260ff16601b1415801561281957508260ff16601c14155b15612856578686846040517fe578897e00000000000000000000000000000000000000000000000000000000815260040161087693929190613965565b600184036128c3576040805160008152602081018083528a905260ff851691810191909152606081018390526080810182905260019060a0015b6020604051602081039080840390855afa1580156128b2573d6000803e3d6000fd5b50505060206040510351945061299b565b60028403612960576040517f19457468657265756d205369676e6564204d6573736167653a0a3332000000006020820152603c8101899052600190605c01604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181528282528051602091820120600084529083018083525260ff861690820152606081018490526080810183905260a001612890565b86868560016040517f9dfba852000000000000000000000000000000000000000000000000000000008152600401610876949392919061398c565b73ffffffffffffffffffffffffffffffffffffffff85166129ec5786866040517f6c1719d200000000000000000000000000000000000000000000000000000000815260040161087692919061391a565b505050509392505050565b6000808383612a0760018261392e565b818110612a1657612a1661348a565b919091013560f81c9150506001811480612a305750600281145b15612a75578473ffffffffffffffffffffffffffffffffffffffff16612a57878686612734565b73ffffffffffffffffffffffffffffffffffffffff16149150612b9b565b60038103612b605773ffffffffffffffffffffffffffffffffffffffff8516631626ba7e8786600087612aa960018261392e565b92612ab6939291906137e9565b6040518463ffffffff1660e01b8152600401612ad4939291906136cc565b602060405180830381865afa158015612af1573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612b1591906139b8565b7fffffffff00000000000000000000000000000000000000000000000000000000167f1626ba7e00000000000000000000000000000000000000000000000000000000149150612b9b565b83838260006040517f9dfba852000000000000000000000000000000000000000000000000000000008152600401610876949392919061398c565b50949350505050565b6040517f53657175656e636520737461746963206469676573743a0a00000000000000006020820152603881018290526000906058016117d7565b600061082882612bf5565b600061082882612c51565b60007ffda4dd44000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831601612c4857506001919050565b61082882612d7f565b6000612d53826040517fff0000000000000000000000000000000000000000000000000000000000000060208201527fffffffffffffffffffffffffffffffffffffffff0000000000000000000000007f000000000000000000000000000000000000000000000000000000000000000060601b166021820152603581018290527f000000000000000000000000000000000000000000000000000000000000000060558201526000903090607501604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0818403018152919052805160209091012073ffffffffffffffffffffffffffffffffffffffff161492915050565b15612d6057506001919050565b6000612d6b83611f51565b905080158015906109dc5750421092915050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167fac6a444e000000000000000000000000000000000000000000000000000000001480612e1257507fffffffff0000000000000000000000000000000000000000000000000000000082167f36e7817500000000000000000000000000000000000000000000000000000000145b15612e1f57506001919050565b7f01ffc9a7000000000000000000000000000000000000000000000000000000007fffffffff00000000000000000000000000000000000000000000000000000000831614610828565b8183823760009101908152919050565b7fffffffff000000000000000000000000000000000000000000000000000000008116811461088857600080fd5b600060208284031215612eb957600080fd5b81356109dc81612e79565b803573ffffffffffffffffffffffffffffffffffffffff81168114612ee857600080fd5b919050565b600060208284031215612eff57600080fd5b6109dc82612ec4565b60008083601f840112612f1a57600080fd5b50813567ffffffffffffffff811115612f3257600080fd5b6020830191508360208260051b8501011115612f4d57600080fd5b9250929050565b60008060208385031215612f6757600080fd5b823567ffffffffffffffff811115612f7e57600080fd5b612f8a85828601612f08565b90969095509350505050565b60008083601f840112612fa857600080fd5b50813567ffffffffffffffff811115612fc057600080fd5b602083019150836020828501011115612f4d57600080fd5b600080600080600060808688031215612ff057600080fd5b612ff986612ec4565b945061300760208701612ec4565b935060408601359250606086013567ffffffffffffffff81111561302a57600080fd5b61303688828901612f96565b969995985093965092949392505050565b60008060006040848603121561305c57600080fd5b83359250602084013567ffffffffffffffff81111561307a57600080fd5b61308686828701612f96565b9497909650939450505050565b600080600080604085870312156130a957600080fd5b843567ffffffffffffffff808211156130c157600080fd5b6130cd88838901612f96565b909650945060208701359150808211156130e657600080fd5b506130f387828801612f96565b95989497509550505050565b60006020828403121561311157600080fd5b5035919050565b6000806040838503121561312b57600080fd5b50508035926020909101359150565b60008060008060006060868803121561315257600080fd5b853567ffffffffffffffff8082111561316a57600080fd5b61317689838a01612f08565b909750955060208801359450604088013591508082111561319657600080fd5b5061303688828901612f96565b60005b838110156131be5781810151838201526020016131a6565b50506000910152565b600081518084526131df8160208601602086016131a3565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b6020815260006109dc60208301846131c7565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b60006020828403121561326557600080fd5b813567ffffffffffffffff8082111561327d57600080fd5b818401915084601f83011261329157600080fd5b8135818111156132a3576132a3613224565b604051601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0908116603f011681019083821181831017156132e9576132e9613224565b8160405282815287602084870101111561330257600080fd5b826020860160208301376000928101602001929092525095945050505050565b6000806040838503121561333557600080fd5b823561334081612e79565b915061334e60208401612ec4565b90509250929050565b60008060008060008060008060a0898b03121561337357600080fd5b61337c89612ec4565b975061338a60208a01612ec4565b9650604089013567ffffffffffffffff808211156133a757600080fd5b6133b38c838d01612f08565b909850965060608b01359150808211156133cc57600080fd5b6133d88c838d01612f08565b909650945060808b01359150808211156133f157600080fd5b506133fe8b828c01612f96565b999c989b5096995094979396929594505050565b60008060008060008060a0878903121561342b57600080fd5b61343487612ec4565b955061344260208801612ec4565b94506040870135935060608701359250608087013567ffffffffffffffff81111561346c57600080fd5b61347889828a01612f96565b979a9699509497509295939492505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b80358015158114612ee857600080fd5b8183528181602085013750600060208284010152600060207fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f840116840101905092915050565b81835260006020808501808196508560051b810191508460005b8781101561365457828403895281357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4188360301811261356b57600080fd5b870160c0613578826134b9565b151586526135878783016134b9565b15158688015260408281013590870152606073ffffffffffffffffffffffffffffffffffffffff6135b9828501612ec4565b16908701526080828101359087015260a080830135368490037fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe10181126135ff57600080fd5b90920187810192903567ffffffffffffffff81111561361d57600080fd5b80360384131561362c57600080fd5b828289015261363e83890182866134c9565b9c89019c9750505092860192505060010161352c565b5091979650505050505050565b60408152600560408201527f73656c663a0000000000000000000000000000000000000000000000000000006060820152608060208201526000610a4b608083018486613512565b8381526040602082015260006136c3604083018486613512565b95945050505050565b8381526040602082015260006136c36040830184866134c9565b7f697066733a2f2f0000000000000000000000000000000000000000000000000081526000825161371e8160078501602087016131a3565b9190910160070192915050565b600082357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff4183360301811261375f57600080fd5b9190910192915050565b60006020828403121561377b57600080fd5b6109dc826134b9565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe18436030181126137b957600080fd5b83018035915067ffffffffffffffff8211156137d457600080fd5b602001915036819003821315612f4d57600080fd5b600080858511156137f957600080fd5b8386111561380657600080fd5b5050820193919092039150565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b8082018082111561082857610828613813565b6060815260006138696060830186886134c9565b6020830194909452506040015292915050565b7f62000000000000000000000000000000000000000000000000000000000000008152600082516138b48160018501602087016131a3565b9190910160010192915050565b828152604060208201526000610a4b60408301846131c7565b84815273ffffffffffffffffffffffffffffffffffffffff841660208201526060604082015260006139106060830184866134c9565b9695505050505050565b602081526000610a4b6020830184866134c9565b8181038181111561082857610828613813565b6040815260006139556040830185876134c9565b9050826020830152949350505050565b6040815260006139796040830185876134c9565b905060ff83166020830152949350505050565b6060815260006139a06060830186886134c9565b60208301949094525090151560409091015292915050565b6000602082840312156139ca57600080fd5b81516109dc81612e7956fea2646970667358221220e6905b82ca2ea91a0c6cc4a371ce0a85eb88794fb3bc7734ed5414f524c47c4264736f6c63430008110033',
  linkReferences: {},
  deployedLinkReferences: {}
}
