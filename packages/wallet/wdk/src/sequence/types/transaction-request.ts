import { Envelope, Relayer } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export type TransactionRequest = {
  to: Address.Address
  value?: bigint
  data?: Hex.Hex
  gasLimit?: bigint
}

export type BaseRelayerOption = {
  id: string
  relayerId: string
}

export type LegacyRelayerOption = BaseRelayerOption & {
  kind: 'legacy'
  feeOption?: Relayer.FeeOption
  quote?: Relayer.FeeQuote
}

export type ERC4337RelayerOption = BaseRelayerOption & {
  kind: 'erc4337'
}

export type RelayerOption = LegacyRelayerOption | ERC4337RelayerOption

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
}

export type Transaction = TransactionRequested | TransactionDefined | TransactionFormed | TransactionRelayed
