import { Address, Bytes, Hash } from 'ox'

export type Attestation = {
  approvedSigner: Address.Address
  identityType: Bytes.Bytes // bytes4
  issuerHash: Bytes.Bytes // bytes32
  audienceHash: Bytes.Bytes // bytes32
  authData: Bytes.Bytes // bytes
  applicationData: Bytes.Bytes // bytes
}

export function encodeAttestation(attestation: Attestation): Bytes.Bytes {
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

export function hashAttestation(attestation: Attestation): Bytes.Bytes {
  return Hash.keccak256(encodeAttestation(attestation))
}

export function attestationToJson(attestation: Attestation): string {
  return JSON.stringify(encodeAttestationForJson(attestation))
}

export function encodeAttestationForJson(attestation: Attestation): any {
  return {
    approvedSigner: attestation.approvedSigner.toString(),
    identityType: Bytes.toHex(attestation.identityType),
    issuerHash: Bytes.toHex(attestation.issuerHash),
    audienceHash: Bytes.toHex(attestation.audienceHash),
    authData: Bytes.toHex(attestation.authData),
    applicationData: Bytes.toHex(attestation.applicationData),
  }
}

export function attestationFromJson(json: string): Attestation {
  return attestationFromParsed(JSON.parse(json))
}

export function attestationFromParsed(parsed: any): Attestation {
  return {
    approvedSigner: Address.from(parsed.approvedSigner),
    identityType: Bytes.fromHex(parsed.identityType),
    issuerHash: Bytes.fromHex(parsed.issuerHash),
    audienceHash: Bytes.fromHex(parsed.audienceHash),
    authData: Bytes.fromHex(parsed.authData),
    applicationData: Bytes.fromHex(parsed.applicationData),
  }
}
