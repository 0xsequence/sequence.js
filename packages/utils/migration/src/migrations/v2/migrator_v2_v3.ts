import { v2, commons as v2commons } from '@0xsequence/v2core'
import { WalletV2 } from '@0xsequence/v2wallet'
import { State, Wallet as WalletV3 } from '@0xsequence/wallet-core'
import { Payload, Context as V3Context } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Migrator } from '../index.js'
import { ConvertOptions, MigrationEncoder_v2v3, PrepareOptions } from './encoder_v2_v3.js'

export type MigratorV2V3Options = ConvertOptions &
  PrepareOptions & {
    v3Context?: V3Context.Context
  }

function encodeV2ConfigTree(tree: v2.config.Topology): any {
  if (v2.config.isNode(tree)) {
    return {
      left: encodeV2ConfigTree(tree.left),
      right: encodeV2ConfigTree(tree.right),
    }
  } else if (v2.config.isSignerLeaf(tree)) {
    return {
      weight: Number(tree.weight),
      address: tree.address,
    }
  } else if (v2.config.isNestedLeaf(tree)) {
    return {
      weight: Number(tree.weight),
      threshold: Number(tree.threshold),
      tree: encodeV2ConfigTree(tree.tree),
    }
  } else if (v2.config.isNodeLeaf(tree)) {
    return { node: tree.nodeHash }
  } else {
    return { ...tree }
  }
}

export class Migrator_v2v3 implements Migrator<WalletV2, WalletV3, MigratorV2V3Options> {
  fromVersion = 2
  toVersion = 3

  constructor(
    private readonly v3StateProvider: State.Provider,
    private readonly encoder: MigrationEncoder_v2v3 = new MigrationEncoder_v2v3(),
  ) {}

  private convertV2Context(v2Wallet: v2commons.context.WalletContext): V3Context.Context & { guest?: Address.Address } {
    Hex.assert(v2Wallet.walletCreationCode)
    return {
      factory: Address.from(v2Wallet.factory),
      stage1: Address.from(v2Wallet.mainModule),
      stage2: Address.from(v2Wallet.mainModuleUpgradable),
      creationCode: v2Wallet.walletCreationCode,
      guest: Address.from(v2Wallet.guestModule),
    }
  }

  async convertWallet(v2Wallet: WalletV2, options: MigratorV2V3Options): Promise<WalletV3> {
    // Prepare configuration
    const walletAddress = Address.from(v2Wallet.address)
    const v3Context = options.v3Context || V3Context.Rc3
    const v2Config = v2Wallet.config
    const v3Config = await this.encoder.convertConfig(v2Config, options)

    // Save v2 wallet information to v3 state provider
    const v2ImageHash = v2.config.ConfigCoder.imageHashOf(v2Config)
    Hex.assert(v2ImageHash)
    if (this.v3StateProvider instanceof State.Sequence.Provider) {
      // Force save the v2 configuration to key machine
      const v2ServiceConfig = encodeV2ConfigTree(v2Config.tree)
      await this.v3StateProvider.forceSaveConfiguration(v2ServiceConfig, this.fromVersion)
    }
    await this.v3StateProvider.saveDeploy(v2ImageHash, this.convertV2Context(v2Wallet.context))
    await this.v3StateProvider.saveConfiguration(v3Config)

    // Prepare migration
    const unsignedMigration = await this.encoder.prepareMigration(
      walletAddress,
      { [this.toVersion]: v3Context },
      v3Config,
      options,
    )

    // Sign migration
    const chainId = v2Wallet.chainId
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
    const { signature } = await v2Wallet.signTransactionBundle(txBundle)
    Hex.assert(signature)

    // Save to tracker
    const signedMigration: State.Migration = {
      ...unsignedMigration,
      fromImageHash: v2ImageHash,
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
