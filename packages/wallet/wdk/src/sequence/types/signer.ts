import { Address, Hex } from 'ox'

export const Kinds = {
  LocalDevice: 'local-device',
  LoginPasskey: 'login-passkey',
  LoginMnemonic: 'login-mnemonic',
  LoginEmailOtp: 'login-email-otp',
  LoginGooglePkce: 'login-google-pkce',
  LoginApplePkce: 'login-apple-pkce',
  Unknown: 'unknown',
} as const

export type Kind = (typeof Kinds)[keyof typeof Kinds]

export type WitnessExtraSignerKind = {
  signerKind: string
}

export type SignerWithKind = {
  address: Address.Address
  kind?: Kind
  imageHash?: Hex.Hex
}
