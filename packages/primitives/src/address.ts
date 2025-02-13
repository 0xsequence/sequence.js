import { Address, Bytes, Hash } from 'ox'
import { Configuration, hashConfiguration } from './config'
import { Context } from './constants'

export function getCounterfactualAddress(
  configuration: Bytes.Bytes | Configuration,
  context: Context,
): Address.Address {
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
