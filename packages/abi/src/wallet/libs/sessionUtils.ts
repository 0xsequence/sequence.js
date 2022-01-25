export const abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_space",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_oldNonce",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_newNonce",
        type: "uint256"
      }
    ],
    name: "GapNonceChange",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_space",
        type: "uint256"
      }
    ],
    name: "ResetNonce",
    type: "event"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_nonce",
        type: "uint256"
      }
    ],
    name: "requireSessionNonce",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
]