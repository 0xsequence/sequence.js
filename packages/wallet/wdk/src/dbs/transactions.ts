import { Transaction } from '../sequence/types/transaction-request.js'
import { Generic, Migration } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'transactions'

export class Transactions extends Generic<Transaction, 'id'> {
  constructor(dbName: string = 'sequence-transactions') {
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
