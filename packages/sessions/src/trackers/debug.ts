import { commons } from '@0xsequence/core'
import { migrator } from '@0xsequence/migration'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'
import { ethers } from 'ethers'
import { bigintReplacer } from '@0xsequence/utils'

export class DebugConfigTracker implements ConfigTracker, migrator.PresignedMigrationTracker {
  constructor(private readonly tracker: ConfigTracker & migrator.PresignedMigrationTracker) {}

  async loadPresignedConfiguration(args: {
    wallet: string
    fromImageHash: string
    longestPath?: boolean
  }): Promise<PresignedConfigLink[]> {
    console.debug('? loadPresignedConfiguration')
    debug(args, '? ')
    return debug(await this.tracker.loadPresignedConfiguration(args), '! ')
  }

  savePresignedConfiguration(args: PresignedConfig): Promise<void> {
    console.debug('? savePresignedConfiguration')
    debug(args, '? ')
    return this.tracker.savePresignedConfiguration(args)
  }

  saveWitnesses(args: { wallet: string; digest: string; chainId: ethers.BigNumberish; signatures: string[] }): Promise<void> {
    console.debug('? saveWitnesses')
    debug(args, '? ')
    return this.tracker.saveWitnesses(args)
  }

  async configOfImageHash(args: { imageHash: string }): Promise<commons.config.Config | undefined> {
    console.debug('? configOfImageHash')
    debug(args, '? ')
    return debug(await this.tracker.configOfImageHash(args), '! ')
  }

  saveWalletConfig(args: { config: commons.config.Config }): Promise<void> {
    console.debug('? saveWalletConfig')
    debug(args, '? ')
    return this.tracker.saveWalletConfig(args)
  }

  async imageHashOfCounterfactualWallet(args: {
    wallet: string
  }): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> {
    console.debug('? imageHashOfCounterfactualWallet')
    debug(args, '? ')
    return debug(await this.tracker.imageHashOfCounterfactualWallet(args), '! ')
  }

  saveCounterfactualWallet(args: { config: commons.config.Config; context: commons.context.WalletContext[] }): Promise<void> {
    console.debug('? saveCounterfactualWallet')
    debug(args, '? ')
    return this.tracker.saveCounterfactualWallet(args)
  }

  async walletsOfSigner(args: {
    signer: string
  }): Promise<{ wallet: string; proof: { digest: string; chainId: bigint; signature: string } }[]> {
    console.debug('? walletsOfSigner')
    debug(args, '? ')
    return debug(await this.tracker.walletsOfSigner(args), '! ')
  }

  async getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<migrator.SignedMigration | undefined> {
    console.debug('? getMigration')
    debug({ address, fromImageHash, fromVersion, chainId }, '? ')
    return debug(await this.tracker.getMigration(address, fromImageHash, fromVersion, chainId), '! ')
  }

  saveMigration(address: string, signed: migrator.SignedMigration, contexts: commons.context.VersionedContext): Promise<void> {
    console.debug('? saveMigration')
    debug({ address, signed, contexts }, '? ')
    return this.tracker.saveMigration(address, signed, contexts)
  }
}

function debug<T>(value: T, prefix: string = ''): T {
  switch (value) {
    case undefined:
      console.debug(prefix + 'undefined')
      break
    default:
      JSON.stringify(value, bigintReplacer, 2)
        .split('\n')
        .map(line => prefix + line)
        .forEach(line => console.debug(line))
      break
  }
  return value
}
