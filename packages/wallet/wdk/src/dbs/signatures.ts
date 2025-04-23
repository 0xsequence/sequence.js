import { BaseSignatureRequest } from '../sequence/index.js'
import { Generic } from './generic.js'

const TABLE_NAME = 'envelopes'
export class Signatures extends Generic<BaseSignatureRequest, 'id'> {
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
