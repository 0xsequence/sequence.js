import { ethers } from "ethers"
import { commons } from '@0xsequence/core'

export async function versionOf(
  address: string,
  firstImageHash: string,
  contexts: commons.context.VersionedContext,
  reader: commons.reader.Reader
): Promise<number> {
  if (!commons.context.isValidVersionedContext(contexts)) {
    throw new Error("Invalid versioned context")
  }

  const versions = Object.values(contexts)

  // if not deployed we need to check to which version
  // the counterfactual address belongs to
  if (!(await reader.isDeployed(address))) {
    return counterfactualVersion(address, firstImageHash, versions)
  }

  // if deployed we need to check the implementation address
  const implementation = await reader.implementation(address)
  if (!implementation || implementation === ethers.constants.AddressZero) {
    throw new Error('Invalid implementation address')
  }

  for (let i = 0; i < versions.length; i++) {
    if (versions[i].mainModule === implementation || versions[i].mainModuleUpgradable === implementation) {
      return versions[i].version
    }
  }

  // If we can't find the version then either the address is invalid,
  // or the version is not in VersionedContext
  throw new Error('Could not find version for deployed address')
}

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
  version: number,
  coders: {
    config: commons.config.ConfigCoder<C>,
    signature: commons.signature.SignatureCoder<C, S, U>
  }
}