import { Configuration, Payload } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'

export interface Signer {
  readonly address: Address.Address | Promise<Address.Address>

  sign(
    payload: Payload,
  ):
    | Promise<Hex.Hex>
    | { signature: Promise<Hex.Hex>; onSignerSignature?: SignerSignatureCallback; onCancel?: CancelCallback }
}

export type SignerSignatureCallback = (configuration: Configuration, signatures: Map<Address.Address, Hex.Hex>) => void

export type CancelCallback = (success: boolean) => void
