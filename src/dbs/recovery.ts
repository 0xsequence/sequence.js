import { Generic, Migration } from './generic.js'
import { QueuedRecoveryPayload } from '../sequence/types/recovery.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'queued-recovery-payloads'
export class Recovery extends Generic<QueuedRecoveryPayload, 'id'> {
  constructor(dbName: string = 'sequence-recovery') {
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
