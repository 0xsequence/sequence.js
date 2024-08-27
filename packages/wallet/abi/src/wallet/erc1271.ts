export const abi = [
  {
    type: 'function',
    name: 'isValidSignature',
    constant: true,
    inputs: [
      {
        type: 'bytes32'
      },
      {
        type: 'bytes'
      }
    ],
    outputs: [
      {
        type: 'bytes4'
      }
    ],
    payable: false,
    stateMutability: 'view'
  }
]

export const returns = {
  isValidSignatureBytes32: '0x1626ba7e'
}
