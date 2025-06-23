import { Address } from 'ox'

export interface Wallet {
  address: Address.Address
  status: 'ready' | 'logging-in' | 'logging-out'
  loginDate: string
  device: Address.Address
  loginType: string
  useGuard: boolean
  loginEmail?: string
}

export type WalletSelectionContext = {
  isRedirect: boolean
  target?: string
  signupKind?: string
}

export type WalletSelectionOptions = {
  existingWallets: Address.Address[]
  signerAddress: Address.Address
  context: WalletSelectionContext
}

export type WalletSelectionUiHandler = (options: WalletSelectionOptions) => Promise<Address.Address | undefined>
