import { Address } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'
import { SignerActionable, SignerReady, SignerUnavailable, BaseSignatureRequest } from '../types/index.js'

export interface Handler {
  kind: string

  onStatusChange(cb: () => void): () => void

  status(
    address: Address.Checksummed,
    imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable>
}
