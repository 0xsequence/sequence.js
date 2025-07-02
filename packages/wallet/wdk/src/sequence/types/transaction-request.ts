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
  speed?: 'slow' | 'standard' | 'fast'
}

export type LegacyRelayerOption = BaseRelayerOption & {
  kind: 'legacy'
  feeOption?: Relayer.FeeOption
  quote?: Relayer.FeeQuote
  name?: string
  icon?: string
}

export type ERC4337RelayerOption = BaseRelayerOption & {
  kind: 'erc4337'
  alternativePayload: Payload.Calls4337_07
}

export type RelayerOption = LegacyRelayerOption | ERC4337RelayerOption

export function isLegacyRelayerOption(relayerOption: RelayerOption): relayerOption is LegacyRelayerOption {
  return relayerOption.kind === 'legacy'
}

export function isERC4337RelayerOption(relayerOption: RelayerOption): relayerOption is ERC4337RelayerOption {
  return relayerOption.kind === 'erc4337'
}

type TransactionBase = {
  id: string
  wallet: Address.Address
  requests: TransactionRequest[]
  source: string
  envelope: Envelope.Envelope<Payload.Calls | Payload.Calls4337_07>
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
  relayedAt: number
  relayerId: string
  opStatus?: Relayer.OperationStatus
}

export type TransactionFinal = TransactionBase & {
  status: 'final'
  opHash: string
  relayedAt: number
  relayerId: string
  opStatus: Relayer.OperationStatus
}

export type Transaction =
  | TransactionRequested
  | TransactionDefined
  | TransactionFormed
  | TransactionRelayed
  | TransactionFinal
