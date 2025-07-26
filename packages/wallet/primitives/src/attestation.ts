import { Bytes, Hash } from 'ox'
import { checksum, Checksummed } from './address.js'

export type Attestation = {
  approvedSigner: Checksummed
  identityType: Bytes.Bytes // bytes4
  issuerHash: Bytes.Bytes // bytes32
  audienceHash: Bytes.Bytes // bytes32
  applicationData: Bytes.Bytes // bytes
  authData: AuthData
}

export type AuthData = {
  redirectUrl: string // bytes
  issuedAt: bigint // uint64
}

// Encoding and decoding

export function encode(attestation: Attestation): Bytes.Bytes {
  const authDataBytes = encodeAuthData(attestation.authData)
  const parts: Bytes.Bytes[] = [
    Bytes.fromHex(attestation.approvedSigner, { size: 20 }),
    Bytes.padLeft(attestation.identityType.slice(0, 4), 4), // Truncate identity type to 4 bytes
    Bytes.padLeft(attestation.issuerHash, 32),
    Bytes.padLeft(attestation.audienceHash, 32),
    Bytes.fromNumber(attestation.applicationData.length, { size: 3 }),
    attestation.applicationData,
    authDataBytes,
  ]
  return Bytes.concat(...parts)
}

export function encodeAuthData(authData: AuthData): Bytes.Bytes {
  return Bytes.concat(
    Bytes.fromNumber(authData.redirectUrl.length, { size: 3 }),
    Bytes.fromString(authData.redirectUrl),
    Bytes.fromNumber(authData.issuedAt, { size: 8 }),
  )
}

export function decode(bytes: Bytes.Bytes): Attestation {
  const approvedSigner = checksum(Bytes.toHex(bytes.slice(0, 20)))
  const identityType = bytes.slice(20, 24)
  const issuerHash = bytes.slice(24, 56)
  const audienceHash = bytes.slice(56, 88)
  const applicationDataLength = Bytes.toNumber(bytes.slice(88, 91))
  const applicationData = bytes.slice(91, 91 + applicationDataLength)
  const authData = decodeAuthData(bytes.slice(91 + applicationDataLength))

  return {
    approvedSigner,
    identityType,
    issuerHash,
    audienceHash,
    applicationData,
    authData,
  }
}

export function decodeAuthData(bytes: Bytes.Bytes): AuthData {
  const redirectUrlLength = Bytes.toNumber(bytes.slice(0, 3))
  const redirectUrl = Bytes.toString(bytes.slice(3, 3 + redirectUrlLength))
  const issuedAt = Bytes.toBigInt(bytes.slice(3 + redirectUrlLength, 3 + redirectUrlLength + 8))

  return {
    redirectUrl,
    issuedAt,
  }
}

export function hash(attestation: Attestation): Bytes.Bytes {
  return Hash.keccak256(encode(attestation))
}

export function toJson(attestation: Attestation, indent?: number): string {
  return JSON.stringify(encodeForJson(attestation), null, indent)
}

export function encodeForJson(attestation: Attestation): any {
  return {
    approvedSigner: attestation.approvedSigner.toString(),
    identityType: Bytes.toHex(attestation.identityType),
    issuerHash: Bytes.toHex(attestation.issuerHash),
    audienceHash: Bytes.toHex(attestation.audienceHash),
    applicationData: Bytes.toHex(attestation.applicationData),
    authData: {
      redirectUrl: attestation.authData.redirectUrl,
      issuedAt: attestation.authData.issuedAt.toString(),
    },
  }
}

export function fromJson(json: string): Attestation {
  return fromParsed(JSON.parse(json))
}

export function fromParsed(parsed: any): Attestation {
  return {
    approvedSigner: checksum(parsed.approvedSigner),
    identityType: Bytes.fromHex(parsed.identityType),
    issuerHash: Bytes.fromHex(parsed.issuerHash),
    audienceHash: Bytes.fromHex(parsed.audienceHash),
    applicationData: Bytes.fromHex(parsed.applicationData),
    authData: {
      redirectUrl: parsed.authData.redirectUrl,
      issuedAt: BigInt(parsed.authData.issuedAt),
    },
  }
}

// Library functions

export const ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX = Hash.keccak256(Bytes.fromString('acceptImplicitRequest'))

export function generateImplicitRequestMagic(attestation: Attestation, wallet: Checksummed): Bytes.Bytes {
  return Hash.keccak256(
    Bytes.concat(
      ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX,
      Bytes.fromHex(wallet, { size: 20 }),
      attestation.audienceHash,
      attestation.issuerHash,
    ),
  )
}
