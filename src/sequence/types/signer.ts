import { Address, Hex } from 'ox'

export const Kinds = {
  LocalDevice: 'local-device',
  LoginPasskey: 'login-passkey',
  LoginMnemonic: 'login-mnemonic', // Todo: do not name it login-mnemonic, just mnemonic
  LoginEmailOtp: 'login-email-otp',
  LoginGooglePkce: 'login-google-pkce',
  LoginApple: 'login-apple',
  Recovery: 'recovery-extension',
  Guard: 'guard-extension',
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

export type RecoverySigner = {
  kind: Kind
  isRecovery: true
  address: Address.Address
  minTimestamp: bigint
  requiredDeltaTime: bigint
}
