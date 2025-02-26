import { Address, Hex } from 'ox'
import { DEFAULT_CREATION_CODE } from './constants'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  creationCode: Hex.Hex
}

export const Dev1: Context = {
  factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447',
  stage1: '0x9C4953F499f7e63434d76E0735D4707473d92311',
  creationCode: DEFAULT_CREATION_CODE,
}
