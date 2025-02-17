import { Bytes } from 'ox'
import { Attestation, encodeAttestation } from './attestation'
import { MAX_PERMISSIONS_COUNT } from './permission'
import {
  encodeSessionsPermissionsTopology,
  getGlobalSigner,
  getImplicitBlacklist,
  SessionsTopology,
} from './session-config'
import { minBytesFor, packRSV } from './utils'

export type ExplicitSessionSignature = {
  sessionsTopology: SessionsTopology
  permissionIdxPerCall: number[]
}

export function encodeImplicitSessionCallSignature(
  attestation: Attestation,
  globalSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
  sessionSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
): Bytes.Bytes {
  const parts: Bytes.Bytes[] = [
    Bytes.fromNumber(0x80, { size: 1 }), // Implicit flag (MSB)
    encodeAttestation(attestation), // Attestation
    packRSV(globalSignature), // Global signature
    packRSV(sessionSignature), // Session signature
  ]

  return Bytes.concat(...parts)
}

export function encodeExplicitSessionCallSignature(
  permissionIndex: bigint,
  sessionSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
): Bytes.Bytes {
  if (permissionIndex > MAX_PERMISSIONS_COUNT) {
    throw new Error('Permission index is too large')
  }

  const parts: Bytes.Bytes[] = [
    Bytes.fromNumber(permissionIndex, { size: 1 }), // Implicit flag (MSB false) & permission index
    packRSV(sessionSignature), // Session signature
  ]

  return Bytes.concat(...parts)
}

export function encodeSessionCallSignatures(
  callSignatures: Bytes.Bytes[],
  topolgy: SessionsTopology,
  includesImplicitSignature = false, // Implicit can optimise away including global signer
): Bytes.Bytes {
  const parts: Bytes.Bytes[] = [Bytes.fromBoolean(includesImplicitSignature)]

  if (!includesImplicitSignature) {
    // Add the global signer
    const globalSigner = getGlobalSigner(topolgy)
    if (!globalSigner) {
      throw new Error('No global signer')
    }
    parts.push(Bytes.fromHex(globalSigner))
  }

  // Explicit session topology
  let encodedExplicitSessionTopology = encodeSessionsPermissionsTopology(topolgy)
  if (minBytesFor(BigInt(encodedExplicitSessionTopology.length)) > 3) {
    throw new Error('Explicit session topology is too large')
  }
  parts.push(Bytes.fromNumber(encodedExplicitSessionTopology.length, { size: 3 }), encodedExplicitSessionTopology)

  // Add the blacklist
  const blacklist = getImplicitBlacklist(topolgy)
  if (!blacklist) {
    throw new Error('No blacklist')
  }
  parts.push(Bytes.fromNumber(blacklist.length, { size: 1 }), Bytes.concat(...blacklist.map((b) => Bytes.fromHex(b))))

  // Call signature parts
  for (const callSignature of callSignatures) {
    parts.push(callSignature)
  }

  return Bytes.concat(...parts)
}
