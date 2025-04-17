import { Address, Hex } from 'ox'
import { SignerActionable, SignerReady, SignerUnavailable, BaseSignatureRequest } from '../types'

export interface Handler {
  kind: string

  onStatusChange(cb: () => void): () => void

  status(
    address: Address.Address,
    imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable>
}

export * from './devices'
export * from './passkeys'
export * from './otp'
export * from './authcode-pkce'
