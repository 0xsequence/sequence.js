import { Abi, Address, Hex } from 'ox'

export const DEFAULT_CREATION_CODE: Hex.Hex =
  '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  creationCode: Hex.Hex
}

export const DevContext1: Context = {
  factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447',
  stage1: '0x9C4953F499f7e63434d76E0735D4707473d92311',
  creationCode: DEFAULT_CREATION_CODE,
}

export const DefaultGuest: Address.Address = '0x294e900a45018d71ffc6ee1f18a205e199f551a1'

// ERC1271
export const IS_VALID_SIGNATURE = Abi.from([
  'function isValidSignature(bytes32 _hash, bytes memory _signature) public view returns (bytes4 magicValue)',
])[0]

// Factory
export const DEPLOY = Abi.from([
  'function deploy(address _mainModule, bytes32 _salt) public payable returns (address _contract)',
])[0]

// Stage1Module
export const GET_IMPLEMENTATION = Abi.from(['function getImplementation() external view returns (address)'])[0]

// Stage2Module
export const IMAGE_HASH = Abi.from(['function imageHash() external view returns (bytes32)'])[0]
export const READ_NONCE = Abi.from(['function readNonce(uint256 _space) public view returns (uint256)'])[0]
export const EXECUTE = Abi.from(['function execute(bytes calldata _payload, bytes calldata _signature) external'])[0]

// Sapient
export const IS_VALID_SAPIENT_SIGNATURE = Abi.from([
  'function isValidSapientSignature((uint8 kind,bool noChainId,(address to,uint256 value,bytes data,uint256 gasLimit,bool delegateCall,bool onlyFallback,uint256 behaviorOnError)[] calls,uint256 space,uint256 nonce,bytes message,bytes32 imageHash,bytes32 digest,address[] parentWallets) calldata _payload, bytes calldata _signature) external view returns (bytes32)',
])[0]

// SapientCompact
export const IS_VALID_SAPIENT_SIGNATURE_COMPACT = Abi.from([
  'function isValidSapientSignatureCompact(bytes32 _digest, bytes calldata _signature) external view returns (bytes32)',
])[0]
