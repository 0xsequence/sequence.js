import { Address, Signature, Hex, Bytes } from 'ox'
import { Signers, State, type CryptoLike } from '@0xsequence/wallet-core'
import { IdentityInstrument } from '@0xsequence/identity-instrument'
import { AuthKey } from '../dbs/auth-keys.js'
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'
import * as Identity from '@0xsequence/identity-instrument'

function normalizeWebCryptoP256Signature(signature: Uint8Array): Uint8Array {
  if (signature.length === 64) {
    return signature
  }

  if (signature.length < 8 || signature[0] !== 0x30) {
    throw new Error('unsupported-webcrypto-signature-format')
  }

  const sequenceLength = signature[1]
  if (sequenceLength === undefined) {
    throw new Error('invalid-webcrypto-signature-length')
  }
  if (sequenceLength + 2 !== signature.length) {
    throw new Error('invalid-webcrypto-signature-length')
  }

  let offset = 2
  const readInteger = (): Uint8Array => {
    if (signature[offset] !== 0x02) {
      throw new Error('invalid-webcrypto-signature-integer-tag')
    }
    offset += 1

    const length = signature[offset]
    if (length === undefined) {
      throw new Error('invalid-webcrypto-signature-length')
    }
    offset += 1

    const value = signature.slice(offset, offset + length)
    offset += length

    let normalized = value
    while (normalized.length > 0 && normalized[0] === 0x00) {
      normalized = normalized.slice(1)
    }

    if (normalized.length > 32) {
      throw new Error('invalid-webcrypto-signature-integer-size')
    }

    const padded = new Uint8Array(32)
    padded.set(normalized, 32 - normalized.length)
    return padded
  }

  const r = readInteger()
  const s = readInteger()

  if (offset !== signature.length) {
    throw new Error('invalid-webcrypto-signature-trailing-bytes')
  }

  const compact = new Uint8Array(64)
  compact.set(r, 0)
  compact.set(s, 32)
  return compact
}

export function toIdentityAuthKey(authKey: AuthKey, crypto?: CryptoLike): Identity.AuthKey {
  const globalObj = globalThis as any
  const resolvedCrypto = crypto ?? globalObj.window?.crypto ?? globalObj.crypto
  if (!resolvedCrypto?.subtle) {
    throw new Error('crypto.subtle is not available')
  }
  return {
    address: authKey.address,
    keyType: Identity.KeyType.WebCrypto_Secp256r1,
    signer: authKey.identitySigner,
    async sign(digest: Bytes.Bytes) {
      const authKeySignature = await resolvedCrypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256',
        },
        authKey.privateKey,
        new Uint8Array(digest),
      )
      return Hex.fromBytes(normalizeWebCryptoP256Signature(new Uint8Array(authKeySignature)))
    },
  }
}

export class IdentitySigner implements Signers.Signer {
  constructor(
    readonly identityInstrument: IdentityInstrument,
    readonly authKey: AuthKey,
    private readonly crypto?: CryptoLike,
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
    const sigHex = await this.identityInstrument.sign(toIdentityAuthKey(this.authKey, this.crypto), digest)
    const sig = Signature.fromHex(sigHex)
    return {
      type: 'hash',
      ...sig,
    }
  }

  async witness(stateWriter: State.Writer, wallet: Address.Address, extra?: object): Promise<void> {
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
