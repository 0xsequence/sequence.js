import { Address, Hex } from 'ox'
import { Context, WalletConfig, Payload, Signature } from '@0xsequence/sequence-primitives'

export type StateProvider = StateReader & StateWriter

export interface StateReader {
  getConfiguration(imageHash: Hex.Hex): MaybePromise<WalletConfig.Configuration>

  getDeployHash(wallet: Address.Address): MaybePromise<{ deployHash: Hex.Hex; context: Context.Context }>

  getWallets(signer: Address.Address): MaybePromise<{
    [wallet: Address.Address]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }>

  getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): MaybePromise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>>
}

export interface StateWriter {
  saveWallet(deployConfiguration: WalletConfig.Configuration, context: Context.Context): MaybePromise<void>

  saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.SignatureOfSignerLeaf[],
  ): MaybePromise<void>

  setConfiguration(
    wallet: Address.Address,
    configuration: WalletConfig.Configuration,
    signature: Signature.RawSignature,
  ): MaybePromise<void>
}

type MaybePromise<T> = T | Promise<T>

export * from './memory'
