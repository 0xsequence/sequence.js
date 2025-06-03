import { Payload, Precondition } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { GetMetaTxnReceiptReturn } from './rpc/index.js'

export interface FeeOption {
  token: Address.Address
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
}

export type OperationQueuedStatus = {
  status: 'queued'
}

export type OperationPendingStatus = {
  status: 'pending'
}

export type OperationPendingPreconditionStatus = {
  status: 'pending-precondition'
}

export type OperationConfirmedStatus = {
  status: 'confirmed'
  transactionHash: Hex.Hex
  receipt?: GetMetaTxnReceiptReturn
}

export type OperationFailedStatus = {
  status: 'failed'
  reason: string
  receipt?: GetMetaTxnReceiptReturn
}

export type OperationStatus =
  | OperationUnknownStatus
  | OperationQueuedStatus
  | OperationPendingStatus
  | OperationPendingPreconditionStatus
  | OperationConfirmedStatus
  | OperationFailedStatus

export interface Relayer {
  id: string

  feeOptions(
    wallet: Address.Address,
    chainId: bigint,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  relay(to: Address.Address, data: Hex.Hex, chainId: bigint, quote?: FeeQuote): Promise<{ opHash: Hex.Hex }>

  status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus>

  checkPrecondition(precondition: Precondition.Precondition): Promise<boolean>
}
