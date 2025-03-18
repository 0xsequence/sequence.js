import { Config, Payload, Signature } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'
import { State } from '..'

export * as Pk from './pk/index'
export * as Passkey from './passkey'
export * as Session from './session'
export * from './session-manager'

export interface Signer {
  readonly address: MaybePromise<Address.Address>

  sign: (
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
  ) => Config.SignerSignature<Signature.SignatureOfSignerLeaf>
}

export interface SapientSigner {
  readonly address: MaybePromise<Address.Address>
  readonly imageHash: MaybePromise<Hex.Hex | undefined>

  signSapient: (
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ) => Config.SignerSignature<Signature.SignatureOfSapientSignerLeaf>
}

export interface Witnessable {
  witness: (stateWriter: State.Writer, wallet: Address.Address) => Promise<void>
}

type MaybePromise<T> = T | Promise<T>
