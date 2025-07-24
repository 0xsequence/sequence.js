import { Hex } from 'ox'
import { Context, Config, Payload, Signature, GenericTree } from '@0xsequence/wallet-primitives'

export type Provider = Reader & Writer

export interface Reader {
  getConfiguration(imageHash: Hex.Hex): MaybePromise<Config.Config | undefined>

  getDeploy(wallet: Address.Address): MaybePromise<{ imageHash: Hex.Hex; context: Context.Context } | undefined>

  getWallets(signer: Address.Address): MaybePromise<{
    [wallet: Address.Address]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }>

  getWalletsForSapient(
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): MaybePromise<{
    [wallet: Address.Address]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSapientSignerLeaf
    }
  }>

  getWitnessFor(
    wallet: Address.Address,
    signer: Address.Address,
  ): MaybePromise<
    { chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } | undefined
  >

  getWitnessForSapient(
    wallet: Address.Address,
    signer: Address.Address,
    imageHash: Hex.Hex,
  ): MaybePromise<
    { chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } | undefined
  >

  getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): MaybePromise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>>

  getTree(rootHash: Hex.Hex): MaybePromise<GenericTree.Tree | undefined>
  getPayload(
    opHash: Hex.Hex,
  ): MaybePromise<{ chainId: bigint; payload: Payload.Parented; wallet: Address.Address } | undefined>
}

export interface Writer {
  saveWallet(deployConfiguration: Config.Config, context: Context.Context): MaybePromise<void>

  saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.RawTopology,
  ): MaybePromise<void>

  saveUpdate(
    wallet: Address.Address,
    configuration: Config.Config,
    signature: Signature.RawSignature,
  ): MaybePromise<void>

  saveTree(tree: GenericTree.Tree): MaybePromise<void>

  saveConfiguration(config: Config.Config): MaybePromise<void>
  saveDeploy(imageHash: Hex.Hex, context: Context.Context): MaybePromise<void>
  savePayload(wallet: Address.Address, payload: Payload.Parented, chainId: bigint): MaybePromise<void>
}

export type MaybePromise<T> = T | Promise<T>

export * as Local from './local/index.js'
export * from './utils.js'
export * as Remote from './remote/index.js'
export * from './cached.js'
export * as Sequence from './sequence/index.js'
export * from './debug.js'
