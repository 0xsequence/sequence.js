import { commons } from '@0xsequence/core'

export function counterfactualVersion(
  address: string,
  firstImageHash: string,
  versions: commons.context.WalletContext[]
): number {
  for (let i = 0; i < versions.length; i++) {
    if (commons.context.addressOf(versions[i], firstImageHash) === address) {
      return versions[i].version
    }
  }

  // if we can't find the version then either the address is invalid,
  // the version is not in VersionedContext, or the firstImageHash is not correct
  throw new Error('Could not find version for counterfactual address')
}

export interface Version<
  C extends commons.config.Config,
  S extends commons.signature.Signature<C>,
  U extends commons.signature.UnrecoveredSignature
> {
  version: number
  coders: {
    config: commons.config.ConfigCoder<C>
    signature: commons.signature.SignatureCoder<C, S, U>
  }
}
