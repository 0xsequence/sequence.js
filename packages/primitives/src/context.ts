import { Address, Hex } from 'ox'
import { DEFAULT_CREATION_CODE } from './constants'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  // stage2: Address.Address
  creationCode: Hex.Hex
}

export const Dev1: Context = {
  factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447',
  stage1: '0x76E132217927D8B0d1374328adC48Bd2b7EEC8d7',
  // stage2: '0xb1ED343aAaC68F800B66b66c63F87211BEF8Bb97',
  creationCode: DEFAULT_CREATION_CODE,
}
