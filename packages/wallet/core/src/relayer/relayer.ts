import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hex } from 'ox'

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

export type OperationUknownStatus = {
  status: 'unknown'
}

export type OperationPendingStatus = {
  status: 'pending'
}

export type OperationConfirmedStatus = {
  status: 'confirmed'
  transactionHash: Hex.Hex
}

export type OperationFailedStatus = {
  status: 'failed'
  reason: string
}

export type OperationStatus =
  | OperationUknownStatus
  | OperationPendingStatus
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
}
