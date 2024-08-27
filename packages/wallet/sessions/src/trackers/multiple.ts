import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'
import { migrator } from '@0xsequence/migration'

import { commons, universal } from '@0xsequence/core'
import { LocalConfigTracker } from './local'
import { ethers } from 'ethers'

export function raceUntil<T>(promises: Promise<T>[], fallback: T, evalRes: (val: T) => boolean): Promise<T> {
  return new Promise(resolve => {
    let count = 0

    promises.forEach(p =>
      p
        .then((val: T) => {
          if (evalRes(val)) {
            resolve(val)
          } else {
            count++
            if (count === promises.length) {
              resolve(fallback)
            }
          }
        })
        .catch(() => {
          // Ignore
          count++
          if (count === promises.length) {
            resolve(fallback)
          }
        })
    )
  })
}

export async function allSafe<T>(promises: Promise<T>[], fallback: T): Promise<T[]> {
  return Promise.all(promises.map(promise => promise.catch(() => fallback)))
}

export class MultipleTracker implements migrator.PresignedMigrationTracker, ConfigTracker {
  constructor(private trackers: (migrator.PresignedMigrationTracker & ConfigTracker)[]) {}

  async configOfImageHash(args: { imageHash: string }): Promise<commons.config.Config | undefined> {
    const requests = this.trackers.map(async (t, i) => ({ res: await t.configOfImageHash(args), i }))

    // We try to find a complete configuration, we race so that we don't wait for all trackers to respond
    const result1 = await raceUntil(requests, undefined, val => {
      if (val?.res === undefined) return false
      return universal.genericCoderFor(val.res.version).config.isComplete(val.res)
    })

    if (result1?.res) {
      // Skip saving the config to the tracker that returned the result
      this.saveWalletConfig({ config: result1.res, skipTracker: result1.i })
      return result1.res
    }

    // If we haven't found a complete configuration yet, it either means that the configuration is not complete
    // (and thus we need to combine all results) or that the configuration is not found at all
    // but we try to combine all results anyway
    const tmptracker = new LocalConfigTracker(undefined as any) // TODO: Fix this, provider not needed anyway

    const results = await allSafe(requests, undefined)

    for (const r of results) {
      if (r?.res) await tmptracker.saveWalletConfig({ config: r.res })
    }

    const result2 = await tmptracker.configOfImageHash(args)
    if (result2) this.saveWalletConfig({ config: result2 })
    return result2
  }

  async saveWalletConfig(args: { config: commons.config.Config; skipTracker?: number }): Promise<void> {
    await Promise.all(
      this.trackers.map((t, i) => {
        if (i === args.skipTracker) return
        return t.saveWalletConfig(args)
      })
    )
  }

  async imageHashOfCounterfactualWallet(args: {
    wallet: string
  }): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> {
    const imageHash = await raceUntil(
      this.trackers.map(t => t.imageHashOfCounterfactualWallet(args)),
      undefined,
      result => Boolean(result)
    )

    if (imageHash) {
      this.configOfImageHash({ imageHash: imageHash.imageHash }).then(config => {
        if (config) {
          this.saveCounterfactualWallet({ config, context: [imageHash.context] })
        }
      })
    }

    return imageHash
  }

  async saveCounterfactualWallet(args: {
    config: commons.config.Config
    context: commons.context.WalletContext[]
    skipTracker?: number
  }): Promise<void> {
    await Promise.all(
      this.trackers.map((t, i) => {
        if (i === args.skipTracker) return
        return t.saveCounterfactualWallet(args)
      })
    )
  }

  async walletsOfSigner(args: {
    signer: string
  }): Promise<{ wallet: string; proof: { digest: string; chainId: bigint; signature: string } }[]> {
    // We can't race here, because there is no "correct" response
    // we just return the union of all results, skipping duplicates
    const results = await allSafe(
      this.trackers.map(t => t.walletsOfSigner(args)),
      []
    ).then(r => r.flat())

    const wallets: { [wallet: string]: { digest: string; chainId: bigint; signature: string } } = {}
    for (const r of results) {
      wallets[r.wallet] = r.proof
    }

    // TODO: This will send redundant information back to the trackers
    // consider optimizing this for better performance during login

    const result = Object.keys(wallets).map(w => ({ wallet: w, proof: wallets[w] }))

    const witnesses = new Map<string, { wallet: string; digest: string; chainId: bigint; signatures: string[] }>()
    result.forEach(({ wallet, proof: { digest, chainId, signature } }) => {
      const key = `${wallet}-${digest}-${chainId}`
      let signatures = witnesses.get(key)
      if (!signatures) {
        signatures = { wallet, digest, chainId, signatures: [] }
        witnesses.set(key, signatures)
      }
      signatures.signatures.push(signature)
    })
    witnesses.forEach(witnesses => this.saveWitnesses(witnesses))

    return result
  }

  async saveWitnesses(args: {
    wallet: string
    digest: string
    chainId: ethers.BigNumberish
    signatures: string[]
  }): Promise<void> {
    await Promise.all(this.trackers.map(t => t.saveWitnesses(args)))
  }

  async loadPresignedConfiguration(args: {
    wallet: string
    fromImageHash: string
    longestPath?: boolean | undefined
  }): Promise<PresignedConfigLink[]> {
    // We can't race here, because any of the trackers could have a new "link" in the chain
    const results = await allSafe(
      this.trackers.map(t => t.loadPresignedConfiguration(args)),
      []
    )

    // The "best" result is the one with the highest checkpoint
    const checkpoints = await allSafe(
      results.map(async r => {
        const last = r[r.length - 1]

        // TODO: This will fire a lot of requests, optimize it
        const config = await this.configOfImageHash({ imageHash: last.nextImageHash })
        if (!config) return undefined

        return { checkpoint: universal.genericCoderFor(config.version).config.checkpointOf(config), result: r }
      }),
      undefined
    )

    const best = checkpoints.reduce((acc, val) => {
      if (!val) return acc
      if (!acc) return val
      if (val.checkpoint > acc.checkpoint) return val
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
    await Promise.all(this.trackers.map(t => t.savePresignedConfiguration(args)))
  }

  async getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<migrator.SignedMigration | undefined> {
    // TODO: Backfeed migration results to other trackers
    const results = await Promise.all(this.trackers.map(t => t.getMigration(address, fromImageHash, fromVersion, chainId)))
    return results.find(r => !!r)
  }

  async saveMigration(
    address: string,
    signed: migrator.SignedMigration,
    contexts: commons.context.VersionedContext
  ): Promise<void> {
    await Promise.all(this.trackers.map(t => t.saveMigration(address, signed, contexts)))
  }
}
