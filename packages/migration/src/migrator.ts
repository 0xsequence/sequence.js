import { commons } from '@0xsequence/core'
import { Wallet } from '@0xsequence/wallet'
import { ethers } from 'ethers'

import { VersionedContext } from './context'
import { Migration } from "./migrations"

export type UnsignedMigration = {
  tx: commons.transaction.TransactionBundle,
  fromVersion: number,
  toVersion: number,
  toImageHash: string,
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

  saveMigration(
    address: string,
    chainId: ethers.BigNumberish,
    signed: SignedMigration,
    contexts: VersionedContext
  ): Promise<void>
}

export type Migrations = { [version: number]: Migration<commons.config.Config, commons.config.Config> }

export class Migrator {
  constructor(
    public readonly tracker: PresignedMigrationTracker,
    public readonly migrations: Migrations,
    public readonly contexts: VersionedContext
  ) {}

  lastMigration(): Migration<commons.config.Config, commons.config.Config> {
    const versions = Object.values(this.migrations)
    return versions[versions.length - 1]
  }

  async getAllMigratePresignedTransaction(args: {
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  }): Promise<{
    lastVersion: number,
    lastImageHash: string,
    signedMigrations: SignedMigration[],
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

  async signMissingMigrations(
    address: string,
    fromVersion: number,
    wallet: Wallet,
  ): Promise<SignedMigration[]> {
    const versions = Object.values(this.contexts)

    const result: SignedMigration[] = []

    for (let i = fromVersion; i < versions.length; i++) {
      const migration = this.migrations[i]

      if (!migration) {
        throw new Error(`No migration found for version ${i}`)
      }

      const unsignedMigration = migration.buildTransaction(address, this.contexts, wallet.config)
      const signedBundle = await wallet.signTransactionBundle(unsignedMigration.tx)

      result.push({
        ...unsignedMigration,
        tx: signedBundle
      })
    }

    return result
  }
}
