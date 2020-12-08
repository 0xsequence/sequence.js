export const MATIC_BRIDGE_ABI = [
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "userAddress",
        type: "address"
      }
    ],
    name: "depositEtherFor",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address"
      },
      {
        internalType: "address",
        name: "rootToken",
        type: "address"
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes"
      }
    ],
    name: "depositFor",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        internalType: "address",
        name: "address",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      }
    ],
    name: "depositERC20ForUser",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      }
    ],
    name: "withdraw",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "child",
        type: "address"
      }
    ],
    name: "childToRootToken",
    outputs: [
      {
        internalType: "address",
        name: "root",
        type: "address"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "root",
        type: "address"
      }
    ],
    name: "rootToChildToken",
    outputs: [
      {
        internalType: "address",
        name: "child",
        type: "address"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]"
      }
    ],
    name: "withdrawBatch",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  }
]
