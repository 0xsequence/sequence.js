import { commons as v2commons } from '@0xsequence/v2core'
import { State } from '@0xsequence/wallet-core'
import { Context as V3Context } from '@0xsequence/wallet-primitives'

export type VersionedContext = { [key: number]: v2commons.context.WalletContext | V3Context.Context }

export type UnsignedMigration = Omit<State.Migration, 'signature' | 'chainId' | 'fromImageHash'> & {
  chainId?: number
}
