import { Address, Bytes, Hash } from 'ox'
import { Configuration, hashConfiguration } from './config'
import { CREATION_CODE, FACTORY, MAIN_MODULE } from './constants'

export function getCounterfactualAddress(configuration: Bytes.Bytes | Configuration): Address.Address {
  const imageHash = configuration instanceof Uint8Array ? configuration : hashConfiguration(configuration)

  return Bytes.toHex(
    Hash.keccak256(
      Bytes.concat(
        Bytes.from('0xff'),
        Bytes.from(FACTORY),
        imageHash,
        Hash.keccak256(Bytes.concat(Bytes.from(CREATION_CODE), Bytes.from(MAIN_MODULE))),
      ),
      { as: 'Bytes' },
    ).subarray(12),
  )
}
