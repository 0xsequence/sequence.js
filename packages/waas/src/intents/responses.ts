import {
  FeeOption,
  IntentDataSendTransaction,
  IntentResponseAccountFederated,
  IntentResponseAccountList,
  IntentResponseAuthInitiated,
  IntentResponseCode,
  IntentResponseGetSession,
  IntentResponseIdToken,
  IntentResponseValidationFinished,
  IntentResponseValidationStarted
} from '../clients/intent.gen'
import { WebrpcEndpointError, WebrpcError } from '../clients/authenticator.gen'

export type PayloadResponse<T> = {
  code: string
  data: T
}

export type ValidationRequiredResponse = {
  code: 'validationRequired'
  data: {
    sessionId: string
  }
}

type MetaTxnReceiptLog = {
  address: string
  topics: string[]
  data: string
}

type MetaTxnReceipt = {
  id: string
  status: string
  revertReason?: string | null
  index: number
  logs: MetaTxnReceiptLog[]
  receipts: MetaTxnReceipt[]
  txnReceipt: string
}

type SimulateResult = {
  executed: boolean
  succeeded: boolean
  result: string | null
  reason: string | null
  gasUsed: number
  gasLimit: number
}

export type SentTransactionResponse = {
  code: 'transactionReceipt'
  data: {
    txHash: string
    metaTxHash: string
    request: IntentDataSendTransaction
    receipt: MetaTxnReceipt
    nativeReceipt?: any | null
    simulations?: SimulateResult[]
  }
}

export type TransactionFailedResponse = {
  code: 'transactionFailed'
  data: {
    error: string
    request: IntentDataSendTransaction
    simulations: SimulateResult[]
  }
}

export type MaySentTransactionResponse = SentTransactionResponse | TransactionFailedResponse

export type FeeOptionsResponse = {
  code: 'feeOptions'
  data: {
    feeOptions: FeeOption[]
    feeQuote?: string
  }
}

export type OpenSessionResponse = {
  code: 'sessionOpened'
  data: {
    sessionId: string
    wallet: string
  }
}

export type CloseSessionResponse = {
  code: 'sessionClosed'
}

export type ListSessionsResponse = {
  code: 'listSessions'
  data: {
    sessions: any[]
  }
}

export type SignedMessageResponse = {
  code: 'signedMessage'
  data: {
    message: string
    signature: string
  }
}

export type SignedTypedDataResponse = {
  code: 'signedTypedData'
  data: {
    typedData: any
    signature: string
  }
}

export type SessionAuthProofResponse = {
  code: 'sessionAuthProof'
  data: {
    sessionId: string
    network: string
    wallet: string
    message: string
    signature: string
  }
}

export interface Response<Code, Data> {
  code: Code
  data: Data
}

export type InitiateAuthResponse = Response<IntentResponseCode.authInitiated, IntentResponseAuthInitiated>
export type ValidateSessionResponse = Response<IntentResponseCode.validationStarted, IntentResponseValidationStarted>
export type FinishValidateSessionResponse = Response<IntentResponseCode.validationFinished, IntentResponseValidationFinished>
export type GetSessionResponse = Response<IntentResponseCode.getSessionResponse, IntentResponseGetSession>
export type LinkAccountResponse = Response<IntentResponseCode.accountFederated, IntentResponseAccountFederated>
export type ListAccountsResponse = Response<IntentResponseCode.accountList, IntentResponseAccountList>
export type IdTokenResponse = Response<IntentResponseCode.idToken, IntentResponseIdToken>

export function isInitiateAuthResponse(receipt: any): receipt is InitiateAuthResponse {
  return (
    typeof receipt === 'object' &&
    receipt.code === IntentResponseCode.authInitiated &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string' &&
    typeof receipt.data.identityType === 'string' &&
    typeof receipt.data.expiresIn === 'number'
  )
}

export function isOpenSessionResponse(receipt: any): receipt is OpenSessionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'sessionOpened' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string' &&
    typeof receipt.data.wallet === 'string'
  )
}

