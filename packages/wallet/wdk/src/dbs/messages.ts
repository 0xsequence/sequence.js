import { Message } from '../sequence/types/message-request.js'
import { Generic } from './generic.js'

const TABLE_NAME = 'messages'

export class Messages extends Generic<Message, 'id'> {
  constructor(dbName: string = 'sequence-messages') {
    super(dbName, TABLE_NAME, 'id', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
