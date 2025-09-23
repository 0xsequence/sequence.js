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
  SessionResponse,
  AddExplicitSessionPayload,
  CreateNewSessionPayload,
  CreateNewSessionResponse,
  SignTypedDataPayload,
  ModifyExplicitSessionPayload,
  DappClientWalletActionEventListener,
  DappClientExplicitSessionEventListener,
  TransactionRequest,
  SendWalletTransactionPayload,
  SendWalletTransactionResponse,
  WalletActionResponse,
} from './types/index.js'
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

export { Attestation, Permission, Extensions, SessionConfig, Constants, Payload } from '@0xsequence/wallet-primitives'
export type { ExplicitSessionConfig, ExplicitSession, ImplicitSession, Session } from '@0xsequence/wallet-core'
export { Signers, Wallet, Utils, Relayer, Envelope, State } from '@0xsequence/wallet-core'
