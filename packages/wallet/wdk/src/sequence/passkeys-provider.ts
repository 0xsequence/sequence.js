import { Signers, State } from '@0xsequence/wallet-core'
import type { Extensions } from '@0xsequence/wallet-primitives'
import type { Address, Hex } from 'ox'

export type PasskeySigner = Signers.SapientSigner &
  Signers.Witnessable & {
    credentialId: string
    publicKey: Extensions.Passkeys.PublicKey
    imageHash: Hex.Hex
  }

export type PasskeyProvider = {
  create: (
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
    options?: Signers.Passkey.CreatePasskeyOptions,
  ) => Promise<PasskeySigner>
  find: (
    stateReader: State.Reader,
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
    options?: Signers.Passkey.FindPasskeyOptions,
  ) => Promise<PasskeySigner | undefined>
  loadFromWitness: (
    stateReader: State.Reader,
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
    wallet: Address.Address,
    imageHash: Hex.Hex,
    options?: Signers.Passkey.FindPasskeyOptions,
  ) => Promise<PasskeySigner | undefined>
  fromCredential: (args: {
    credentialId: string
    publicKey: Extensions.Passkeys.PublicKey
    extensions: Pick<Extensions.Extensions, 'passkeys'>
    embedMetadata?: boolean
    metadata?: Extensions.Passkeys.PasskeyMetadata
    webauthn?: Signers.Passkey.WebAuthnLike
  }) => PasskeySigner
  isSigner?: (signer: unknown) => signer is PasskeySigner
}

export const defaultPasskeyProvider: PasskeyProvider = {
  create: (extensions, options) => Signers.Passkey.Passkey.create(extensions, options),
  find: (stateReader, extensions, options) => Signers.Passkey.Passkey.find(stateReader, extensions, options),
  loadFromWitness: (stateReader, extensions, wallet, imageHash, options) =>
    Signers.Passkey.Passkey.loadFromWitness(stateReader, extensions, wallet, imageHash, options),
  fromCredential: ({ credentialId, publicKey, extensions, embedMetadata, metadata, webauthn }) =>
    new Signers.Passkey.Passkey({
      credentialId,
      publicKey,
      extensions,
      embedMetadata,
      metadata,
      webauthn,
    }),
  isSigner: (signer: unknown): signer is PasskeySigner => signer instanceof Signers.Passkey.Passkey,
}
