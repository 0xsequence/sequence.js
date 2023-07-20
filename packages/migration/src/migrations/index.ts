import { commons } from '@0xsequence/core'
import { UnsignedMigration } from '../migrator'
import { Migration_v1v2 } from './migration_01_02'

//                                 = uint160(keccak256("org.sequence.sdk.migration.space.nonce"))
export const MIGRATION_NONCE_SPACE = '0xa04263acf755e8bd19c0d7e20eea39a9ff3729eb'

export interface Migration<P extends commons.config.Config, C extends commons.config.Config> {
  version: number

  buildTransaction: (address: string, contexts: commons.context.VersionedContext, newConfig: P | C) => UnsignedMigration

  decodeTransaction: (
    tx: commons.transaction.TransactionBundle,
    contexts: commons.context.VersionedContext
  ) => {
    address: string
    newImageHash: string
  }

  configCoder: commons.config.ConfigCoder<C>
  signatureCoder: commons.signature.SignatureCoder<C, commons.signature.Signature<C>, commons.signature.UnrecoveredSignature>
}

export const v1v2 = new Migration_v1v2()
