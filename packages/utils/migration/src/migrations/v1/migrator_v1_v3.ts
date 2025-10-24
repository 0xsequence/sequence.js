import { v1, commons as v2commons } from '@0xsequence/v2core'
import { WalletV1 } from '@0xsequence/v2wallet'
import { State, Wallet as WalletV3 } from '@0xsequence/wallet-core'
import { Payload, Context as V3Context } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Migrator } from '../index.js'
import { ConvertOptions, MigrationEncoder_v1v3, PrepareOptions } from './encoder_v1_v3.js'

export type MigratorV1V3Options = ConvertOptions &
  PrepareOptions & {
    v3Context?: V3Context.Context
  }

export class Migrator_v1v3 implements Migrator<WalletV1, WalletV3, MigratorV1V3Options> {
  fromVersion = 1
  toVersion = 3

  constructor(
    private readonly v3StateProvider: State.Provider,
    private readonly encoder: MigrationEncoder_v1v3 = new MigrationEncoder_v1v3(),
  ) {}

  private convertV1Context(v1Wallet: v2commons.context.WalletContext): V3Context.Context & { guest?: Address.Address } {
    Hex.assert(v1Wallet.walletCreationCode)
    return {
      factory: Address.from(v1Wallet.factory),
      stage1: Address.from(v1Wallet.mainModule),
      stage2: Address.from(v1Wallet.mainModuleUpgradable),
      creationCode: v1Wallet.walletCreationCode,
      guest: Address.from(v1Wallet.guestModule),
    }
  }

  async convertWallet(v1Wallet: WalletV1, options: MigratorV1V3Options): Promise<WalletV3> {
    // Prepare configuration
    const walletAddress = Address.from(v1Wallet.address)
    const v3Context = options.v3Context || V3Context.Rc3
    const v1Config = v1Wallet.config
    const v3Config = await this.encoder.convertConfig(v1Config, options)

    // Save v1 wallet information to v3 state provider
    const v1ImageHash = v1.config.ConfigCoder.imageHashOf(v1Config)
    Hex.assert(v1ImageHash)
    if (this.v3StateProvider instanceof State.Sequence.Provider) {
      // Force save the v1 configuration to key machine
      const v1ServiceConfig = {
        threshold: Number(v1Config.threshold),
        signers: v1Config.signers.map(({ weight, address }) => ({ weight: Number(weight), address })),
      }
      await this.v3StateProvider.forceSaveConfiguration(v1ServiceConfig, this.fromVersion)
    }
    await this.v3StateProvider.saveDeploy(v1ImageHash, this.convertV1Context(v1Wallet.context))
    await this.v3StateProvider.saveConfiguration(v3Config)

    // Prepare migration
    const unsignedMigration = await this.encoder.prepareMigration(walletAddress, v3Context, v3Config, options)

    // Sign migration
    const chainId = v1Wallet.chainId
    const v2Nonce = v2commons.transaction.encodeNonce(unsignedMigration.payload.space, unsignedMigration.payload.nonce)
    const txBundle: v2commons.transaction.TransactionBundle = {
      entrypoint: walletAddress,
      transactions: unsignedMigration.payload.calls.map((tx: Payload.Call) => ({
        to: tx.to,
        data: tx.data,
        gasLimit: 0n,
        revertOnError: true,
      })),
      nonce: v2Nonce,
    }
    const { signature } = await v1Wallet.signTransactionBundle(txBundle)
    Hex.assert(signature)

    // Save to tracker
    const signedMigration: State.Migration = {
      ...unsignedMigration,
      fromImageHash: v1ImageHash,
      chainId: Number(chainId),
      signature,
    }
    await this.v3StateProvider.saveMigration(walletAddress, signedMigration)

    // Return v3 wallet
    return new WalletV3(walletAddress, {
      knownContexts: [{ name: 'v3', development: false, ...v3Context }],
      stateProvider: this.v3StateProvider,
    })
  }
}
