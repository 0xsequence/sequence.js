import { Address } from 'ox'
import { Generic } from '.'

export interface SignerRow {
  address: Address.Address
  imageHash?: string

  kind: string
}

export class Signers extends Generic<SignerRow, 'address'> {
  constructor(dbName: string = 'sequence-signers') {
    super(dbName, 'signers', 'address')
  }
}
