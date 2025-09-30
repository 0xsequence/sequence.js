import { Config } from '@0xsequence/wallet-primitives'

export type Module = {
  weight: bigint
  sapientLeaf: Config.SapientSignerLeaf
  guardLeaf?: Config.NestedLeaf
}
