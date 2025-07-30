import { Address, Bytes, Hash, PublicKey } from 'ox'
import { Context } from './context.js'
import { Config, hashConfiguration } from './config.js'

export type Checksummed = Address.Address & { readonly _checksummed: unique symbol }

export function checksum(address: string): Checksummed {
  return Address.checksum(address) as Checksummed
}

export function isChecksummed(address: any): address is Checksummed {
  return typeof address === 'string' && Address.validate(address) && address === Address.checksum(address)
}

export function isEqual(a: Checksummed, b: Checksummed): boolean {
  return a === b
}

export function fromPublicKey(publicKey: PublicKey.PublicKey, options?: Address.fromPublicKey.Options): Checksummed {
  return checksum(Address.fromPublicKey(publicKey, options))
}

export function fromDeployConfiguration(
  configuration: Bytes.Bytes | Config,
  context: Omit<Context, 'stage2'>,
): Checksummed {
  const imageHash = configuration instanceof Uint8Array ? configuration : hashConfiguration(configuration)

  return checksum(
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
