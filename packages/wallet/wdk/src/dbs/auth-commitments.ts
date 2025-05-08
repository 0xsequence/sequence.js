import { Generic } from './generic.js'

const TABLE_NAME = 'auth-commitments'

export type AuthCommitment = {
  id: string
  kind: 'google-pkce' | 'apple'
  metadata: { [key: string]: string }
  verifier?: string
  challenge?: string
  target: string
  isSignUp: boolean
  signer?: string
}

export class AuthCommitments extends Generic<AuthCommitment, 'id'> {
  constructor(dbName: string = 'sequence-auth-commitments') {
    super(dbName, TABLE_NAME, 'id', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
