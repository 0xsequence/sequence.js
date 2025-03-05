import { Hex, Bytes, Address } from 'ox'
import { SapientSigner } from '../wallet'
import { Payload, Extensions } from '@0xsequence/sequence-primitives'
import type { Signature as SignatureTypes } from '@0xsequence/sequence-primitives'
import { WebAuthnP256 } from 'ox'

export type PasskeyOptions = {
  extensions: Pick<Extensions.Extensions, 'passkeys'>
  publicKey: Extensions.Passkeys.PublicKey
  credentialId: string
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

  static async create(
    name: string,
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
    options: { requireUserVerification: boolean } = { requireUserVerification: true },
  ) {
    // Use WebAuthnP256's built-in secure challenge generation
    const credential = await WebAuthnP256.createCredential({
      user: {
        name: `Sequence (${name})`,
      },
    })

    const x = Hex.fromNumber(credential.publicKey.x)
    const y = Hex.fromNumber(credential.publicKey.y)

    return new Passkey({
      credentialId: credential.id,
      extensions,
      publicKey: {
        requireUserVerification: options.requireUserVerification,
        x,
        y,
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
