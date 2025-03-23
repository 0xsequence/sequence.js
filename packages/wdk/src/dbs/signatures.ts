import { Address } from 'ox'
import { Payload } from '@0xsequence/sequence-primitives'
import { Envelope } from '@0xsequence/sequence-core'
import { Generic } from './generic'

export type SignatureRequest = {
  id: string
  wallet: Address.Address
  envelope: Envelope.Signed<Payload.Payload>
  origin: string
  reason: string
  status: 'pending' | 'done' | 'rejected'
}

const TABLE_NAME = 'envelopes'

export class Signatures extends Generic<SignatureRequest, 'id'> {
  constructor(dbName: string = 'sequence-signature-requests') {
    super(dbName, TABLE_NAME, 'id', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
