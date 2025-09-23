export { DappClient } from './DappClient.js'
export type { DappClientEventListener } from './DappClient.js'
export type {
  LoginMethod,
  GuardConfig,
  Transaction,
  SignatureResponse,
  SequenceSessionStorage,
  RandomPrivateKeyFn,
  SignMessagePayload,
  SessionResponsePayload,
  AddExplicitSessionPayload,
  CreateNewSessionPayload,
  SignTypedDataPayload,
  ConnectSuccessResponsePayload,
  ModifyExplicitSessionPayload,
  DappClientWalletActionEventListener,
  DappClientExplicitSessionEventListener,
  TransactionRequest,
  SendWalletTransactionPayload,
  SendWalletTransactionResponse,
  WalletActionResponse,
} from './types/index.js'
export type { ExplicitSessionConfig, ExplicitSession, ImplicitSession, Session } from '@0xsequence/wallet-core'
export { RequestActionType, TransportMode } from './types/index.js'
export {
  FeeOptionError,
  TransactionError,
  AddExplicitSessionError,
  ConnectionError,
  InitializationError,
  SigningError,
  ModifyExplicitSessionError,
} from './utils/errors.js'
export { getExplorerUrl, jsonReplacers, jsonRevivers } from './utils/index.js'
export type {
  SequenceStorage,
  ExplicitSessionData,
  ImplicitSessionData,
  PendingRequestContext,
  PendingPayload,
} from './utils/storage.js'
export { WebStorage } from './utils/storage.js'

export { Permission, Extensions, SessionConfig } from '@0xsequence/wallet-primitives'
export { Signers, Wallet, Utils, Relayer } from '@0xsequence/wallet-core'
