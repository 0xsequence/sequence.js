import { Message } from '../sequence/types/message-request.js'
import { Generic, Migration } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'messages'

export class Messages extends Generic<Message, 'id'> {
  constructor(dbName: string = 'sequence-messages') {
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
