import { State } from '@0xsequence/wallet-core'

export type UnsignedMigration = Omit<State.Migration, 'signature' | 'chainId' | 'fromImageHash'> & {
  chainId?: number
}
