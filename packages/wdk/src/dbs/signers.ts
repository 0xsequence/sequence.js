import { Address } from 'ox'
import { Generic } from './generic'

export interface SignerRow {
  address: Address.Address
  imageHash?: string

  kind: string
}

const TABLE_NAME = 'signers'

export class Signers extends Generic<SignerRow, 'address'> {
  constructor(dbName: string = 'sequence-signers') {
    super(dbName, TABLE_NAME, 'address', [
      (db: IDBDatabase) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          db.createObjectStore(TABLE_NAME)
        }
      },
    ])
  }
}
