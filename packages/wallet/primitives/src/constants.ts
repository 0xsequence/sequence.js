import { Abi, Address } from 'ox'

export const ZeroAddress: Address.Address = '0x0000000000000000000000000000000000000000'

export const DefaultGuestAddress: Address.Address = '0xf3c7175460BeD3340A1c4dc700fD6C8Cd3F56250'

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

// ERC4337
export const EXECUTE_USER_OP = Abi.from(['function executeUserOp(bytes calldata _userOp) external'])[0]
export const READ_NONCE_4337 = Abi.from([
  'function getNonce(address _account, uint192 _key) public view returns (uint256)',
])[0]
export const READ_ENTRYPOINT = Abi.from(['function entrypoint() public view returns (address)'])[0]

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
