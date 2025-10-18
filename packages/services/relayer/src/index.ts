// Namespace exports
export * as RpcRelayer from './rpc-relayer/index.js'
export * as Relayer from './relayer.js'
export * as StandardRelayer from './standard/index.js'
export * as RelayerGen from './rpc-relayer/relayer.gen.js'
export * as Preconditions from './preconditions/index.js'

// Direct exports for backward compatibility
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

export { ETHTxnStatus, FeeTokenType } from './rpc-relayer/relayer.gen.js'
export type {
  Relayer as Service,
  FeeToken,
  IntentPrecondition,
  MetaTxn,
  SendMetaTxnReturn,
  GetMetaTxnReceiptReturn,
} from './rpc-relayer/relayer.gen.js'
