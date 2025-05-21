import { Transaction } from '../sequence/types/transaction-request.js'
import { Generic } from './generic.js'

const TABLE_NAME = 'transactions'

export class Transactions extends Generic<Transaction, 'id'> {
  constructor(dbName: string = 'sequence-transactions') {
    super(dbName, TABLE_NAME, 'id', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
