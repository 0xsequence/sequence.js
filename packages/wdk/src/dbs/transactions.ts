import { Address } from 'ox'
import { Payload } from '@0xsequence/sequence-primitives'
import { Relayer, Envelope } from '@0xsequence/sequence-core'
import { Generic } from '.'

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

export type TransactionRequestedRow = TransactionBase & {
  status: 'requested'
}

export type TransactionDefinedRow = TransactionBase & {
  status: 'defined'
}

export type TransactionFormedRow = TransactionBase & {
  relayerOption: RelayerOption
  status: 'formed'
}

export type TransactionRow = TransactionRequestedRow | TransactionDefinedRow | TransactionFormedRow

export class Transactions extends Generic<TransactionRow, 'id'> {
  constructor(dbName: string = 'sequence-transactions') {
    super(dbName, 'transactions', 'id')
  }
}
