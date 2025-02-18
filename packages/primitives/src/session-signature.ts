import { Address, Bytes } from 'ox'
import { Attestation, encodeAttestation } from './attestation'
import { MAX_PERMISSIONS_COUNT } from './permission'
import {
  encodeSessionsTopology,
  minimiseSessionsTopology,
  SessionsTopology,
  isCompleteSessionsTopology,
} from './session-config'
import { minBytesFor, packRSV } from './utils'

//FIXME Combine the attestation and global signature across multiple calls within a payload.
// This requires passing around the un-encoded call signatures and encoding them all at once.

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
  topology: SessionsTopology,
  explicitSigners: Address.Address[] = [],
  implicitSigners: Address.Address[] = [],
): Bytes.Bytes {
  const parts: Bytes.Bytes[] = []

  // Validate the topology
  if (!isCompleteSessionsTopology(topology)) {
    // Refuse to encode incomplete topologies
    throw new Error('Incomplete topology')
  }

  // Optimise the configuration tree by rolling unused signers into nodes.
  topology = minimiseSessionsTopology(topology, explicitSigners, implicitSigners)

  // Session topology
  const encodedTopology = encodeSessionsTopology(topology)
  if (minBytesFor(BigInt(encodedTopology.length)) > 3) {
    throw new Error('Session topology is too large')
  }
  parts.push(Bytes.fromNumber(encodedTopology.length, { size: 3 }), encodedTopology)

  // Call signature parts
  for (const callSignature of callSignatures) {
    parts.push(callSignature)
  }

  return Bytes.concat(...parts)
}
