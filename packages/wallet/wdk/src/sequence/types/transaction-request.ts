import { Envelope, Relayer } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export type TransactionRequest = {
  to: Address.Address
  value?: bigint
  data?: Hex.Hex
  gasLimit?: bigint
}

export type RelayerOption = {
  id: string
  relayerId: string
  feeOption?: Relayer.FeeOption
  quote?: Relayer.FeeQuote
  name?: string
  icon?: string
}

type TransactionBase = {
  id: string
  wallet: Address.Address
  requests: TransactionRequest[]
  source: string
  envelope: Envelope.Envelope<Payload.Calls>
  timestamp: number
}

export type TransactionRequested = TransactionBase & {
  status: 'requested'
}

export type TransactionDefined = TransactionBase & {
  status: 'defined'
  relayerOptions: RelayerOption[]
}

export type TransactionFormed = TransactionBase & {
  relayerOption: RelayerOption
  status: 'formed'
  signatureId: string
}

export type TransactionRelayed = TransactionBase & {
  status: 'relayed'
  opHash: string
  opStatus?: Relayer.OperationStatus
}

export type Transaction = TransactionRequested | TransactionDefined | TransactionFormed | TransactionRelayed
