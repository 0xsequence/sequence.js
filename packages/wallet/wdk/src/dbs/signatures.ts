import { BaseSignatureRequest } from '../sequence/index.js'
import { Generic, Migration } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'envelopes'
export class Signatures extends Generic<BaseSignatureRequest, 'id'> {
  constructor(dbName: string = 'sequence-signature-requests') {
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
