// Direct exports for backward compatibility (old code expected these at top level)
export { isRelayer } from './relayer.js'
export { RpcRelayer } from './rpc-relayer/index.js'
export { ETHTxnStatus, FeeTokenType } from './rpc-relayer/relayer.gen.js'

// Type exports for backward compatibility
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

// Namespace exports (proto for backward compatibility, others for organization)
export * as proto from './rpc-relayer/relayer.gen.js'
export * as Relayer from './relayer.js'
export * as Preconditions from './preconditions/index.js'
export * as StandardRelayer from './standard/index.js'
export * as RelayerGen from './rpc-relayer/relayer.gen.js'
