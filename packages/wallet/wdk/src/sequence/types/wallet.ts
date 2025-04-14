import { Address } from 'ox'

export interface Wallet {
  address: Address.Address
  status: 'ready' | 'logging-in'
  loginDate: string
  device: Address.Address
  loginType: string
  useGuard: boolean
}
