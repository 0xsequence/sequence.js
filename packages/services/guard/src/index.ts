import { Address, Hex, Bytes, Signature } from 'ox'

export interface GuardSigner {
  readonly address: Address.Address

  sign(wallet: Address.Address, chainId: bigint, digest: Bytes.Bytes, message: Hex.Hex): Promise<Signature.Signature>
}

export * as Sequence from './sequence.js'
export * as Local from './local.js'
