import { Envelope } from '@0xsequence/sequence-core'
import { Payload } from '@0xsequence/sequence-primitives'
import { Address, Bytes } from 'ox'
import { Handler } from '../handlers'

export type ActionToPayload = {
  [Actions.Logout]: Payload.ConfigUpdate
  [Actions.Login]: Payload.ConfigUpdate
  [Actions.SendTransaction]: Payload.Calls
}

export const Actions = {
  Logout: 'logout',
  Login: 'login',
  SendTransaction: 'send-transaction',
} as const

export type Action = (typeof Actions)[keyof typeof Actions]

export type BaseSignatureRequest<A extends Action = Action> = {
  id: string
  wallet: Address.Address
  origin: string
  createdAt: string

  action: A
  envelope: Envelope.Signed<ActionToPayload[A]>
}

export type SignerBase = {
  address: Address.Address
  imageHash?: Bytes.Bytes
}

export type SignerSigned = SignerBase & {
  handler?: Handler
  status: 'signed'
}

export type SignerUnavailable = SignerBase & {
  handler?: Handler
  reason: string
  status: 'unavailable'
}

export type SignerReady = SignerBase & {
  handler: Handler
  status: 'ready'
  handle: () => Promise<boolean>
}

export type SignerActionable = SignerBase & {
  handler: Handler
  status: 'actionable'
  message: string // TODO: Localization?
  handle: () => Promise<boolean>
}

export type Signer = SignerSigned | SignerUnavailable | SignerReady | SignerActionable

export type SignatureRequest = BaseSignatureRequest & {
  weight: bigint
  threshold: bigint
  signers: Signer[]
}
