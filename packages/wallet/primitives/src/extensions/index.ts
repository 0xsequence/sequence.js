import { Address } from 'ox'

export type Extensions = {
  passkeys: Address.Address
  recovery: Address.Address
  sessions: Address.Address
}

export const Dev1: Extensions = {
  passkeys: '0x8f26281dB84C18aAeEa8a53F94c835393229d296',
  recovery: '0xd98da48C4FF9c19742eA5856A277424557C863a6',
  sessions: '0x81Fa4b986f958CB02A3A6c10aa38056dCd701941',
}

export * as Passkeys from './passkeys.js'
export * as Recovery from './recovery.js'
