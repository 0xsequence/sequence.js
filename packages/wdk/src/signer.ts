import { Payload } from '@0xsequence/sequence-primitives'
import { Signer, Signature } from '@0xsequence/sequence-core'
import { AuthKey } from './authkey'
import { IdentityInstrument } from './nitro'

export class IdentitySigner implements Signer {
  constructor(
    readonly ecosystemId: string,
    readonly nitro: IdentityInstrument,
    readonly authKey: AuthKey,
  ) {}

  get address(): `0x${string}` {
    if (!this.authKey.identitySigner) {
      throw new Error('No signer address found')
    }
    return this.authKey.identitySigner
  }

  async sign(payload: Payload): Promise<Signature> {
    if (payload.type !== 'digest') {
      throw new Error(`IdentitySigner cannot sign ${payload.type} payloads`)
    }

    const authKeySignature = await this.authKey.signMessage(payload.digest.toString())
    const params = {
      ecosystemId: this.ecosystemId,
      signer: this.address,
      digest: payload.digest,
      authKey: this.authKey.toProto(),
      signature: authKeySignature,
    }
    const res = await this.nitro.sign({ params })
    return { type: 'hash', signature: res.signature as `0x${string}` }
  }
}
