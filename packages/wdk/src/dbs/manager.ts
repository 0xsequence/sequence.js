import { Address } from 'ox'
import { Generic } from './generic'

export interface WalletRow {
  wallet: Address.Address
  status: 'ready' | 'logging-in'
  loginDate: string
  device: Address.Address
  loginType: string
  useGuard: boolean
}

const TABLE_NAME = 'wallets'

export class Manager extends Generic<WalletRow, 'wallet'> {
  constructor(dbName: string = 'sequence-manager') {
    super(dbName, TABLE_NAME, 'wallet', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
