import { Address as oxAddress, Bytes, Hash, PublicKey } from 'ox'
import { Context } from './context.js'
import { Config, hashConfiguration } from './config.js'

export function from(configuration: Bytes.Bytes | Config, context: Omit<Context, 'stage2'>): Address {
  const imageHash = configuration instanceof Uint8Array ? configuration : hashConfiguration(configuration)

  return normalize(
    Bytes.toHex(
      Hash.keccak256(
        Bytes.concat(
          Bytes.from('0xff'),
          Bytes.from(context.factory),
          imageHash,
          Hash.keccak256(Bytes.concat(Bytes.from(context.creationCode), Bytes.padLeft(Bytes.from(context.stage1), 32))),
        ),
        { as: 'Bytes' },
      ).subarray(12),
    ),
  )
}

export type Address = oxAddress.Address & { readonly _normalized: unique symbol }

export function normalize(address: string): Address {
  return oxAddress.from(address) as Address
}

export function assert(address: string): asserts address is Address {
  oxAddress.assert(address)
  if (address !== oxAddress.checksum(address)) {
    throw new Error(`incorrect address checksum '${address}'`)
  }
}

export function validate(address: string): address is Address {
  return oxAddress.validate(address) && address === oxAddress.checksum(address)
}

export function fromPublicKey(pubkey: PublicKey.PublicKey): Address {
  return normalize(oxAddress.fromPublicKey(pubkey))
}
