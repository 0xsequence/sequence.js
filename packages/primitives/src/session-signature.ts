import { Address, Bytes } from 'ox'
import { Attestation, encodeAttestation } from './attestation'
import { encodeSessionsTopology, SessionsTopology } from './session-config'
import { packRSV } from './utils'

export const FLAG_PERMISSIONS = 0
export const FLAG_NODE = 1
export const FLAG_BRANCH = 2

export type SessionManagerSignature = {
  attestation: Attestation
  sessionsTopology: SessionsTopology
  implicitBlacklist: Address.Address[]
  permissionIdxPerCall: number[]
}

export function encodeSessionSignature(
  signature: SessionManagerSignature,
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

  // Add blacklist with size prefix
  parts.push(Bytes.padLeft(Bytes.fromNumber(signature.implicitBlacklist.length), 3))
  for (const addr of signature.implicitBlacklist) {
    parts.push(Bytes.fromHex(addr))
  }

  // Add permission indices with size prefix
  parts.push(Bytes.padLeft(Bytes.fromNumber(signature.permissionIdxPerCall.length), 3))
  parts.push(new Uint8Array(signature.permissionIdxPerCall))

  return Bytes.concat(...parts)
}
