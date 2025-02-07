import { Bytes } from 'ox'
import { encodeSessionsTopology, SessionsTopology } from './session-explicit-config'
import { packRSV } from './utils'

export type ExplicitSessionSignature = {
  sessionsTopology: SessionsTopology
  permissionIdxPerCall: number[]
}

export function encodeExplicitSessionSignature(
  topology: SessionsTopology,
  permissionIndexes: number[],
  sessionSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
): Bytes.Bytes {
  const parts: Bytes.Bytes[] = []

  // Add session signature (r,sv)
  parts.push(packRSV(sessionSignature))

  // Encode sessions topology
  const encodedSessionsTopology = encodeSessionsTopology(topology)
  parts.push(Bytes.padLeft(Bytes.fromNumber(encodedSessionsTopology.length), 3))
  parts.push(encodedSessionsTopology)

  // Add permission indices. No size prefix. All remaining bytes are assumed to be included.
  parts.push(new Uint8Array(permissionIndexes))

  return Bytes.concat(...parts)
}
