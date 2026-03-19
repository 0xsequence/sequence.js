import { Generic } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'auth-commitments'

export type CommitAuthArgs =
  | { type: 'auth'; state?: string }
  | { type: 'reauth'; state: string; signer: string }
  | { type: 'add-signer'; wallet: string; state?: string }

export type AuthCommitment = {
  id: string
  kind: 'google-pkce' | 'apple' | `custom-${string}`
  metadata: { [key: string]: string }
  verifier?: string
  challenge?: string
  target: string
} & ({ type: 'auth' } | { type: 'reauth'; signer: string } | { type: 'add-signer'; wallet: string })

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
