import { Abi, Address, Hex } from 'ox'

export const DEFAULT_CREATION_CODE: Hex.Hex =
  '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3'

export const DefaultFactory: Address.Address = '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447'
export const DefaultStage1: Address.Address = '0x53bA242E7C2501839DF2972c75075dc693176Cd0'
export const DefaultStage2: Address.Address = '0xa29874c88b8Fd557e42219B04b0CeC693e1712f5'
export const DefaultGuest: Address.Address = '0x9cbB2a4BD361248f5020465E1Cc1Db877F9387D8'
export const DefaultSessionManager: Address.Address = '0xDfB66323C6485eE10d81A0fa60BaEbbbA732Ba0a'

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
export const UPDATE_IMAGE_HASH = Abi.from(['function updateImageHash(bytes32 _imageHash) external'])[0]

// Sapient
export const RECOVER_SAPIENT_SIGNATURE = Abi.from([
  'function recoverSapientSignature((uint8 kind,bool noChainId,(address to,uint256 value,bytes data,uint256 gasLimit,bool delegateCall,bool onlyFallback,uint256 behaviorOnError)[] calls,uint256 space,uint256 nonce,bytes message,bytes32 imageHash,bytes32 digest,address[] parentWallets) calldata _payload, bytes calldata _signature) external view returns (bytes32)',
])[0]

// SapientCompact
export const RECOVER_SAPIENT_SIGNATURE_COMPACT = Abi.from([
  'function recoverSapientSignatureCompact(bytes32 _digest, bytes calldata _signature) external view returns (bytes32)',
])[0]
