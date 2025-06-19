import { Address } from 'ox'

export type Extensions = {
  passkeys: Address.Address
  recovery: Address.Address
  sessions: Address.Address
  guard: Address.Address
}

export const Dev1: Extensions = {
  passkeys: '0x8f26281dB84C18aAeEa8a53F94c835393229d296',
  recovery: '0xd98da48C4FF9c19742eA5856A277424557C863a6',
  sessions: '0x23c2eB9958BcAC9E531E785c4f65e91F1F426142',
  guard: '0x0AB3c096F3b2FD017413266Dfb29524A21df556f', // TODO: change to the actual guard address
}

export const Dev2: Extensions = {
  passkeys: '0x4491845806B757D67BE05BbD877Cab101B9bee5C',
  recovery: '0xdED857b9b5142832634129aFfc1D67cD106b927c',
  sessions: '0x23c2eB9958BcAC9E531E785c4f65e91F1F426142',
  guard: '0x0AB3c096F3b2FD017413266Dfb29524A21df556f', // TODO: change to the actual guard address
}

export * as Passkeys from './passkeys.js'
export * as Recovery from './recovery.js'
