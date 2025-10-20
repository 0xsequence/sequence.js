import { Address, Hex } from 'ox'
import { UnsignedMigration, VersionedContext } from '../migrator.js'
import { Migration_v1v3 } from './v1/migration_v1_v3.js'

export interface Migration<FromConfigType, ToConfigType, ConvertOptionsType> {
  fromVersion: number
  toVersion: number

  /**
   * Converts from `FromConfigType` to `ToConfigType`
   * @param fromConfig The configuration to convert from
   * @param options The convert options
   * @returns The converted configuration
   */
  convertConfig: (fromConfig: FromConfigType, options: ConvertOptionsType) => Promise<ToConfigType>

  /**
   * Prepares a migration for a given wallet address and context
   * @param walletAddress The wallet address to prepare the migration for
   * @param contexts The contexts to prepare the migration for
   * @param toConfig The configuration to prepare the migration for
   * @returns The prepared migration
   */
  prepareMigration: (
    walletAddress: Address.Address,
    contexts: VersionedContext,
    toConfig: ToConfigType,
  ) => Promise<UnsignedMigration>

  /**
   * Decodes the transactions from a migration
   * @param transactions The transactions to decode
   * @returns The decoded address and resulting image hash for the migration transactions
   */
  decodeTransactions: (transactions: UnsignedMigration['transactions']) => Promise<{
    address: Address.Address
    toImageHash: Hex.Hex
  }>
}

export interface Migrator<FromWallet, ToWallet, ConvertOptionsType> {
  fromVersion: number
  toVersion: number

  convertWallet: (fromWallet: FromWallet, options: ConvertOptionsType) => Promise<ToWallet>
}

export const v1v3 = new Migration_v1v3()
