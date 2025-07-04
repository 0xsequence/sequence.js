import { Envelope } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Handler } from '../handlers/handler.js'

export type ActionToPayload = {
  [Actions.Logout]: Payload.ConfigUpdate
  [Actions.Login]: Payload.ConfigUpdate
  [Actions.SendTransaction]: Payload.Calls | Payload.Calls4337_07
  [Actions.SignMessage]: Payload.Message
  [Actions.SessionUpdate]: Payload.ConfigUpdate
  [Actions.Recovery]: Payload.Recovery<Payload.Calls>
  [Actions.AddRecoverySigner]: Payload.ConfigUpdate
  [Actions.RemoveRecoverySigner]: Payload.ConfigUpdate
  [Actions.SessionImplicitAuthorize]: Payload.SessionImplicitAuthorize
}

export const Actions = {
  Logout: 'logout',
  Login: 'login',
  SendTransaction: 'send-transaction',
  SignMessage: 'sign-message',
  SessionUpdate: 'session-update',
  Recovery: 'recovery',
  AddRecoverySigner: 'add-recovery-signer',
  RemoveRecoverySigner: 'remove-recovery-signer',
  SessionImplicitAuthorize: 'session-implicit-authorize',
} as const

export type Action = (typeof Actions)[keyof typeof Actions]
export type BaseSignatureRequest<A extends Action = Action> =
  | {
      id: string
      wallet: Address.Address
      origin: string
      createdAt: string

      action: A
      envelope: Envelope.Signed<ActionToPayload[A]>
      status: 'pending'
    }
  | {
      id: string
      wallet: Address.Address
      origin: string
      createdAt: string

      action: A
      envelope: Envelope.Signed<ActionToPayload[A]>
      status: 'cancelled' | 'completed'
      scheduledPruning: number
    }

export type SignerBase = {
  address: Address.Address
  imageHash?: Hex.Hex
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
