import { Address, Bytes, Signature } from 'ox'
import * as Client from './client/guard.gen.js'

export interface Guard {
  readonly address: Address.Address

  signPayload(
    wallet: Address.Address,
    chainId: number,
    type: Client.PayloadType,
    digest: Bytes.Bytes,
    message: Bytes.Bytes,
    signatures?: Client.Signature[],
    token?: Client.AuthToken,
  ): Promise<Signature.Signature>
}

export class AuthRequiredError extends Error {
  public readonly id: 'TOTP' | 'PIN'

  constructor(id: 'TOTP' | 'PIN') {
    super('auth required')
    this.id = id
    this.name = 'AuthRequiredError'
    Object.setPrototypeOf(this, AuthRequiredError.prototype)
  }
}
