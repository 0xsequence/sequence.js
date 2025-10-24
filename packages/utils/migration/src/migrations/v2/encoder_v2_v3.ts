import { v2 } from '@0xsequence/v2core'
import { Config as V3Config, Context as V3Context } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import { UnsignedMigration, VersionedContext } from '../../types.js'
import { MigrationEncoder } from '../index.js'
import { ConvertOptions as V3ConvertOptions, createDefaultV3Topology } from '../v3/config.js'
import { BaseMigrationEncoder_v1v2, PrepareOptions as BasePrepareOptions } from './base.js'
import { convertTreeToTopology } from './config.js'

export type PrepareOptions = BasePrepareOptions
export type ConvertOptions = V3ConvertOptions

// uint160(keccak256("org.sequence.sdk.migration.v2v3.space.nonce"))
export const MIGRATION_V2_V3_NONCE_SPACE = '0xf9fe6701dd3716c9cdb4faf375921627b507d142'

export class MigrationEncoder_v2v3
  extends BaseMigrationEncoder_v1v2
  implements MigrationEncoder<v2.config.WalletConfig, V3Config.Config, ConvertOptions, PrepareOptions>
{
  fromVersion = 2
  toVersion = 3

  async prepareMigration(
    walletAddress: Address.Address,
    contexts: VersionedContext,
    toConfig: V3Config.Config,
    options: PrepareOptions,
  ): Promise<UnsignedMigration> {
    const v3Context = contexts[3] || V3Context.Rc3
    if (!V3Context.isContext(v3Context)) {
      throw new Error('Invalid context')
    }

    options.space = options.space ?? BigInt(MIGRATION_V2_V3_NONCE_SPACE)

    return super.prepareMigrationToImplementation(walletAddress, v3Context.stage2, toConfig, options)
  }

  async convertConfig(fromConfig: v2.config.WalletConfig, options: ConvertOptions): Promise<V3Config.Config> {
    if (fromConfig.version !== 2) {
      throw new Error('Invalid v2 config')
    }
    const v2ConfigTopology: V3Config.Topology = convertTreeToTopology(fromConfig.tree)
    return {
      threshold: 1n,
      checkpoint: 0n,
      topology: [
        {
          type: 'nested',
          weight: 1n,
          threshold: BigInt(fromConfig.threshold),
          tree: v2ConfigTopology,
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
}
