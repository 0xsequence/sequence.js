import { Abi, Address, Hex } from 'ox'

export const FACTORY: Address.Address = '0xTODO'
export const MAIN_MODULE: Address.Address = '0xTODO'

export const CREATION_CODE: Hex.Hex = '0xTODO'

// ERC1271
export const IS_VALID_SIGNATURE = Abi.from([
  'function isValidSignature(bytes32 _hash, bytes memory _signature) public view returns (bytes4 magicValue)',
])[0]

// Factory
export const DEPLOY = Abi.from([
  'function deploy(address _mainModule, bytes32 _salt) public payable returns (address _contract)',
])[0]

// MainModule
export const IMAGE_HASH = Abi.from(['function imageHash() external view returns (bytes32)'])[0]

// Sapient
export const IS_VALID_SAPIENT_SIGNATURE = Abi.from([
  'function isValidSapientSignature(Payload.Decoded calldata _payload, bytes calldata _signature) external view returns (bytes32)',
  'struct Payload.Decoded { uint8 kind; bool noChainId; Call[] calls; uint256 space; uint256 nonce; bytes message; bytes32 imageHash; bytes32 digest; address[] parentWallets; }',
  'struct Call { address to; uint256 value; bytes data; uint256 gasLimit; bool delegateCall; bool onlyFallback; uint256 behaviorOnError; }',
])[0]

// SapientCompact
export const IS_VALID_SAPIENT_SIGNATURE_COMPACT = Abi.from([
  'function isValidSapientSignatureCompact(bytes32 _digest, bytes calldata _signature) external view returns (bytes32)',
])[0]
