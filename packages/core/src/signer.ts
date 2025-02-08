import { Configuration, Payload } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'

export interface Signer {
  readonly address: Address.Address | Promise<Address.Address>

  sign(
    payload: Payload,
  ):
    | Signature
    | Promise<Signature>
    | { signature: Promise<Signature>; onSignerSignature?: SignerSignatureCallback; onCancel?: CancelCallback }
}

export type Signature = { type: 'hash' | 'eth_sign' | 'erc-1271' | 'sapient' | 'sapient-compact'; signature: Hex.Hex }

export type SignerSignatureCallback = (
  configuration: Configuration,
  signatures: Map<Address.Address, Signature>,
  validated: boolean,
) => void

export type CancelCallback = (success: boolean) => void
