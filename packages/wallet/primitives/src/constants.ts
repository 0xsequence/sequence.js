import { Abi, Address, Hex } from 'ox'

export const DEFAULT_CREATION_CODE: Hex.Hex =
  '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3'

export const DefaultFactory: Address.Address = '0xe068ec288d8b4Aaf7F7FC028Ce0797a7a353EF2d'
export const DefaultStage1: Address.Address = '0x302608CcdCc540761A0ec89C9d8Fa195dc8049C6'
export const DefaultStage2: Address.Address = '0x80cF586AFaCb3Cae77d84aFEBcC92382eDCF3A02'
export const DefaultGuest: Address.Address = '0x75e19AA6241D84C290658131857824B4eeF10dfF'
export const DefaultSessionManager: Address.Address = '0x81Fa4b986f958CB02A3A6c10aa38056dCd701941'

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

// SessionManager
export const INCREMENT_USAGE_LIMIT = Abi.from([
  {
    type: 'function',
    name: 'incrementUsageLimit',
    inputs: [
      {
        name: 'limits',
        type: 'tuple[]',
        internalType: 'struct UsageLimit[]',
        components: [
          { name: 'usageHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'usageAmount', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
])[0]
export const GET_LIMIT_USAGE = Abi.from([
  'function getLimitUsage(address wallet, bytes32 usageHash) public view returns (uint256)',
])[0]
