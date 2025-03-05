import { Address } from 'ox'

export type Extensions = {
  passkeys: Address.Address
}

export const Dev1: Extensions = {
  passkeys: '0x38A6E2281C1A010e2F98159f5Fc44787957a6725',
}

export * as Passkeys from './passkeys'
