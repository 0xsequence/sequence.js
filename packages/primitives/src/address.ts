import { Address, Bytes, Hash } from 'ox'
import { Context } from './context'
import { Config, hashConfiguration } from './config'

export function from(configuration: Bytes.Bytes | Config, context: Context): Address.Address {
  const imageHash = configuration instanceof Uint8Array ? configuration : hashConfiguration(configuration)

  return Bytes.toHex(
    Hash.keccak256(
      Bytes.concat(
        Bytes.from('0xff'),
        Bytes.from(context.factory),
        imageHash,
        Hash.keccak256(Bytes.concat(Bytes.from(context.creationCode), Bytes.padLeft(Bytes.from(context.stage1), 32))),
      ),
      { as: 'Bytes' },
    ).subarray(12),
  )
}
