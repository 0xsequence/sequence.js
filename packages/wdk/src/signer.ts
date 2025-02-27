import { Address, Signature, Hex, Bytes } from 'ox'
import { Signer } from '@0xsequence/sequence-core'
import { AuthKey } from './authkey'
import { IdentityInstrument } from './nitro'
import { Payload, Signature as SequenceSignature } from '@0xsequence/sequence-primitives'

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

  async sign(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
  ): Promise<SequenceSignature.SignatureOfSignerLeaf> {
    const payloadHash = Payload.hash(wallet, chainId, payload)
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
      ...sig,
    }
  }
}
