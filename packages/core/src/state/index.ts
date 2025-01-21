import { Configuration, Payload } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'

type MaybePromise<T> = T | Promise<T>

export type Signature<Block extends number | undefined = number> =
  | { type: 'eip-712'; signature: Hex.Hex }
  | { type: 'eth_sign'; signature: Hex.Hex }
  | { type: 'erc-1271'; signature: Hex.Hex; validAt: { chainId: bigint; block: Block } }

export interface StateReader {
  getConfiguration(imageHash: Hex.Hex): MaybePromise<Configuration>

  getDeployHash(wallet: Address.Address): MaybePromise<Hex.Hex>

  getWallets(
    signer: Address.Address,
  ): MaybePromise<Array<{ wallet: Address.Address; chainId: bigint; digest: Hex.Hex; signature: Signature }>>

  getConfigurationPath(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): MaybePromise<Array<{ imageHash: Hex.Hex; signature: Hex.Hex }>>
}

export interface StateWriter {
  saveWallet(deployConfiguration: Configuration): MaybePromise<void>

  saveWitness(
    signer: Address.Address,
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload,
    signature: Signature<number | undefined>,
  ): MaybePromise<void>

  setConfiguration(wallet: Address.Address, configuration: Configuration, signature: Hex.Hex): MaybePromise<void>
}

export * from './sessions'
