import { commons as v2commons } from '@0xsequence/v2core'
import { migrator as v2migrator } from '@0xsequence/v2migration'
import { WalletV1 } from '@0xsequence/v2wallet'
import { State, Wallet as WalletV3 } from '@0xsequence/wallet-core'
import { Constants, Context as V3Context } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import { Migrator } from '../index.js'
import { ConvertOptions, Migration_v1v3 } from './migration_v1_v3.js'

export type MigratorV1V3Options = ConvertOptions & {
  v3Context?: V3Context.Context
}

export class Migrator_v1v3 implements Migrator<WalletV1, WalletV3, MigratorV1V3Options> {
  fromVersion = 1
  toVersion = 3

  constructor(
    private readonly v1Tracker?: v2migrator.PresignedMigrationTracker,
    private readonly v3StateProvider?: State.Provider,
    public readonly migration: Migration_v1v3 = new Migration_v1v3(),
  ) {}

  async convertWallet(v1Wallet: WalletV1, options: MigratorV1V3Options): Promise<WalletV3> {
    // Prepare migration
    const v3Context = options.v3Context || V3Context.Rc3
    const v1Config = v1Wallet.config
    const v3Config = await this.migration.convertConfig(v1Config, options)
    await this.v3StateProvider?.saveConfiguration(v3Config)
    const unsignedMigration = await this.migration.prepareMigration(
      Address.from(v1Wallet.address),
      { [3]: v3Context },
      v3Config,
    )

    // Sign migration
    const txBundle: v2commons.transaction.TransactionBundle = {
      entrypoint: v1Wallet.address,
      transactions: unsignedMigration.transactions.map((tx) => ({
        to: tx.to,
        data: tx.data,
        gasLimit: 0n,
        revertOnError: true,
      })),
      nonce: unsignedMigration.nonce,
    }
    const signedTxBundle = await v1Wallet.signTransactionBundle(txBundle)

    // Save to tracker
    const v2SignedMigration: v2migrator.SignedMigration = {
      fromVersion: this.fromVersion,
      toVersion: this.toVersion,
      toConfig: {
        version: 3,
        ...v3Config,
      },
      tx: signedTxBundle,
    }
    const versionedContext: v2commons.context.VersionedContext = {
      [3]: {
        version: 3,
        mainModule: v3Context.stage1,
        mainModuleUpgradable: v3Context.stage2,
        factory: v3Context.factory,
        guestModule: Constants.DefaultGuestAddress,
        walletCreationCode: v3Context.creationCode,
      },
    }
    await this.v1Tracker?.saveMigration(v1Wallet.address, v2SignedMigration, versionedContext)
    //FIXME State provider should be aware of migrations too

    // Return v3 wallet
    return WalletV3.fromConfiguration(v3Config, {
      context: v3Context,
    })
  }
}
