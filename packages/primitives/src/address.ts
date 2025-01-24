import { Address, Bytes, Hash, Hex } from 'ox'
import { Configuration, hashConfiguration } from './config'

const FACTORY: Address.Address = '0x'
const MAIN_MODULE: Address.Address = '0x'
const CREATION_CODE: Hex.Hex = '0x'

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
