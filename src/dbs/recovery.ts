import { Generic } from './generic.js'
import { QueuedRecoveryPayload } from '../sequence/types/recovery.js'

const TABLE_NAME = 'queued-recovery-payloads'
export class Recovery extends Generic<QueuedRecoveryPayload, 'id'> {
  constructor(dbName: string = 'sequence-recovery') {
    super(dbName, TABLE_NAME, 'id', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
