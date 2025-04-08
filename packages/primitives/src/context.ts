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
  stage1: '0x656e2d390E76f3Fba9f0770Dd0EcF4707eee3dF1',
  creationCode: DEFAULT_CREATION_CODE,
}
