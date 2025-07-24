import { Envelope } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'

export type MessageRequest = string | Hex.Hex | Payload.TypedDataToSign

type MessageBase = {
  id: string
  wallet: Address.Address
  message: MessageRequest
  source: string
  signatureId: string
}

export type MessageRequested = MessageBase & {
  status: 'requested'
  envelope: Envelope.Envelope<Payload.Message>
}

export type MessageSigned = MessageBase & {
  status: 'signed'
  envelope: Envelope.Signed<Payload.Message>
  messageSignature: Hex.Hex
}

export type Message = MessageRequested | MessageSigned
