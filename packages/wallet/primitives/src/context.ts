import { Address, Hex } from 'ox'
import { DEFAULT_CREATION_CODE, DefaultFactory, DefaultStage1, DefaultStage2 } from './constants.js'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  stage2: Address.Address
  creationCode: Hex.Hex
}

export const Dev1: Context = {
  factory: DefaultFactory,
  stage1: DefaultStage1,
  stage2: DefaultStage2,
  creationCode: DEFAULT_CREATION_CODE,
}
