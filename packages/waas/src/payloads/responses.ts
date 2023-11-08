import { TransactionsPacket } from "./packets/transactions"

export type PayloadResponse = {
  code: string
  data: any
}

export type ValidationRequiredResponse = {
  code: 'validationRequired'
  data: {
    sessionId: string
  }
}

type MetaTxnReceiptLog = {
  address: string;
  topics: string[];
  data: string;
}

type MetaTxnReceipt = {
  id: string;
  status: string;
  revertReason?: string | null;
  index: number;
  logs: MetaTxnReceiptLog[];
  receipts: MetaTxnReceipt[];
  txnReceipt: string;
}

type SimulateResult = {
  executed: boolean;
  succeeded: boolean;
  result: string | null;
  reason: string | null;
  gasUsed: number;
  gasLimit: number;
}

export type SentTransactionResponse = {
  code: 'transactionReceipt'
  data: {
    txHash: string,
    metaTxHash: string,
    request: TransactionsPacket,
    receipt: MetaTxnReceipt,
    nativeReceipt?: any | null,
    simulations?: SimulateResult[]
  }
}

export type TransactionFailedResponse = {
  code: 'transactionFailed',
  data: {
    error: string,
    request: TransactionsPacket,
    simulations: SimulateResult[]
  }
}

export type MaySentTransactionResponse = SentTransactionResponse | TransactionFailedResponse

export type OpenSessionResponse = {
  code: 'sessionOpened'
  data: {
    sessionId: string
    wallet: string
  }
}

export type SignedMessageResponse = {
  code: 'signedMessage'
  data: {
    message: string
    signature: string
  }
}

export type ValidateSessionResponse = {
  code: 'startedSessionValidation',
  data: {}
}

export type GetSessionResponse = {
  code: 'getSessionResponse'
  data: {
    session: string
    wallet: string
    validated: boolean
  }
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
  return isSentTransactionResponse(receipt) || isFailedTransactionResponse(receipt)
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

export function isValidationRequiredResponse(receipt: any): receipt is ValidationRequiredResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'validationRequired' &&
    typeof receipt.data === 'object' &&
    typeof receipt.data.sessionId === 'string'
  )
}

export function isValidateSessionResponse(receipt: any): receipt is ValidateSessionResponse {
  return (
    typeof receipt === 'object' &&
    typeof receipt.code === 'string' &&
    receipt.code === 'startedSessionValidation' &&
    typeof receipt.data === 'object'
  )
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
