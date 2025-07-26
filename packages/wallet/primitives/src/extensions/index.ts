import { checksum, Checksummed } from '../address.js'

export type Extensions = {
  passkeys: Checksummed
  recovery: Checksummed
  sessions: Checksummed
}

export const Dev1: Extensions = {
  passkeys: checksum('0x8f26281dB84C18aAeEa8a53F94c835393229d296'),
  recovery: checksum('0xd98da48C4FF9c19742eA5856A277424557C863a6'),
  sessions: checksum('0x06aa3a8F781F2be39b888Ac8a639c754aEe9dA29'),
}

export const Dev2: Extensions = {
  passkeys: checksum('0x4491845806B757D67BE05BbD877Cab101B9bee5C'),
  recovery: checksum('0xdED857b9b5142832634129aFfc1D67cD106b927c'),
  sessions: checksum('0x06aa3a8F781F2be39b888Ac8a639c754aEe9dA29'),
}

export * as Passkeys from './passkeys.js'
export * as Recovery from './recovery.js'
