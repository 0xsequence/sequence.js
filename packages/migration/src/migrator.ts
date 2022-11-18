import { commons } from '@0xsequence/core'
import { walletV2 } from '@0xsequence/wallet'
import { ethers } from 'ethers'

import { VersionedContext } from './context'
import { Migration } from "./migrations"

export interface PresignedMigrationTracker {
  getMigration(
    address: string,
    fromConfig: commons.config.Config,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<commons.transaction.SignedTransactionBundle | undefined>

  saveMigration(
    address: string,
    fromConfig: commons.config.Config,
    fromVersion: number,
    chainId: ethers.BigNumberish,
    tx: commons.transaction.SignedTransactionBundle
  ): Promise<void>
}

export class Migrator {
  constructor(
    public readonly tracker: PresignedMigrationTracker,
    public readonly migrations: { [version: number]: Migration<commons.config.Config, commons.config.Config> },
    public readonly contexts: VersionedContext
  ) {}

  async getNextMigratePresignedTransaction(
    address: string,
    fromConfig: commons.config.Config,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<commons.transaction.SignedTransactionBundle | undefined> {
    if (fromVersion !== fromConfig.version) {
      throw new Error(`Config version ${fromConfig.version} does not match fromVersion ${fromVersion}`)
    }

    return this.tracker.getMigration(address, fromConfig, fromVersion, chainId)
  }

  async getAllMigratePresignedTransaction(
    address: string,
    fromConfig: commons.config.Config,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<{ txs: commons.transaction.SignedTransactionBundle[], missing: boolean }> {
    let fconfig = fromConfig
    let fversion = fromVersion

    const versions = Object.values(this.contexts)
    const txs: commons.transaction.SignedTransactionBundle[] = []

    for (let i = 0; i < versions.length; i++) {
      const tx = await this.tracker.getMigration(address, fconfig, fversion, chainId)
      if (!tx) return { txs, missing: true }

      txs.push(tx)

      const migration = this.migrations[fversion + 1]
      if (!migration) {
        throw new Error(`No migration found for version ${fversion + 1}`)
      }

      const decoded = migration.decodeTransaction(tx, this.contexts)
      if (decoded.address !== address) {
        throw new Error(`Migration transaction address does not match expected address`)
      }

      fconfig = decoded.newConfig
      fversion = fconfig.version
    }

    return { txs, missing: false }
  }

  async signMissingMigrations(
    address: string,
    existing: commons.transaction.SignedTransactionBundle[],
    wallet: walletV2.Wallet<
      commons.signature.Signature<commons.config.Config>,
      commons.config.Config,
      commons.signature.UnrecoveredSignature
    >,
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
