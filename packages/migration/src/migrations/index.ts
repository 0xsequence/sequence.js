import { commons } from "@0xsequence/core"
import { VersionedContext } from "../context"

//                                 = uint160(keccak256("org.sequence.sdk.migration.space.nonce"))
export const MIGRATION_NONCE_SPACE = "0xa04263acf755e8bd19c0d7e20eea39a9ff3729eb"

export interface Migration<
  P extends commons.config.Config,
  C extends commons.config.Config,
> {
  version: number,

  buildTransaction: (
    address: string,
    contexts: VersionedContext,
    newConfig: P | C
  ) => commons.transaction.TransactionBundle

  decodeTransaction: (
    tx: commons.transaction.TransactionBundle,
    contexts: VersionedContext
  ) => {
    address: string,
    newConfig: C
  }

  configCoder: commons.config.ConfigCoder<C>
  signatureCoder: commons.signature.SignatureCoder<
    C,
    commons.signature.Signature<C>,
    commons.signature.UnrecoveredSignature
  >
}

export * as v1v2 from './migration_01_02'
