import { Address } from '@0xsequence/wallet-primitives'
import { IDBPDatabase, IDBPTransaction } from 'idb'
import { Generic } from './generic.js'

const TABLE_NAME = 'auth-commitments'

export type AuthCommitment = {
  id: string
  kind: 'google-pkce' | 'apple'
  metadata: { [key: string]: string }
  verifier?: string
  challenge?: string
  target: Address.Address
  isSignUp: boolean
  signer?: string
}

export class AuthCommitments extends Generic<AuthCommitment, 'id'> {
  constructor(dbName: string = 'sequence-auth-commitments') {
    super(dbName, TABLE_NAME, 'id', [
      (
        db: IDBPDatabase<unknown>,
        _tx: IDBPTransaction<unknown, string[], 'versionchange'>,
        _event: IDBVersionChangeEvent,
      ) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
