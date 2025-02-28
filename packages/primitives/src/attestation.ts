import { Address, Bytes, Hash } from 'ox'

export type Attestation = {
  approvedSigner: Address.Address
  identityType: Bytes.Bytes // bytes4
  issuerHash: Bytes.Bytes // bytes32
  audienceHash: Bytes.Bytes // bytes32
  authData: Bytes.Bytes // bytes
  applicationData: Bytes.Bytes // bytes
}

export function encode(attestation: Attestation): Bytes.Bytes {
  const parts: Bytes.Bytes[] = [
    Bytes.fromHex(attestation.approvedSigner, { size: 20 }),
    Bytes.padLeft(attestation.identityType.slice(0, 4), 4), // Truncate identity type to 4 bytes
    Bytes.padLeft(attestation.issuerHash, 32),
    Bytes.padLeft(attestation.audienceHash, 32),
    Bytes.fromNumber(attestation.authData.length, { size: 3 }),
    attestation.authData,
    Bytes.fromNumber(attestation.applicationData.length, { size: 3 }),
    attestation.applicationData,
  ]
  return Bytes.concat(...parts)
}

export function hash(attestation: Attestation): Bytes.Bytes {
  return Hash.keccak256(encode(attestation))
}

export function toJson(attestation: Attestation): string {
  return JSON.stringify(encodeForJson(attestation))
}

export function encodeForJson(attestation: Attestation): any {
  return {
    approvedSigner: attestation.approvedSigner.toString(),
    identityType: Bytes.toHex(attestation.identityType),
    issuerHash: Bytes.toHex(attestation.issuerHash),
    audienceHash: Bytes.toHex(attestation.audienceHash),
    authData: Bytes.toHex(attestation.authData),
    applicationData: Bytes.toHex(attestation.applicationData),
  }
}

export function fromJson(json: string): Attestation {
  return fromParsed(JSON.parse(json))
}

export function fromParsed(parsed: any): Attestation {
  return {
    approvedSigner: Address.from(parsed.approvedSigner),
    identityType: Bytes.fromHex(parsed.identityType),
    issuerHash: Bytes.fromHex(parsed.issuerHash),
    audienceHash: Bytes.fromHex(parsed.audienceHash),
    authData: Bytes.fromHex(parsed.authData),
    applicationData: Bytes.fromHex(parsed.applicationData),
  }
}

// Library functions

export const ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX = Hash.keccak256(Bytes.fromString('acceptImplicitRequest'))

export function generateImplicitRequestMagic(attestation: Attestation, wallet: Address.Address): Bytes.Bytes {
  return Hash.keccak256(
    Bytes.concat(
      ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX,
      Bytes.fromHex(wallet, { size: 20 }),
      attestation.audienceHash,
      attestation.issuerHash,
    ),
  )
}
