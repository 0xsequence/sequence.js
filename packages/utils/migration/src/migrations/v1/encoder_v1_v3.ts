import { v1 } from '@0xsequence/v2core'
import { Config as V3Config, Context as V3Context } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import { UnsignedMigration } from '../../types.js'
import { MigrationEncoder } from '../index.js'
import { BaseMigrationEncoder_v1v2, PrepareOptions as BasePrepareOptions } from '../v2/base.js'
import { ConvertOptions as V3ConvertOptions, createDefaultV3Topology } from '../v3/config.js'

export type ConvertOptions = V3ConvertOptions
export type PrepareOptions = BasePrepareOptions

// uint160(keccak256("org.sequence.sdk.migration.v1v3.space.nonce"))
export const MIGRATION_V1_V3_NONCE_SPACE = '0x9e4d5bdafd978baf1290aff23057245a2a62bef5'

export class MigrationEncoder_v1v3
  extends BaseMigrationEncoder_v1v2
  implements
    MigrationEncoder<v1.config.WalletConfig, V3Config.Config, V3Context.Context, ConvertOptions, PrepareOptions>
{
  fromVersion = 1
  toVersion = 3

  async convertConfig(fromConfig: v1.config.WalletConfig, options: ConvertOptions): Promise<V3Config.Config> {
    if (fromConfig.version !== 1) {
      throw new Error('Invalid v1 config')
    }
    const signerLeaves: V3Config.SignerLeaf[] = fromConfig.signers.map((signer) => ({
      type: 'signer',
      address: Address.from(signer.address),
      weight: BigInt(signer.weight),
    }))
    const v1NestedTopology = V3Config.flatLeavesToTopology(signerLeaves)
    return {
      threshold: 1n,
      checkpoint: 0n,
      topology: [
        {
          type: 'nested',
          weight: 1n,
          threshold: BigInt(fromConfig.threshold),
          tree: v1NestedTopology,
        },
        {
          type: 'nested',
          weight: 1n,
          threshold: 2n,
          tree: createDefaultV3Topology(options),
        },
      ],
    }
  }

  async prepareMigration(
    walletAddress: Address.Address,
    toContext: V3Context.Context,
    toConfig: V3Config.Config,
    options: PrepareOptions,
  ): Promise<UnsignedMigration> {
    options.space = options.space ?? BigInt(MIGRATION_V1_V3_NONCE_SPACE)

    return super.prepareMigrationToImplementation(walletAddress, toContext.stage2, toConfig, options)
  }
}
