import { commons } from '@0xsequence/core'
import { Wallet } from '@0xsequence/wallet'

import { Migration } from './migrations'
import { ethers } from 'ethers'

export type UnsignedMigration = {
  tx: commons.transaction.TransactionBundle
  fromVersion: number
  toVersion: number
  toConfig: commons.config.Config
}

export type SignedMigration = Omit<UnsignedMigration, 'tx'> & {
  tx: commons.transaction.SignedTransactionBundle
}

export interface PresignedMigrationTracker {
  getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<SignedMigration | undefined>

  saveMigration(address: string, signed: SignedMigration, contexts: commons.context.VersionedContext): Promise<void>
}

export type Migrations = { [version: number]: Migration<commons.config.Config, commons.config.Config> }

function validateMigrations(migrations: Migrations) {
  for (const [version, migration] of Object.entries(migrations)) {
    if (version !== String(migration.version - 1)) {
      throw new Error(`Migration with key ${version} has version ${migration.version}, expected version to be key + 1`)
    }
  }
}

export class Migrator {
  constructor(
    public readonly tracker: PresignedMigrationTracker,
    public readonly migrations: Migrations,
    public readonly contexts: commons.context.VersionedContext
  ) {
    validateMigrations(migrations)
  }

  lastMigration(): Migration<commons.config.Config, commons.config.Config> {
    let last: Migration<commons.config.Config, commons.config.Config> | undefined
    for (const migration of Object.values(this.migrations)) {
      if (last === undefined || migration.version > last.version) {
        last = migration
      }
    }
    if (last === undefined) {
      throw new Error('No migrations')
    }
    return last
  }

  async getAllMigratePresignedTransaction(args: {
    address: string
    fromImageHash: string
    fromVersion: number
    chainId: ethers.BigNumberish
  }): Promise<{
    lastVersion: number
    lastImageHash: string
    signedMigrations: SignedMigration[]
    missing: boolean
  }> {
    const { address, fromImageHash, fromVersion, chainId } = args

    let fih = fromImageHash
    let fversion = fromVersion

    const versions = Object.values(this.contexts)
    const migs: SignedMigration[] = []

    for (let i = 1; i < versions.length; i++) {
      const mig = await this.tracker.getMigration(address, fih, fversion, chainId)
      if (!mig) return { signedMigrations: migs, missing: true, lastImageHash: fih, lastVersion: fversion }

      migs.push(mig)

      const migration = this.migrations[fversion]
      if (!migration) {
        throw new Error(`No migration found for version ${fversion}`)
      }

      const decoded = migration.decodeTransaction(mig.tx, this.contexts)
      if (decoded.address !== address) {
        throw new Error(`Migration transaction address does not match expected address`)
      }

      fih = decoded.newImageHash
      fversion += 1
    }

    return { signedMigrations: migs, missing: false, lastImageHash: fih, lastVersion: fversion }
  }

  async signNextMigration(
    address: string,
    fromVersion: number,
    wallet: Wallet,
    nextConfig: commons.config.Config
  ): Promise<SignedMigration | undefined> {
    const migration = this.migrations[fromVersion]

    if (!migration) {
      return undefined
    }

    const unsignedMigration = migration.buildTransaction(address, this.contexts, nextConfig)
    const signedBundle = await wallet.signTransactionBundle(unsignedMigration.tx)

    return {
      ...unsignedMigration,
      tx: signedBundle
    }
  }
}
