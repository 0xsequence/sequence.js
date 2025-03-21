import { Address } from 'ox'
import { Payload } from '@0xsequence/sequence-primitives'
import { Envelope } from '@0xsequence/sequence-core'
import { Generic } from '.'

export type SignatureRequest = {
  id: string
  wallet: Address.Address
  envelope: Envelope.Signed<Payload.Payload>
  origin: string
  reason: string
  status: 'pending' | 'done' | 'rejected'
}

export class Signatures extends Generic<SignatureRequest, 'id'> {
  constructor(dbName: string = 'sequence-signature-requests') {
    super(dbName, 'envelopes', 'id')
  }
}
