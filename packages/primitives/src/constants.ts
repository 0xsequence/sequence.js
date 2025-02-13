import { Abi, Address, Hex } from 'ox'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  creationCode: Hex.Hex
}

export const DevContext1: Context = {
  factory: '0xFaA5c0b14d1bED5C888Ca655B9a8A5911F78eF4A',
  stage1: '0x66155b899d93e255d42a85eb921ead9f2e964ef1',
  creationCode: '0xe893cfb06ade2c5b81d209aaf650041816c1ac9d6fd6f328dc874b25db149637',
}

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
  'function isValidSapientSignature((uint8 kind,bool noChainId,(address to,uint256 value,bytes data,uint256 gasLimit,bool delegateCall,bool onlyFallback,uint256 behaviorOnError)[] calls,uint256 space,uint256 nonce,bytes message,bytes32 imageHash,bytes32 digest,address[] parentWallets) calldata _payload, bytes calldata _signature) external view returns (bytes32)',
])[0]

// SapientCompact
export const IS_VALID_SAPIENT_SIGNATURE_COMPACT = Abi.from([
  'function isValidSapientSignatureCompact(bytes32 _digest, bytes calldata _signature) external view returns (bytes32)',
])[0]
