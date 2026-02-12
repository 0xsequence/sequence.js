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
  GetFeeTokensResponse,
  FeeToken,
  FeeOption,
  TransportMessage,
  EthAuthSettings,
  ETHAuthProof,
} from './types/index.js'
export { RequestActionType, TransportMode, MessageType } from './types/index.js'
export {
  FeeOptionError,
  TransactionError,
  AddExplicitSessionError,
  ConnectionError,
  InitializationError,
  SigningError,
  ModifyExplicitSessionError,
} from './utils/errors.js'
export {
  createExplicitSessionConfig,
  getExplorerUrl,
  getNetwork,
  getRelayerUrl,
  getRpcUrl,
  jsonReplacers,
  jsonRevivers,
  VALUE_FORWARDER_ADDRESS,
} from './utils/index.js'
export type { ExplicitSessionParams, NativeTokenSpending, SessionDuration } from './utils/index.js'
export type {
  SequenceStorage,
  ExplicitSessionData,
  ImplicitSessionData,
  SessionlessConnectionData,
  PendingRequestContext,
  PendingPayload,
} from './utils/storage.js'
export { WebStorage } from './utils/storage.js'

export {
  Attestation,
  Permission,
  Extensions,
  SessionConfig,
  Constants,
  Payload,
  Network,
} from '@0xsequence/wallet-primitives'
export type { ExplicitSessionConfig, ExplicitSession, ImplicitSession, Session } from '@0xsequence/wallet-core'
export { Signers, Wallet, Utils, Envelope, State } from '@0xsequence/wallet-core'
