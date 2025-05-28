import { Generic, Migration } from './generic.js'
import { Wallet } from '../sequence/types/wallet.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'wallets'

export class Wallets extends Generic<Wallet, 'address'> {
  constructor(dbName: string = 'sequence-manager') {
    super(dbName, TABLE_NAME, 'address', [
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
