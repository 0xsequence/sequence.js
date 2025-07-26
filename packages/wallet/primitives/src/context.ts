import { Hex } from 'ox'
import { checksum, Checksummed } from './address.js'

export type Capabilities = {
  erc4337?: {
    entrypoint: Checksummed
  }
}

export type Context = {
  factory: Checksummed
  stage1: Checksummed
  stage2: Checksummed
  creationCode: Hex.Hex
  capabilities?: Capabilities
}

export const Dev1: Context = {
  factory: checksum('0xe828630697817291140D6B7A42a2c3b7277bE45a'),
  stage1: checksum('0x2a4fB19F66F1427A5E363Bf1bB3be27b9A9ACC39'),
  stage2: checksum('0xe1299E4456b267123F7Aba29B72C2164ff501BDa'),
  creationCode: '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3',
}

export const Dev2: Context = {
  factory: checksum('0xFE14B91dE3c5Ca74c4D24608EBcD4B2848aA6010'),
  stage1: checksum('0x300E98ae5bEA4A7291d62Eb0b9feD535E10095dD'),
  stage2: checksum('0x90cb0a8ccf40bEdA60896e408bdc7801033447C6'),
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
}

export const Dev2_4337: Context = {
  factory: checksum('0xFE14B91dE3c5Ca74c4D24608EBcD4B2848aA6010'),
  stage1: checksum('0x8Ae58FCc0Ee9b32994CA52c9854deb969DC8fa2A'),
  stage2: checksum('0x30f8e3AceAcDEac8a3F28935D87FD58DC5f71ad2'),
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
  capabilities: {
    erc4337: {
      entrypoint: checksum('0x0000000071727De22E5E9d8BAf0edAc6f37da032'),
    },
  },
}

export type KnownContext = Context & {
  name: string
  development: boolean
}

export const KnownContexts: KnownContext[] = [
  { name: 'Dev1', development: true, ...Dev1 },
  { name: 'Dev2', development: true, ...Dev2 },
  { name: 'Dev2_4337', development: true, ...Dev2_4337 },
]

export function isKnownContext(context: Context): context is KnownContext {
  return (context as KnownContext).name !== undefined && (context as KnownContext).development !== undefined
}
