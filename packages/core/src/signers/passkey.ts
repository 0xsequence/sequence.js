import { Hex, Bytes, Address } from 'ox'
import { SapientSigner } from '../wallet'
import { Payload, Extensions } from '@0xsequence/sequence-primitives'
import type { Signature as SignatureTypes } from '@0xsequence/sequence-primitives'
import { WebAuthnP256 } from 'ox'
import { keccak256 } from 'ox/Hash'

export type PasskeyOptions = {
  extensions: Pick<Extensions.Extensions, 'passkeys'>
  publicKey: Extensions.Passkeys.PublicKey
  credentialId: string
  metadata?: PasskeyMetadata
}

export type CreaetePasskeyOptions = {
  requireUserVerification?: boolean
  credentialName?: string
  noEmbedMetadata?: boolean
}

export type PasskeyMetadata = {
  name: string
  createdAt: number
}

function metadataHash(metadata: PasskeyMetadata): Hex.Hex {
  const a = keccak256(Bytes.fromString(metadata.name))
  const b = keccak256(Bytes.fromNumber(metadata.createdAt))
  return Hex.fromBytes(keccak256(Bytes.concat(a, b)))
}

export class Passkey implements SapientSigner {
  public readonly credentialId: string

  public readonly publicKey: Extensions.Passkeys.PublicKey
  public readonly address: Address.Address
  public readonly imageHash: Hex.Hex

  constructor(options: PasskeyOptions) {
    this.imageHash = Extensions.Passkeys.rootFor(options.publicKey)
    this.address = options.extensions.passkeys
    this.publicKey = options.publicKey
    this.credentialId = options.credentialId
  }

  static async create(extensions: Pick<Extensions.Extensions, 'passkeys'>, options?: CreaetePasskeyOptions) {
    const name = options?.credentialName ?? `Sequence (${Date.now()})`

    const credential = await WebAuthnP256.createCredential({
      user: {
        name,
      },
    })

    const x = Hex.fromNumber(credential.publicKey.x)
    const y = Hex.fromNumber(credential.publicKey.y)

    const metadata = {
      name,
      createdAt: Date.now(),
    }

    return new Passkey({
      credentialId: credential.id,
      extensions,
      publicKey: {
        requireUserVerification: options?.requireUserVerification ?? true,
        x,
        y,
        metadata: options?.noEmbedMetadata ? undefined : metadataHash(metadata),
      },
    })
  }

  async signSapient(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ): Promise<SignatureTypes.SignatureOfSapientSignerLeaf> {
    if (this.imageHash !== imageHash) {
      // TODO: This should never get called, why do we have this?
      throw new Error('Unexpected image hash')
    }

    const challenge = Hex.fromBytes(Payload.hash(wallet, chainId, payload))

    const response = await WebAuthnP256.sign({
      challenge,
      credentialId: this.credentialId,
      userVerification: this.publicKey.requireUserVerification ? 'required' : 'discouraged',
    })

    const authenticatorData = Bytes.fromHex(response.metadata.authenticatorData)
    const rBytes = Bytes.fromNumber(response.signature.r)
    const sBytes = Bytes.fromNumber(response.signature.s)

    const signature = Extensions.Passkeys.encode({
      publicKey: this.publicKey,
      r: rBytes,
      s: sBytes,
      authenticatorData,
      clientDataJSON: response.metadata.clientDataJSON,
    })

    return {
      address: this.address,
      data: signature,
      type: 'sapient_compact',
    }
  }
}
