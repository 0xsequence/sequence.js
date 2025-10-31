import { Hex } from 'ox'
import type { FeeToken, GetMetaTxnReceiptReturn } from './rpc-relayer/relayer.gen.js'

export * from './rpc-relayer/index.js'
export * from './standard/index.js'
export * from './relayer.js'
export type { FeeToken } from './rpc-relayer/relayer.gen.js'

export interface FeeOption {
  token: FeeToken
  to: string
  value: string
  gasLimit: number
}

export interface FeeQuote {
  _tag: 'FeeQuote'
  _quote: unknown
}

export type OperationUnknownStatus = {
  status: 'unknown'
  reason?: string
}

export type OperationQueuedStatus = {
  status: 'queued'
  reason?: string
}

export type OperationPendingStatus = {
  status: 'pending'
  reason?: string
}

export type OperationPendingPreconditionStatus = {
  status: 'pending-precondition'
  reason?: string
}

export type OperationConfirmedStatus = {
  status: 'confirmed'
  transactionHash: Hex.Hex
  data?: GetMetaTxnReceiptReturn
}

export type OperationFailedStatus = {
  status: 'failed'
  transactionHash?: Hex.Hex
  reason: string
  data?: GetMetaTxnReceiptReturn
}

export type OperationStatus =
  | OperationUnknownStatus
  | OperationQueuedStatus
  | OperationPendingStatus
  | OperationPendingPreconditionStatus
  | OperationConfirmedStatus
  | OperationFailedStatus
