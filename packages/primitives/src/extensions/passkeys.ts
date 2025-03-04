import { Bytes, Hex, WebAuthnP256 } from 'ox'
import { keccak256 } from 'ox/Hash'

export type PublicKey = {
  requireUserVerification: boolean
  x: Hex.Hex
  y: Hex.Hex
}

export function rootFor(publicKey: PublicKey): Hex.Hex {
  const a = keccak256(
    Bytes.concat(Bytes.padLeft(Bytes.fromHex(publicKey.x), 32), Bytes.padLeft(Bytes.fromHex(publicKey.y), 32)),
  )
  const b = Bytes.padLeft(publicKey.requireUserVerification ? Bytes.from([1]) : Bytes.from([0]), 32)
  return Hex.fromBytes(keccak256(Bytes.concat(b, a)))
}

export type DecodedSignature = {
  publicKey: PublicKey
  r: Bytes.Bytes
  s: Bytes.Bytes
  authenticatorData: Bytes.Bytes
  clientDataJSON: string
}

export function encode(decoded: DecodedSignature): Bytes.Bytes {
  const challengeIndex = decoded.clientDataJSON.indexOf('"challenge"')
  const typeIndex = decoded.clientDataJSON.indexOf('"type"')

  const authDataSize = decoded.authenticatorData.length
  const clientDataJSONSize = decoded.clientDataJSON.length

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

  flags |= decoded.publicKey.requireUserVerification ? 1 : 0 // 0x01 bit
  flags |= (bytesAuthDataSize - 1) << 1 // 0x02 bit
  flags |= (bytesClientDataJSONSize - 1) << 2 // 0x04 bit
  flags |= (bytesChallengeIndex - 1) << 3 // 0x08 bit
  flags |= (bytesTypeIndex - 1) << 4 // 0x10 bit

  let result: Bytes.Bytes = Bytes.from([flags])

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(authDataSize), bytesAuthDataSize))
  result = Bytes.concat(result, decoded.authenticatorData)

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(decoded.clientDataJSON.length), bytesClientDataJSONSize))
  result = Bytes.concat(result, Bytes.from(new TextEncoder().encode(decoded.clientDataJSON)))

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(challengeIndex), bytesChallengeIndex))
  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(typeIndex), bytesTypeIndex))

  result = Bytes.concat(result, Bytes.padLeft(decoded.r, 32))
  result = Bytes.concat(result, Bytes.padLeft(decoded.s, 32))

  result = Bytes.concat(result, Bytes.fromHex(decoded.publicKey.x))
  result = Bytes.concat(result, Bytes.fromHex(decoded.publicKey.y))

  return result
}

export function isValidSignature(challenge: Hex.Hex, decoded: DecodedSignature): boolean {
  return WebAuthnP256.verify({
    challenge,
    publicKey: {
      x: Hex.toBigInt(decoded.publicKey.x),
      y: Hex.toBigInt(decoded.publicKey.y),
      prefix: 4,
    },
    metadata: {
      authenticatorData: Hex.fromBytes(decoded.authenticatorData),
      challengeIndex: decoded.clientDataJSON.indexOf('"challenge"'),
      clientDataJSON: decoded.clientDataJSON,
      typeIndex: decoded.clientDataJSON.indexOf('"type"'),
      userVerificationRequired: decoded.publicKey.requireUserVerification,
    },
    signature: {
      r: Bytes.toBigInt(decoded.r),
      s: Bytes.toBigInt(decoded.s),
    },
  })
}

export function decode(data: Bytes.Bytes): DecodedSignature & { challengeIndex: number; typeIndex: number } {
  let offset = 0

  const flags = data[0]
  offset += 1

  if (flags === undefined) {
    throw new Error('Invalid flags')
  }

  const requireUserVerification = (flags & 0x01) === 0x01
  const bytesAuthDataSize = ((flags >> 1) & 0x01) + 1
  const bytesClientDataJSONSize = ((flags >> 2) & 0x01) + 1
  const bytesChallengeIndex = ((flags >> 3) & 0x01) + 1
  const bytesTypeIndex = ((flags >> 4) & 0x01) + 1

  const authDataSize = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesAuthDataSize))
  offset += bytesAuthDataSize
  const authenticatorData = Bytes.slice(data, offset, offset + authDataSize)
  offset += authDataSize

  const clientDataJSONSize = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesClientDataJSONSize))
  offset += bytesClientDataJSONSize
  const clientDataJSONBytes = Bytes.slice(data, offset, offset + clientDataJSONSize)
  offset += clientDataJSONSize
  const clientDataJSON = new TextDecoder().decode(clientDataJSONBytes)

  const challengeIndex = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesChallengeIndex))
  offset += bytesChallengeIndex
  const typeIndex = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesTypeIndex))
  offset += bytesTypeIndex

  const r = Bytes.slice(data, offset, offset + 32)
  offset += 32
  const s = Bytes.slice(data, offset, offset + 32)
  offset += 32

  const xBytes = Bytes.slice(data, offset, offset + 32)
  offset += 32
  const yBytes = Bytes.slice(data, offset, offset + 32)

  return {
    publicKey: {
      requireUserVerification,
      x: Hex.fromBytes(xBytes),
      y: Hex.fromBytes(yBytes),
    },
    r,
    s,
    authenticatorData,
    clientDataJSON,
    challengeIndex,
    typeIndex,
  }
}
