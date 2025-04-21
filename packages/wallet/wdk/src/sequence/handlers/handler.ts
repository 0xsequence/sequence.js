import { Address, Hex } from 'ox'
import { BaseSignatureRequest, SignerActionable, SignerReady, SignerUnavailable } from '../types'

export interface Handler {
  kind: string

  onStatusChange(cb: () => void): () => void

  status(
    address: Address.Address,
    imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable>
}
