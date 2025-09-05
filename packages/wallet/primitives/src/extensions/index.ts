import { Address } from 'ox'

export type Extensions = {
  passkeys: Address.Address
  recovery: Address.Address
  sessions: Address.Address
}

export const Dev1: Extensions = {
  passkeys: '0x8f26281dB84C18aAeEa8a53F94c835393229d296',
  recovery: '0xd98da48C4FF9c19742eA5856A277424557C863a6',
  sessions: '0x06aa3a8F781F2be39b888Ac8a639c754aEe9dA29',
}

export const Dev2: Extensions = {
  passkeys: '0x4491845806B757D67BE05BbD877Cab101B9bee5C',
  recovery: '0xdED857b9b5142832634129aFfc1D67cD106b927c',
  sessions: '0x06aa3a8F781F2be39b888Ac8a639c754aEe9dA29',
}

export const Rc3: Extensions = {
  passkeys: '0x0000000000dc2d96870dc108c5E15570B715DFD2',
  recovery: '0x0000000000213697bCA95E7373787a40858a51C7',
  sessions: '0x0000000000CC58810c33F3a0D78aA1Ed80FaDcD8',
}

export * as Passkeys from './passkeys.js'
export * as Recovery from './recovery.js'
