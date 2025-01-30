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
  return Bytes.concat(
    Bytes.padLeft(Bytes.fromHex(attestation.approvedSigner), 20),
    Bytes.padLeft(attestation.identityType, 4),
    Bytes.padLeft(attestation.issuerHash, 32),
    Bytes.padLeft(attestation.audienceHash, 32),
    Bytes.padLeft(Bytes.fromNumber(attestation.authData.length), 3),
    attestation.authData,
    Bytes.padLeft(Bytes.fromNumber(attestation.applicationData.length), 3),
    attestation.applicationData,
  )
}

export function hashAttestation(attestation: Attestation): Bytes.Bytes {
  return Hash.keccak256(encodeAttestation(attestation))
}
