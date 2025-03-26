import { Envelope, Relayer } from '@0xsequence/sequence-core'
import { Payload } from '@0xsequence/sequence-primitives'
import { Address } from 'ox'

export type TransactionRequest = {
  to: Address.Address
  value?: bigint
  data?: Uint8Array
  gasLimit?: bigint
}

export type RelayerOption = {
  id: string
  relayerId: string
  feeOption?: Relayer.FeeOption
  quote?: Relayer.FeeQuote
}

export type EnvelopeStatus = 'requested' | 'defined' | 'formed'

type TransactionBase = {
  id: string
  wallet: Address.Address
  requests: TransactionRequest[]
  source: string
  envelope: Envelope.Envelope<Payload.Calls>
}

export type TransactionRequested = TransactionBase & {
  status: 'requested'
}

export type TransactionDefined = TransactionBase & {
  status: 'defined'
}

export type TransactionFormed = TransactionBase & {
  relayerOption: RelayerOption
  status: 'formed'
}

export type Transaction = TransactionRequested | TransactionDefined | TransactionFormed
