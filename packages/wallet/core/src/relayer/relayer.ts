import { Payload, Precondition } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { FeeToken, GetMetaTxnReceiptReturn } from './standard/rpc/index.js'

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

export interface Relayer {
  kind: 'relayer'

  type: string
  id: string

  isAvailable(wallet: Address.Address, chainId: number): Promise<boolean>

  feeTokens(): Promise<{ isFeeRequired: boolean; tokens?: FeeToken[]; paymentAddress?: Address.Address }>

  feeOptions(
    wallet: Address.Address,
    chainId: number,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }>

  relay(to: Address.Address, data: Hex.Hex, chainId: number, quote?: FeeQuote): Promise<{ opHash: Hex.Hex }>

  status(opHash: Hex.Hex, chainId: number): Promise<OperationStatus>

  checkPrecondition(precondition: Precondition.Precondition): Promise<boolean>
}

export function isRelayer(relayer: any): relayer is Relayer {
  return (
    'isAvailable' in relayer &&
    'feeOptions' in relayer &&
    'relay' in relayer &&
    'status' in relayer &&
    'checkPrecondition' in relayer
  )
}
