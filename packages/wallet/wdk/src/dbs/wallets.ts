import { Generic } from './generic.js'
import { Wallet } from '../sequence/types/wallet.js'

const TABLE_NAME = 'wallets'

export class Wallets extends Generic<Wallet, 'address'> {
  constructor(dbName: string = 'sequence-manager') {
    super(dbName, TABLE_NAME, 'address', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
