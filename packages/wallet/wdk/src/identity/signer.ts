import { Address, Signature, Hex, Bytes, PersonalMessage } from 'ox'
import { Signers, State } from '@0xsequence/wallet-core'
import { AuthKey } from '../dbs/auth-keys.js'
import { IdentityInstrument, KeyType } from './nitro/index.js'
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'

export class IdentitySigner implements Signers.Signer {
  constructor(
    readonly nitro: IdentityInstrument,
    readonly authKey: AuthKey,
  ) {}

  get address(): `0x${string}` {
    if (!Address.validate(this.authKey.identitySigner)) {
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
    const authKeySignature = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      this.authKey.privateKey,
      digest,
    )
    const params = {
      signer: this.address,
      digest: Hex.fromBytes(digest),
      authKey: {
        publicKey: this.authKey.address,
        keyType: KeyType.P256R1,
      },
      signature: Hex.fromBytes(new Uint8Array(authKeySignature)),
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
      Hex.fromString(
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
