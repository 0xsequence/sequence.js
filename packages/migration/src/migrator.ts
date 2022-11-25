import { commons } from '@0xsequence/core'
import { walletV2 } from '@0xsequence/wallet'
import { ethers } from 'ethers'

import { VersionedContext } from './context'
import { Migration } from "./migrations"

export type SignedMigration = {
  tx: commons.transaction.SignedTransactionBundle,
  toImageHash: string,
  toConfig: commons.config.Config
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
    fromConfig: commons.config.Config,
    fromVersion: number,
    chainId: ethers.BigNumberish,
    signed: SignedMigration
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

    for (let i = 0; i < versions.length; i++) {
      const mig = await this.tracker.getMigration(address, fih, fversion, chainId)
      if (!mig) return { signedMigrations: migs, missing: true, lastImageHash: fih, lastVersion: fversion }

      migs.push(mig)

      const migration = this.migrations[fversion + 1]
      if (!migration) {
        throw new Error(`No migration found for version ${fversion + 1}`)
      }

      const decoded = migration.decodeTransaction(mig.tx, this.contexts)
      if (decoded.address !== address) {
        throw new Error(`Migration transaction address does not match expected address`)
      }

      fih = migration.configCoder.imageHashOf(decoded.newConfig)
      fversion = decoded.newConfig.version
    }

    return { signedMigrations: migs, missing: false, lastImageHash: fih, lastVersion: fversion }
  }

  async signMissingMigrations(
    address: string,
    existing: commons.transaction.SignedTransactionBundle[],
    wallet: walletV2.Wallet,
  ): Promise<commons.transaction.SignedTransactionBundle[]> {
    const versions = Object.values(this.contexts)
    const txs: commons.transaction.SignedTransactionBundle[] = [...existing]

    for (let i = txs.length; i < versions.length; i++) {
      const version = i + 1
      const migration = this.migrations[version]

      if (!migration) {
        throw new Error(`No migration found for version ${version}`)
      }

      const tx = migration.buildTransaction(address, this.contexts, wallet.config)
      const signed = await wallet.signTransactionBundle(tx)

      txs.push(signed)
    }

    return txs
  }
}
