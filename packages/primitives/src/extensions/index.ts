import { Address } from 'ox'

export type Extensions = {
  passkeys: Address.Address
}

export const Dev1: Extensions = {
  passkeys: '0x8f26281dB84C18aAeEa8a53F94c835393229d296',
}

export * as Passkeys from './passkeys'
