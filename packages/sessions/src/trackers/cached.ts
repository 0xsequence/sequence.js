
import { commons, universal } from '@0xsequence/core'
import { migrator } from '@0xsequence/migration'
import { ethers } from 'ethers'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'

export class CachedTracker implements migrator.PresignedMigrationTracker, ConfigTracker {
  constructor(
    private readonly tracker: migrator.PresignedMigrationTracker & ConfigTracker,
    private readonly cache: migrator.PresignedMigrationTracker & ConfigTracker,
    public readonly contexts: commons.context.VersionedContext
  ) {}

  async loadPresignedConfiguration(args: { wallet: string; fromImageHash: string; longestPath?: boolean | undefined }): Promise<PresignedConfigLink[]> {
    // We need to check both, and return the one with the highest checkpoint
    // eventually we could try to combine them, but for now we'll just return
    // the one with the highest checkpoint
    const results = await Promise.all([this.tracker.loadPresignedConfiguration(args), this.cache.loadPresignedConfiguration(args)])
    const checkpoints = await Promise.all(results.map(async (r) => {
      const last = r[r.length - 1]
      if (!last) return undefined

      // TODO: This will fire a lot of requests, optimize it
      const config = await this.configOfImageHash({ imageHash: last.nextImageHash })
      if (!config) return undefined

      return { checkpoint: universal.genericCoderFor(config.version).config.checkpointOf(config), result: r }
    }))

    const best = checkpoints.reduce((acc, val) => {
      if (!val) return acc
      if (!acc) return val
      if (val.checkpoint.gt(acc.checkpoint)) return val
      return acc
    })

    if (!best) return []

    const configs = new Map<string, Promise<commons.config.Config | undefined>>()
    const config = (imageHash: string): Promise<commons.config.Config | undefined> => {
      if (!configs.has(imageHash)) {
        configs.set(imageHash, this.configOfImageHash({ imageHash }))
      }
      return configs.get(imageHash)!
    }
    best.result.forEach(async res => {
      const nextConfig = await config(res.nextImageHash)
      if (nextConfig) {
        this.savePresignedConfiguration({
          wallet: args.wallet,
          nextConfig,
          signature: res.signature
        })
      }
    })

    return best.result
  }

  async savePresignedConfiguration(args: PresignedConfig): Promise<void> {
    await Promise.all([this.tracker.savePresignedConfiguration(args), this.cache.savePresignedConfiguration(args)])
  }

  async configOfImageHash(args: { imageHash: string }): Promise<commons.config.Config | undefined> {
    // We first check the cache, if it's not there, we check the tracker
    // and then we save it to the cache
    const config = await this.cache.configOfImageHash(args)
    if (config) return config

    const config2 = await this.tracker.configOfImageHash(args)
    if (config2) {
      await this.cache.saveWalletConfig({ config: config2 })
    }

    return config2
  }

  async saveWalletConfig(args: { config: commons.config.Config }): Promise<void> {
    await Promise.all([this.tracker.saveWalletConfig(args), this.cache.saveWalletConfig(args)])
  }

  async imageHashOfCounterfactualWallet(args: { wallet: string }): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> {
    // We first check the cache, if it's not there, we check the tracker
    // and then we save it to the cache
    const result1 = await this.cache.imageHashOfCounterfactualWallet(args)
    if (result1) return result1

    const result2 = await this.tracker.imageHashOfCounterfactualWallet(args)
    if (result2) {
      // TODO: We shouldn't need to get the config to save the counterfactual wallet
      const config = await this.configOfImageHash({ imageHash: result2.imageHash })
      if (config) {
        await this.cache.saveCounterfactualWallet({ config, context: [result2.context] })
      }
    }
  
    return result2
  }

  async saveCounterfactualWallet(args: { config: commons.config.Config; context: commons.context.WalletContext[] }): Promise<void> {
    await Promise.all([this.tracker.saveCounterfactualWallet(args), this.cache.saveCounterfactualWallet(args)])
  }

  async walletsOfSigner(args: { signer: string }): Promise<{ wallet: string; proof: { digest: string; chainId: ethers.BigNumber; signature: string } }[]> {
    // In this case we need to both aggregate the results from the cache and the tracker
    // and then dedupe the results
    const results = await Promise.all([this.tracker.walletsOfSigner(args), this.cache.walletsOfSigner(args)])
    const wallets = new Map<string, { wallet: string; proof: { digest: string; chainId: ethers.BigNumber; signature: string} } >()

    for (const result of results) {
      for (const wallet of result) {
        wallets.set(wallet.wallet, wallet)
      }
    }

    return Array.from(wallets.values())
  }

  async saveWitnesses(args: { wallet: string; digest: string; chainId: ethers.BigNumberish; signatures: string[] }): Promise<void> {
    await Promise.all([this.tracker.saveWitnesses(args), this.cache.saveWitnesses(args)])
  }

  async getMigration(address: string, fromImageHash: string, fromVersion: number, chainId: ethers.BigNumberish): Promise<migrator.SignedMigration | undefined> {
    // We first check the cache, if it's not there, we check the tracker
    // NOTICE: we could eventually try to combine the two, but now we just have 1 migration
    // so it's not worth it.
    const migration1 = await this.cache.getMigration(address, fromImageHash, fromVersion, chainId)
    if (migration1) return migration1

    const migration2 = await this.tracker.getMigration(address, fromImageHash, fromVersion, chainId)
    if (migration2) {
      await this.cache.saveMigration(address, migration2, this.contexts)
    }

    return migration2
  }

  async saveMigration(address: string, signed: migrator.SignedMigration, contexts: commons.context.VersionedContext): Promise<void> {
    await Promise.all([this.tracker.saveMigration(address, signed, contexts), this.cache.saveMigration(address, signed, contexts)])
  }
}
