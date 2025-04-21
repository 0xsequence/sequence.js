import { Address } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { Envelope } from '@0xsequence/wallet-core'
import { Generic } from './generic.js'

export type ActionToPayload = {
  [Actions.Logout]: Payload.ConfigUpdate
  [Actions.Login]: Payload.ConfigUpdate
  [Actions.SendTransaction]: Payload.Calls
  [Actions.SessionUpdate]: Payload.ConfigUpdate
}

export const Actions = {
  Logout: 'logout',
  Login: 'login',
  SendTransaction: 'send-transaction',
  SessionUpdate: 'session-update',
} as const

export type Action = (typeof Actions)[keyof typeof Actions]

export type SignatureRequest<A extends Action = Action> = {
  id: string
  wallet: Address.Address
  origin: string
  createdAt: string

  action: A
  envelope: Envelope.Signed<ActionToPayload[A]>
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
