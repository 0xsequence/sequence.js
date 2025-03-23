import { Hex, Bytes, Address } from 'ox'
import { Payload, Extensions } from '@0xsequence/sequence-primitives'
import type { Signature as SignatureTypes } from '@0xsequence/sequence-primitives'
import { WebAuthnP256 } from 'ox'
import { State } from '..'
import { SapientSigner, Witnessable } from '.'

export type PasskeyOptions = {
  extensions: Pick<Extensions.Extensions, 'passkeys'>
  publicKey: Extensions.Passkeys.PublicKey
  credentialId: string
  embedMetadata?: boolean
  metadata?: Extensions.Passkeys.PasskeyMetadata
}

export type CreaetePasskeyOptions = {
  stateProvider?: State.Provider
  requireUserVerification?: boolean
  credentialName?: string
  embedMetadata?: boolean
}

export type WitnessMessage = {
  action: 'consent-to-be-part-of-wallet'
  wallet: Address.Address
  publicKey: Extensions.Passkeys.PublicKey
  timestamp: number
  metadata?: Extensions.Passkeys.PasskeyMetadata
}

export function isWitnessMessage(message: unknown): message is WitnessMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'action' in message &&
    message.action === 'consent-to-be-part-of-wallet'
  )
}

export class Passkey implements SapientSigner, Witnessable {
  public readonly credentialId: string

  public readonly publicKey: Extensions.Passkeys.PublicKey
  public readonly address: Address.Address
  public readonly imageHash: Hex.Hex
  public readonly embedMetadata: boolean
  public readonly metadata?: Extensions.Passkeys.PasskeyMetadata

  constructor(options: PasskeyOptions) {
    this.address = options.extensions.passkeys
    this.publicKey = options.publicKey
    this.credentialId = options.credentialId
    this.embedMetadata = options.embedMetadata ?? false
    this.imageHash = Extensions.Passkeys.rootFor(options.publicKey)
    this.metadata = options.metadata
  }

  static async loadFromWitness(
    stateReader: State.Reader,
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
    wallet: Address.Address,
    imageHash: Hex.Hex,
  ) {
    // In the witness we will find the public key, and may find the credential id
    const witness = await stateReader.getWitnessForSapient(wallet, extensions.passkeys, imageHash)
    if (!witness) {
      throw new Error('Witness for wallet not found')
    }

    const payload = witness.payload
    if (!Payload.isMessage(payload)) {
      throw new Error('Witness payload is not a message')
    }

    const message = JSON.parse(Bytes.toString(payload.message))
    if (!isWitnessMessage(message)) {
      throw new Error('Witness payload is not a witness message')
    }

    const metadata = message.publicKey.metadata || message.metadata
    if (typeof metadata === 'string' || !metadata) {
      throw new Error('Metadata does not contain credential id')
    }

    const decodedSignature = Extensions.Passkeys.decode(witness.signature.data)

    return new Passkey({
      credentialId: metadata.credentialId,
      extensions,
      publicKey: message.publicKey,
      embedMetadata: decodedSignature.embedMetadata,
      metadata,
    })
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
      credentialId: credential.id,
      name,
      createdAt: Date.now(),
    }

    const passkey = new Passkey({
      credentialId: credential.id,
      extensions,
      publicKey: {
        requireUserVerification: options?.requireUserVerification ?? true,
        x,
        y,
        metadata: options?.embedMetadata ? metadata : undefined,
      },
      embedMetadata: options?.embedMetadata,
      metadata,
    })

    if (options?.stateProvider) {
      await options.stateProvider.saveTree(Extensions.Passkeys.toTree(passkey.publicKey))
    }

    return passkey
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
      embedMetadata: this.embedMetadata,
    })

    return {
      address: this.address,
      data: signature,
      type: 'sapient_compact',
    }
  }

  async witness(stateWriter: State.Writer, wallet: Address.Address, extra?: Object): Promise<void> {
    const payload = Payload.fromMessage(
      Bytes.fromString(
        JSON.stringify({
          action: 'consent-to-be-part-of-wallet',
          wallet,
          publicKey: this.publicKey,
          metadata: this.metadata,
          timestamp: Date.now(),
          ...extra,
        } as WitnessMessage),
      ),
    )

    const signature = await this.signSapient(wallet, 0n, payload, this.imageHash)
    await stateWriter.saveWitnesses(wallet, 0n, payload, {
      type: 'unrecovered-signer',
      weight: 1n,
      signature,
    })
  }
}