export function isSentTransactionResponse(receipt: any): receipt is SentTransactionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'transactionReceipt' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.txHash === 'string' &&
    typeof receipt.data.receipt === 'object' &&
    typeof receipt.data.request === 'object'
  )
}

export function isTimedOutTransactionResponse(receipt: any): receipt is SentTransactionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'transactionReceipt' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.metaTxHash === 'string' &&
    !receipt.data.txHash &&
    typeof receipt.data.request === 'object'
  )
}

export function isFailedTransactionResponse(receipt: any): receipt is TransactionFailedResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'transactionFailed' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.request === 'object' &&
    Array.isArray(receipt.data.simulations) &&
    typeof receipt.data.error === 'string'
  )
}

export function isMaySentTransactionResponse(receipt: any): receipt is MaySentTransactionResponse {
  return isSentTransactionResponse(receipt) || isFailedTransactionResponse(receipt) || isTimedOutTransactionResponse(receipt)
}

export function isSignedMessageResponse(receipt: any): receipt is SignedMessageResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'signedMessage' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.message === 'string' &&
    typeof receipt.data.signature === 'string'
  )
}

export function isSignedTypedDataResponse(receipt: any): receipt is SignedTypedDataResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'signedTypedData' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.encodedTypedData === 'string' &&
    typeof receipt.data.signature === 'string'
  )
}

export function isSessionAuthProofResponse(receipt: any): receipt is SessionAuthProofResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'sessionAuthProof' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string' &&
    typeof receipt.data.network === 'string' &&
    typeof receipt.data.wallet === 'string' &&
    typeof receipt.data.message === 'string' &&
    typeof receipt.data.signature === 'string'
  )
}

export function isFeeOptionsResponse(receipt: any): receipt is FeeOptionsResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'feeOptions' &&
    typeof receipt.data === 'object' &&
    Array.isArray(receipt.data.feeOptions)
  )
}

export function isValidationRequiredResponse(receipt: any): receipt is ValidationRequiredResponse {
  return (
    typeof receipt === 'object' &&
    receipt.code === IntentResponseCode.validationRequired &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string'
  )
}

export function isValidateSessionResponse(receipt: any): receipt is ValidateSessionResponse {
  return typeof receipt === 'object' && receipt.code === IntentResponseCode.validationStarted && typeof receipt.data === 'object'
}

export function isFinishValidateSessionResponse(receipt: any): receipt is FinishValidateSessionResponse {
  return typeof receipt === 'object' && receipt.code === IntentResponseCode.validationFinished && typeof receipt.data === 'object'
}

export function isCloseSessionResponse(receipt: any): receipt is CloseSessionResponse {
  return typeof receipt === 'object' && typeof receipt.code === 'string' && receipt.code === 'sessionClosed'
}

export function isGetSessionResponse(receipt: any): receipt is GetSessionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'getSessionResponse' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.session === 'string' &&
    typeof receipt.data.wallet === 'string'
  )
}

export function isLinkAccountResponse(receipt: any): receipt is LinkAccountResponse {
  return (
    typeof receipt === 'object' &&
    receipt.code === IntentResponseCode.accountFederated &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.account === 'object'
  )
}

export function isListAccountsResponse(receipt: any): receipt is ListAccountsResponse {
  return typeof receipt === 'object' && receipt.code === IntentResponseCode.accountList && typeof receipt.data === 'object'
}
export function isIntentTimeError(error: any): error is WebrpcEndpointError {
  return !!(
    error instanceof WebrpcError &&
    (error.cause?.endsWith('intent is invalid: intent expired') ||
      error.cause?.endsWith('intent is invalid: intent issued in the future'))
  )
}

export function isGetIdTokenResponse(receipt: any): receipt is IdTokenResponse {
  return (
    typeof receipt === 'object' &&
    receipt.code === IntentResponseCode.idToken &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.idToken === 'string'
  )
}
