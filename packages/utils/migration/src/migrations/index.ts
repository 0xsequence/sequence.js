import { State } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { UnsignedMigration, VersionedContext } from '../types.js'
import { MigrationEncoder_v1v3 } from './v1/migration_v1_v3.js'

export interface MigrationEncoder<FromConfigType, ToConfigType, ConvertOptionsType, PrepareOptionsType> {
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
   * @param options The prepare options
   * @returns The migration payload to be signed
   */
  prepareMigration: (
    walletAddress: Address.Address,
    contexts: VersionedContext,
    toConfig: ToConfigType,
    options: PrepareOptionsType,
  ) => Promise<UnsignedMigration>

  /**
   * Encodes the a transaction for a given migration
   * @param migration The migration to encode the transaction for
   * @returns The encoded transaction
   */
  toTransactionData: (migration: State.Migration) => Promise<{
    to: Address.Address
    data: Hex.Hex
  }>

  /**
   * Decodes the payload from a migration
   * @param payload The payload to decode
   * @returns The decoded address and resulting image hash for the migration payload
   */
  decodePayload: (payload: Payload.Calls) => Promise<{
    address: Address.Address
    toImageHash: Hex.Hex
  }>
}

export interface Migrator<FromWallet, ToWallet, ConvertOptionsType> {
  fromVersion: number
  toVersion: number

  convertWallet: (fromWallet: FromWallet, options: ConvertOptionsType) => Promise<ToWallet>
}

export const encoders: MigrationEncoder<any, any, any, any>[] = [new MigrationEncoder_v1v3()]

export function getMigrationEncoder<FromConfigType, ToConfigType, ConvertOptionsType, PrepareOptionsType>(
  fromVersion: number,
  toVersion: number,
): MigrationEncoder<FromConfigType, ToConfigType, ConvertOptionsType, PrepareOptionsType> {
  const encoder = encoders.find((encoder) => encoder.fromVersion === fromVersion && encoder.toVersion === toVersion)
  if (!encoder) {
    throw new Error(`Unsupported from version: ${fromVersion} to version: ${toVersion}`)
  }
  return encoder
}
