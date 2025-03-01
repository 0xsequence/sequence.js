import { Hex, Bytes, Address } from 'ox'
import { Signer } from '../wallet'
import { Payload, Extensions } from '@0xsequence/sequence-primitives'
import type { Signature as SignatureTypes } from '@0xsequence/sequence-primitives'
import { keccak256 } from 'ox/Hash'
import { WebAuthnP256 } from 'ox'

export type PasskeyOptions = {
  extensions: Pick<Extensions.Extensions, 'passkeys'>

  x: Hex.Hex
  y: Hex.Hex

  credentialId: Hex.Hex
  requireUserVerification: boolean
}

export type PasskeySignerConnector = (
  challenge: Bytes.Bytes,
  credentialId: Hex.Hex,
) => Promise<AuthenticatorAssertionResponse>

function _rootForPasskey(requireUserVerification: boolean, x: Hex.Hex, y: Hex.Hex): Hex.Hex {
  const a = keccak256(Bytes.concat(Bytes.padLeft(Bytes.fromHex(x), 32), Bytes.padLeft(Bytes.fromHex(y), 32)))
  const b = Bytes.padLeft(requireUserVerification ? Bytes.from([1]) : Bytes.from([0]), 32)
  return Hex.fromBytes(keccak256(Bytes.concat(b, a)))
}

function _encodeSignature(
  requireUserVerification: boolean,
  r: Bytes.Bytes,
  s: Bytes.Bytes,
  authenticatorData: Bytes.Bytes,
  clientDataJSON: string,
): Bytes.Bytes {
  const challengeIndex = clientDataJSON.indexOf('"challenge"')
  const typeIndex = clientDataJSON.indexOf('"type"')

  const authDataSize = authenticatorData.length
  const clientDataJSONSize = clientDataJSON.length

  if (authDataSize > 65535) {
    throw new Error('Authenticator data size is too large')
  }
  if (clientDataJSONSize > 65535) {
    throw new Error('Client data JSON size is too large')
  }

  const bytesAuthDataSize = authDataSize <= 255 ? 1 : 2
  const bytesClientDataJSONSize = clientDataJSONSize <= 255 ? 1 : 2
  const bytesChallengeIndex = challengeIndex <= 255 ? 1 : 2
  const bytesTypeIndex = typeIndex <= 255 ? 1 : 2

  let flags = 0

  flags |= requireUserVerification ? 0 : 1 // 0x01 bit
  flags |= (bytesAuthDataSize - 1) << 1 // 0x02 bit
  flags |= (bytesClientDataJSONSize - 1) << 2 // 0x04 bit
  flags |= (bytesChallengeIndex - 1) << 3 // 0x08 bit
  flags |= (bytesTypeIndex - 1) << 4 // 0x10 bit

  let result: Bytes.Bytes = Bytes.from([flags])

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(authDataSize), bytesAuthDataSize))
  result = Bytes.concat(result, authenticatorData)

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(clientDataJSONSize), bytesClientDataJSONSize))
  result = Bytes.concat(result, Bytes.from(new TextEncoder().encode(clientDataJSON)))

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(challengeIndex), bytesChallengeIndex))
  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(typeIndex), bytesTypeIndex))

  result = Bytes.concat(result, Bytes.padLeft(r, 32))
  result = Bytes.concat(result, Bytes.padLeft(s, 32))

  return result
}

export class Passkey implements Signer {
  public readonly address: Address.Address
  public readonly rootHash: Hex.Hex

  constructor(public readonly options: PasskeyOptions) {
    this.rootHash = _rootForPasskey(options.requireUserVerification, options.x, options.y)
    this.address = options.extensions.passkeys
  }

  static async create(
    extensions: Pick<Extensions.Extensions, 'passkeys'>,
    options: { requireUserVerification: boolean } = { requireUserVerification: true },
  ) {
    const credential = await WebAuthnP256.createCredential({
      name: 'Sequence (WIP DEVELOPMENT)',
    })

    const x = Hex.fromNumber(credential.publicKey.x)
    const y = Hex.fromNumber(credential.publicKey.y)

    return new Passkey({
      credentialId: Hex.fromString(credential.id),
      requireUserVerification: options.requireUserVerification,
      extensions,
      x,
      y,
    })
  }

  async signSapient(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    imageHash: Hex.Hex,
  ): Promise<SignatureTypes.SignatureOfSapientSignerLeaf> {
    if (this.rootHash !== imageHash) {
      // TODO: This should never get called, why do we have this?
      throw new Error('Unexpected image hash')
    }

    const challenge = Hex.fromBytes(Payload.hash(wallet, chainId, payload))
    const response = await WebAuthnP256.sign({
      challenge,
      credentialId: this.options.credentialId,
      userVerification: this.options.requireUserVerification ? 'required' : 'discouraged',
    })

    const authenticatorData = Bytes.fromHex(response.metadata.authenticatorData)
    const rBytes = Bytes.fromNumber(response.signature.r)
    const sBytes = Bytes.fromNumber(response.signature.s)

    const signature = _encodeSignature(
      this.options.requireUserVerification,
      rBytes,
      sBytes,
      authenticatorData,
      response.metadata.clientDataJSON,
    )

    return {
      address: this.address,
      data: signature,
      type: 'sapient_compact',
    }
  }
}
