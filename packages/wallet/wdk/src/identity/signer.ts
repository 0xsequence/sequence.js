import { Address, Signature, Hex, Bytes, PersonalMessage } from 'ox'
import { Signers, State } from '@0xsequence/wallet-core'
import { IdentityInstrument, KeyType } from '@0xsequence/identity-instrument'
import { AuthKey } from '../dbs/auth-keys.js'
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'
import * as Identity from '@0xsequence/identity-instrument'

export function toIdentityAuthKey(authKey: AuthKey): Identity.AuthKey {
  return {
    address: authKey.address,
    keyType: Identity.KeyType.WebCrypto_Secp256r1,
    signer: authKey.identitySigner,
    async sign(digest: Bytes.Bytes) {
      const authKeySignature = await window.crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256',
        },
        authKey.privateKey,
        digest,
      )
      return Hex.fromBytes(new Uint8Array(authKeySignature))
    },
  }
}

export class IdentitySigner implements Signers.Signer {
  constructor(
    readonly identityInstrument: IdentityInstrument,
    readonly authKey: AuthKey,
  ) {}

  get address(): Address.Address {
    if (!Address.validate(this.authKey.identitySigner)) {
      throw new Error('No signer address found')
    }
    return Address.checksum(this.authKey.identitySigner)
  }

  async sign(
    wallet: Address.Address,
    chainId: number,
    payload: Payload.Parented,
  ): Promise<SequenceSignature.SignatureOfSignerLeaf> {
    const payloadHash = Payload.hash(wallet, chainId, payload)
    return this.signDigest(payloadHash)
  }

  async signDigest(digest: Bytes.Bytes): Promise<SequenceSignature.SignatureOfSignerLeafHash> {
    const sigHex = await this.identityInstrument.sign(toIdentityAuthKey(this.authKey), digest)
    const sig = Signature.fromHex(sigHex)
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

    const signature = await this.sign(wallet, 0, payload)
    await stateWriter.saveWitnesses(wallet, 0, payload, {
      type: 'unrecovered-signer',
      weight: 1n,
      signature,
    })
  }
}
