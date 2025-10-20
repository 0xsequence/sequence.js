// Direct exports for convenience
export { RpcRelayer } from './rpc-relayer/index.js'
export { isRelayer } from './relayer.js'
export { ETHTxnStatus, FeeTokenType } from './rpc-relayer/relayer.gen.js'

// Type exports
export type {
  Relayer as RelayerInterface,
  FeeOption,
  FeeQuote,
  OperationStatus,
  OperationUnknownStatus,
  OperationQueuedStatus,
  OperationPendingStatus,
  OperationPendingPreconditionStatus,
  OperationConfirmedStatus,
  OperationFailedStatus,
} from './relayer.js'

export type {
  Relayer as Service,
  FeeToken,
  IntentPrecondition,
  MetaTxn,
  SendMetaTxnReturn,
  GetMetaTxnReceiptReturn,
} from './rpc-relayer/relayer.gen.js'

// Namespace exports for better organization
export * as proto from './rpc-relayer/relayer.gen.js'
export * as StandardRelayer from './standard/index.js'
export * as RelayerGen from './rpc-relayer/relayer.gen.js'
export * as Preconditions from './preconditions/index.js'

// Re-export Relayer namespace with cleaner API from relayer.js
export { Relayer } from './relayer.js'
