import { commons } from '@0xsequence/core'
import { migrator } from '@0xsequence/migration'

import { ethers } from 'ethers'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'
import { PromiseCache } from './promise-cache'
import { LocalConfigTracker } from './local'

export function isDedupedTracker(tracker: any): tracker is DedupedTracker {
  return tracker instanceof DedupedTracker
}

// This tracks wraps another tracker and dedupes calls to it, so in any calls
// are sent in short succession, only the first call is forwarded to the
// underlying tracker, and the rest are ignored.
export class DedupedTracker implements migrator.PresignedMigrationTracker, ConfigTracker {
  private cache: PromiseCache = new PromiseCache()

  constructor(
    private readonly tracker: migrator.PresignedMigrationTracker & ConfigTracker,
    public readonly window = 50,
    public verbose = false
  ) {}

  invalidateCache() {
    this.cache = new PromiseCache()
  }

  configOfImageHash(args: { imageHash: string }): Promise<commons.config.Config | undefined> {
    return this.cache.do('configOfImageHash', this.window, args => this.tracker.configOfImageHash(args), args)
  }

  getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<migrator.SignedMigration | undefined> {
    return this.cache.do(
      'getMigration',
      this.window,
      (...args) => this.tracker.getMigration(...args),
      address,
      fromImageHash,
      fromVersion,
      chainId
    )
  }

  saveMigration(address: string, signed: migrator.SignedMigration, contexts: commons.context.VersionedContext): Promise<void> {
    return this.cache.do('saveMigration', undefined, (...args) => this.tracker.saveMigration(...args), address, signed, contexts)
  }

  loadPresignedConfiguration(args: {
    wallet: string
    fromImageHash: string
    longestPath?: boolean | undefined
  }): Promise<PresignedConfigLink[]> {
    return this.cache.do('loadPresignedConfiguration', this.window, args => this.tracker.loadPresignedConfiguration(args), args)
  }

  savePresignedConfiguration(args: PresignedConfig): Promise<void> {
    return this.cache.do('savePresignedConfiguration', undefined, args => this.tracker.savePresignedConfiguration(args), args)
  }

  saveWitnesses(args: { wallet: string; digest: string; chainId: ethers.BigNumberish; signatures: string[] }): Promise<void> {
    return this.cache.do('saveWitnesses', undefined, args => this.tracker.saveWitnesses(args), args)
  }

  saveWalletConfig(args: { config: commons.config.Config }): Promise<void> {
    return this.cache.do('saveWalletConfig', undefined, args => this.tracker.saveWalletConfig(args), args)
  }

  imageHashOfCounterfactualWallet(args: {
    wallet: string
  }): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> {
    return this.cache.do(
      'imageHashOfCounterfactualWallet',
      undefined,
      args => this.tracker.imageHashOfCounterfactualWallet(args),
      args
    )
  }

  saveCounterfactualWallet(args: { config: commons.config.Config; context: commons.context.WalletContext[] }): Promise<void> {
    return this.cache.do('saveCounterfactualWallet', undefined, args => this.tracker.saveCounterfactualWallet(args), args)
  }

  walletsOfSigner(args: {
    signer: string
  }): Promise<{ wallet: string; proof: { digest: string; chainId: bigint; signature: string } }[]> {
    return this.cache.do('walletsOfSigner', this.window, args => this.tracker.walletsOfSigner(args), args)
  }

  updateProvider(provider: ethers.Provider) {
    if (this.tracker instanceof LocalConfigTracker) {
      this.tracker.updateProvider(provider)
    }
  }
}
