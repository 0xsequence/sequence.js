export type Extensions = {
  passkeys: Address.Checksummed
  recovery: Address.Checksummed
  sessions: Address.Checksummed
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

export * as Passkeys from './passkeys.js'
export * as Recovery from './recovery.js'
