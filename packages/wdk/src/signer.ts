import { Address, Signature, Hex, Bytes } from 'ox'
import { ParentedPayload, SignatureOfSignerLeaf, hash } from '@0xsequence/sequence-primitives'
import { Signer } from '@0xsequence/sequence-core'
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

  async sign(wallet: Address.Address, chainId: bigint, payload: ParentedPayload) {
    const payloadHash = hash(wallet, chainId, payload)
    const authKeySignature = await this.authKey.signMessage(payloadHash.toString())
    const params = {
      ecosystemId: this.ecosystemId,
      signer: this.address,
      digest: payloadHash.toString(),
      authKey: this.authKey.toProto(),
      signature: authKeySignature,
    }
    const res = await this.nitro.sign({ params })
    Hex.assert(res.signature)
    const sig = Signature.fromHex(res.signature)
    return {
      type: 'hash',
      r: Bytes.fromNumber(sig.r),
      s: Bytes.fromNumber(sig.s),
      v: sig.yParity,
    } as SignatureOfSignerLeaf
  }
}
