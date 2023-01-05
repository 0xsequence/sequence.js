
import { commons } from '@0xsequence/core'

export type VersionedContext = { [key: number]: commons.context.WalletContext }

export function isValidVersionedContext(contexts: VersionedContext): boolean {
  // number of keys is the number of versions
  const versions = Object.keys(contexts).length

  // check that all versions exist and are valid
  for (let i = 1; i <= versions; i++) {
    const context = contexts[i]
    if (!context || context.version !== i) {
      return false
    }
  }

  return true
}

export function latestContext(contexts: VersionedContext): commons.context.WalletContext {
  const versions = Object.keys(context).length
  return contexts[versions]
}
