import { Address, Hex } from 'ox'
import { DEFAULT_CREATION_CODE } from './constants'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  creationCode: Hex.Hex
}

export const Dev1: Context = {
  factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447',
  stage1: '0x7CC3CD2a7c2611e8bE6BAFfe17d0fA9B15a8858d',
  creationCode: DEFAULT_CREATION_CODE,
}
