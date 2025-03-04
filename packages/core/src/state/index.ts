import { Address, Hex } from 'ox'
import { Context, WalletConfig, Payload, Signature } from '@0xsequence/sequence-primitives'

export type Provider = Reader & Writer

export interface Reader {
  getConfiguration(imageHash: Hex.Hex): MaybePromise<WalletConfig.Configuration | undefined>

  getDeploy(wallet: Address.Address): MaybePromise<{ imageHash: Hex.Hex; context: Context.Context } | undefined>

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

export interface Writer {
  saveWallet(deployConfiguration: WalletConfig.Configuration, context: Context.Context): MaybePromise<void>

  saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.RawTopology,
  ): MaybePromise<void>

  saveUpdate(
    wallet: Address.Address,
    configuration: WalletConfig.Configuration,
    signature: Signature.RawSignature,
  ): MaybePromise<void>
}

type MaybePromise<T> = T | Promise<T>

export * as Local from './local'
