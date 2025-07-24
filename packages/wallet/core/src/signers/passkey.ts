import { Hex, Bytes, P256, Hash } from 'ox'
import { Payload, Extensions } from '@0xsequence/wallet-primitives'
import type { Signature as SignatureTypes } from '@0xsequence/wallet-primitives'
import { WebAuthnP256 } from 'ox'
import { State } from '../index.js'
import { SapientSigner, Witnessable } from './index.js'

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

    const message = JSON.parse(Hex.toString(payload.message))
    if (!isWitnessMessage(message)) {
      throw new Error('Witness payload is not a witness message')
    }

    const metadata = message.publicKey.metadata || message.metadata
    if (typeof metadata === 'string' || !metadata) {
      throw new Error('Metadata does not contain credential id')
    }

    const decodedSignature = Extensions.Passkeys.decode(Bytes.fromHex(witness.signature.data))

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

  static async find(
    stateReader: State.Reader,
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
  ): Promise<Passkey | undefined> {
    const response = await WebAuthnP256.sign({ challenge: Hex.random(32) })
    if (!response.raw) throw new Error('No credential returned')

    const authenticatorDataBytes = Bytes.fromHex(response.metadata.authenticatorData)
    const clientDataHash = Hash.sha256(Bytes.fromString(response.metadata.clientDataJSON), { as: 'Bytes' })
    const messageSignedByAuthenticator = Bytes.concat(authenticatorDataBytes, clientDataHash)

    const messageHash = Hash.sha256(messageSignedByAuthenticator, { as: 'Bytes' }) // Use Bytes output

    const publicKey1 = P256.recoverPublicKey({
      payload: messageHash,
      signature: {
        r: BigInt(response.signature.r),
        s: BigInt(response.signature.s),
        yParity: 0,
      },
    })

    const publicKey2 = P256.recoverPublicKey({
      payload: messageHash,
      signature: {
        r: BigInt(response.signature.r),
        s: BigInt(response.signature.s),
        yParity: 1,
      },
    })

    // Compute the imageHash for all public key combinations
    // - requireUserVerification: true / false
    // - embedMetadata: true / false

    const base1 = {
      x: Hex.fromNumber(publicKey1.x),
      y: Hex.fromNumber(publicKey1.y),
    }

    const base2 = {
      x: Hex.fromNumber(publicKey2.x),
      y: Hex.fromNumber(publicKey2.y),
    }

    const metadata = {
      credentialId: response.raw.id,
    }

    const imageHashes = [
      Extensions.Passkeys.rootFor({ ...base1, requireUserVerification: true }),
      Extensions.Passkeys.rootFor({ ...base1, requireUserVerification: false }),
      Extensions.Passkeys.rootFor({ ...base1, requireUserVerification: true, metadata }),
      Extensions.Passkeys.rootFor({ ...base1, requireUserVerification: false, metadata }),
      Extensions.Passkeys.rootFor({ ...base2, requireUserVerification: true }),
      Extensions.Passkeys.rootFor({ ...base2, requireUserVerification: false }),
      Extensions.Passkeys.rootFor({ ...base2, requireUserVerification: true, metadata }),
      Extensions.Passkeys.rootFor({ ...base2, requireUserVerification: false, metadata }),
    ]

    // Find wallets for all possible image hashes
    const signers = await Promise.all(
      imageHashes.map(async (imageHash) => {
        const wallets = await stateReader.getWalletsForSapient(extensions.passkeys, imageHash)
        return Object.keys(wallets).map((wallet) => ({
          wallet: Address.from(wallet),
          imageHash,
        }))
      }),
    )

    // Flatten and remove duplicates
    const flattened = signers
      .flat()
      .filter(
        (v, i, self) => self.findIndex((t) => Address.isEqual(t.wallet, v.wallet) && t.imageHash === v.imageHash) === i,
      )

    // If there are no signers, return undefined
    if (flattened.length === 0) {
      return undefined
    }

    // If there are multiple signers log a warning
    // but we still return the first one
    if (flattened.length > 1) {
      console.warn('Multiple signers found for passkey', flattened)
    }

    return Passkey.loadFromWitness(stateReader, extensions, flattened[0]!.wallet, flattened[0]!.imageHash)
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
      data: Bytes.toHex(signature),
      type: 'sapient_compact',
    }
  }

  async witness(stateWriter: State.Writer, wallet: Address.Address, extra?: Object): Promise<void> {
    const payload = Payload.fromMessage(
      Hex.fromString(
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
