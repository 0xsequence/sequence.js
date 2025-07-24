import { Config, Payload, Signature } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'
import * as State from '../state/index.js'

export * as Pk from './pk/index.js'
export * as Passkey from './passkey.js'
export * as Session from './session/index.js'
export * from './session-manager.js'

export interface Signer {
  readonly address: MaybePromise<Address.Checksummed>

  sign: (
    wallet: Address.Checksummed,
    chainId: bigint,
    payload: Payload.Parented,
  ) => Config.SignerSignature<Signature.SignatureOfSignerLeaf>
}

export interface SapientSigner {
  readonly address: MaybePromise<Address.Checksummed>
  readonly imageHash: MaybePromise<Hex.Hex | undefined>

  signSapient: (
    wallet: Address.Checksummed,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ) => Config.SignerSignature<Signature.SignatureOfSapientSignerLeaf>
}

export interface Witnessable {
  witness: (stateWriter: State.Writer, wallet: Address.Checksummed, extra?: Object) => Promise<void>
}

type MaybePromise<T> = T | Promise<T>

export function isSapientSigner(signer: Signer | SapientSigner): signer is SapientSigner {
  return 'signSapient' in signer
}

export function isSigner(signer: Signer | SapientSigner): signer is Signer {
  return 'sign' in signer
}
