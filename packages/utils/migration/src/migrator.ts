import { commons as v2commons } from '@0xsequence/v2core'
import { Context as V3Context } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export type VersionedContext = { [key: number]: v2commons.context.WalletContext | V3Context.Context }

export type UnsignedMigration = {
  transactions: {
    to: Address.Address
    data: Hex.Hex
  }[]
  nonce: bigint
  fromVersion: number
  toVersion: number
}

export type SignedMigration = UnsignedMigration & {
  signature: Hex.Hex
}

export interface PresignedMigrationTracker {
  getMigration(
    address: Address.Address,
    fromImageHash: Hex.Hex,
    fromVersion: number,
    chainId: number,
  ): Promise<SignedMigration | undefined>

  saveMigration(address: Address.Address, signed: SignedMigration, contexts: VersionedContext): Promise<void>
}

/*

// FIXME This class doesn't work because we need to cater for multiple wallet types and multiple chains
export class Migrator {
  constructor(
    public readonly trackers: PresignedMigrationTracker[],
    public readonly migrations: Migration<any, any, any, any>[],
    public readonly contexts: VersionedContext
  ) {
    validateMigrations(migrations)
  }

  async getAllMigratePresignedTransactions(args: {
    address: Address.Address
    fromImageHash: Hex.Hex
    fromVersion: number
    chainId: number
  }): Promise<{
    signedMigrations: SignedMigration[]
    lastVersion: number
    lastImageHash: Hex.Hex
    missing: boolean
  }> {
    const { address, fromImageHash, fromVersion, chainId } = args

    let currentImageHash = fromImageHash
    let currentVersion = fromVersion

    const migs: SignedMigration[] = []
    for (const migration of this.migrations) {
      const trackerMigrations = await Promise.all(this.trackers.map(async tracker => ({
        tracker: tracker,
        migration: await tracker.getMigration(address, currentImageHash, currentVersion, chainId)
      })))
      const trackerMigration = trackerMigrations.find(tm => tm.migration !== undefined)?.migration
      if (!trackerMigration) return { signedMigrations: migs, missing: true, lastImageHash: currentImageHash, lastVersion: currentVersion }
      // Ensure all trackers are tracking this migration
      for (const tm of trackerMigrations) {
        if (tm.migration === undefined) {
          // Save it
          await tm.tracker.saveMigration(address, trackerMigration, this.contexts)
        } else {
          // Compare it matches the expected migration (using a quick JSON stringify equal)
          if (JSON.stringify(tm.migration) !== JSON.stringify(trackerMigration)) {
            throw new Error(`Tracker migrations do not match`)
          }
        }
      }

      migs.push(trackerMigration)
      if (trackerMigration.fromVersion !== migration.fromVersion || trackerMigration.toVersion !== migration.toVersion) {
        throw new Error(`Tracker migration version does not match expected version: ${trackerMigration.fromVersion} -> ${trackerMigration.toVersion} !== ${migration.fromVersion} -> ${migration.toVersion}`)
      }
      const decoded = await migration.decodeTransactions(trackerMigration.transactions)
      if (decoded.address !== address) {
        throw new Error(`Migration transaction address does not match expected address: ${decoded.address} !== ${address}`)
      }

      currentImageHash = decoded.toImageHash
      currentVersion = migration.toVersion
    }

    return { signedMigrations: migs, missing: false, lastImageHash: currentImageHash, lastVersion: currentVersion }
  }

  // async signAllMigrations(
  //   address: Address.Address,
  //   fromVersion: number,
  //   wallet: V2Wallet
  // ): Promise<SignedMigration[]> {
  //   const migrations = this.migrations.filter(m => m.fromVersion === fromVersion)
  //   if (migrations.length === 0) {
  //     throw new Error(`No migrations found for version: ${fromVersion}`)
  //   }

  //   return Promise.all(migrations.map(async (migration): Promise<SignedMigration> => {
  //     const nextConfig = await migration.convertConfig(fromConfig, options)
  //     const unsignedMigration = await migration.prepareMigration(address, this.contexts, nextConfig)
  //     return migration.signMigration(unsignedMigration, wallet)
  //   }))
  // }
}
*/
