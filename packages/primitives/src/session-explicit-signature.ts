import { Bytes } from 'ox'
import { Attestation, encodeAttestation } from './attestation'
import { encodeSessionsTopology, SessionsTopology } from './session-explicit-config'
import { packRSV } from './utils'

export type ExplicitSessionSignature = {
  attestation: Attestation
  sessionsTopology: SessionsTopology
  permissionIdxPerCall: number[]
}

export function encodeExplicitSessionSignature(
  signature: ExplicitSessionSignature,
  sessionSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
  globalSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
): Bytes.Bytes {
  const parts: Bytes.Bytes[] = []

  // Add session signature (r,sv)
  parts.push(packRSV(sessionSignature))

  // Add attestation components
  parts.push(encodeAttestation(signature.attestation))

  // Add global signature (r,s,v)
  parts.push(globalSignature.r)
  parts.push(globalSignature.s)
  parts.push(new Uint8Array([globalSignature.v]))

  // Encode sessions topology
  const encodedSessionsTopology = encodeSessionsTopology(signature.sessionsTopology)
  parts.push(Bytes.padLeft(Bytes.fromNumber(encodedSessionsTopology.length), 3))
  parts.push(encodedSessionsTopology)

  // Add permission indices. No size prefix. All remaining bytes are assumed to be included.
  parts.push(new Uint8Array(signature.permissionIdxPerCall))

  return Bytes.concat(...parts)
}
