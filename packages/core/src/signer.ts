import { Configuration, Payload } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'

export interface Signer {
  readonly address: Address.Address | Promise<Address.Address>

  sign(
    payload: Payload,
  ):
    | Promise<Signature>
    | { signature: Promise<Signature>; onSignerSignature?: SignerSignatureCallback; onCancel?: CancelCallback }
}

export type Signature =
  | { type: 'digest'; signature: Hex.Hex }
  | { type: 'eth_sign'; signature: Hex.Hex }
  | { type: 'erc-1271'; address: Address.Address; signature: Hex.Hex }
  | { type: 'sapient'; address: Address.Address; signature: Hex.Hex }
  | { type: 'sapient-compact'; address: Address.Address; signature: Hex.Hex }

export type SignerSignatureCallback = (
  configuration: Configuration,
  signatures: Map<Address.Address, Signature>,
  validated: boolean,
) => void

export type CancelCallback = (success: boolean) => void
