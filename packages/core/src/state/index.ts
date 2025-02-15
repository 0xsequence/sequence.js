import {
  Configuration,
  Context,
  ParentedPayload,
  RawSignature,
  SignatureOfSignerLeaf,
} from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'

export type StateProvider = StateReader & StateWriter

export interface StateReader {
  getConfiguration(imageHash: Hex.Hex): MaybePromise<Configuration>

  getDeployHash(wallet: Address.Address): MaybePromise<{ deployHash: Hex.Hex; context: Context }>

  getWallets(signer: Address.Address): MaybePromise<{
    [wallet: Address.Address]: { chainId: bigint; payload: ParentedPayload; signature: SignatureOfSignerLeaf }
  }>

  getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): MaybePromise<Array<{ imageHash: Hex.Hex; signature: RawSignature }>>
}

export interface StateWriter {
  saveWallet(deployConfiguration: Configuration, context: Context): MaybePromise<void>

  saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: ParentedPayload,
    signatures: SignatureOfSignerLeaf[],
  ): MaybePromise<void>

  setConfiguration(wallet: Address.Address, configuration: Configuration, signature: RawSignature): MaybePromise<void>
}

type MaybePromise<T> = T | Promise<T>

export * from './memory'
