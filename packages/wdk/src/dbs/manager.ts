import { Address } from 'ox'
import { Generic } from '.'

export interface WalletRow {
  wallet: Address.Address
  status: string
  loginDate: string
  device: Address.Address
  loginType: string
  useGuard: boolean
}

export class Manager extends Generic<WalletRow, 'wallet'> {
  constructor(dbName: string = 'sequence-manager') {
    super(dbName, 'wallets', 'wallet')
  }
}
