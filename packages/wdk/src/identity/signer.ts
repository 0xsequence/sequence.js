import { Address, Signature, Hex, Bytes } from 'ox'
import { Signers, State } from '@0xsequence/sequence-core'
import { AuthKey } from './authkey'
import { IdentityInstrument } from './nitro'
import { Payload, Signature as SequenceSignature } from '@0xsequence/sequence-primitives'

export class IdentitySigner implements Signers.Signer {
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
    return this.signDigest(payloadHash)
  }

  async signDigest(digest: Bytes.Bytes): Promise<SequenceSignature.SignatureOfSignerLeafHash> {
    const digestHex = Hex.fromBytes(digest)
    const authKeySignature = await this.authKey.signMessage(digestHex)
    const params = {
      ecosystem: this.ecosystemId,
      signer: this.address,
      digest: digestHex,
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

  async witness(stateWriter: State.Writer, wallet: Address.Address, extra?: Object): Promise<void> {
    const payload = Payload.fromMessage(
      Bytes.fromString(
        JSON.stringify({
          action: 'consent-to-be-part-of-wallet',
          wallet,
          signer: this.address,
          timestamp: Date.now(),
          ...extra,
        }),
      ),
    )

    const signature = await this.sign(wallet, 0n, payload)
    await stateWriter.saveWitnesses(wallet, 0n, payload, {
      type: 'unrecovered-signer',
      weight: 1n,
      signature,
    })
  }
}
