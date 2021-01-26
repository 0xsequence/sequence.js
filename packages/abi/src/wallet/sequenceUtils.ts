export const abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_factory",
        type: "address"
      },
      {
        internalType: "address",
        name: "_mainModule",
        type: "address"
      }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    anonymous: false,
    inputs: [
      {
        "indexed": true,
        internalType: "address",
        name: "_wallet",
        type: "address"
      },
      {
        "indexed": true,
        internalType: "bytes32",
        name: "_imageHash",
        type: "bytes32"
      },
      {
        "indexed": false,
        internalType: "uint256",
        name: "_threshold",
        type: "uint256"
      },
      {
        "indexed": false,
        internalType: "bytes",
        name: "_signers",
        type: "bytes"
      }
    ],
    name: "RequiredConfig",
    type: "event"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_addr",
        type: "address"
      }
    ],
    name: "callBalanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callBlockNumber",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_i",
        type: "uint256"
      }
    ],
    name: "callBlockhash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callChainId",
    outputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_addr",
        type: "address"
      }
    ],
    name: "callCode",
    outputs: [
      {
        internalType: "bytes",
        name: "code",
        type: "bytes"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_addr",
        type: "address"
      }
    ],
    name: "callCodeHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "codeHash",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_addr",
        type: "address"
      }
    ],
    name: "callCodeSize",
    outputs: [
      {
        internalType: "uint256",
        name: "size",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callCoinbase",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callDifficulty",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callGasLeft",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callGasLimit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callGasPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callOrigin",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "callTimestamp",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    name: "imageHashBlockHeight",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "initialImageHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "bool",
            name: "delegateCall",
            type: "bool"
          },
          {
            internalType: "bool",
            name: "revertOnError",
            type: "bool"
          },
          {
            internalType: "uint256",
            name: "gasLimit",
            type: "uint256"
          },
          {
            internalType: "address",
            name: "target",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        internalType: "struct IModuleCalls.Transaction[]",
        name: "_txs",
        type: "tuple[]"
      }
    ],
    name: "multiCall",
    outputs: [
      {
        internalType: "bool[]",
        name: "_successes",
        type: "bool[]"
      },
      {
        internalType: "bytes[]",
        name: "_results",
        type: "bytes[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_wallet",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_threshold",
        type: "uint256"
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "weight",
            type: "uint256"
          },
          {
            internalType: "address",
            name: "signer",
            type: "address"
          }
        ],
        internalType: "struct RequireUtils.Member[]",
        name: "_members",
        type: "tuple[]"
      }
    ],
    name: "requireAndIndexConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_wallet",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_threshold",
        type: "uint256"
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "weight",
            type: "uint256"
          },
          {
            internalType: "address",
            name: "signer",
            type: "address"
          }
        ],
        internalType: "struct RequireUtils.Member[]",
        name: "_members",
        type: "tuple[]"
      }
    ],
    name: "requireConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_wallet",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_nonce",
        type: "uint256"
      }
    ],
    name: "requireMinNonce",
    outputs: [],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_expiration",
        type: "uint256"
      }
    ],
    name: "requireNonExpired",
    outputs: [],
    stateMutability: "view",
    type: "function"
  }
]