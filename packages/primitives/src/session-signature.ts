import { Address, Bytes, Hex } from 'ox'
import { Attestation, attestationFromParsed, encodeAttestation, encodeAttestationForJson } from './attestation'
import { MAX_PERMISSIONS_COUNT } from './permission'
import {
  encodeSessionsTopology,
  isCompleteSessionsTopology,
  minimiseSessionsTopology,
  SessionsTopology,
} from './session-config'
import { minBytesFor, packRSV } from './utils'

export type ImplicitSessionCallSignature = {
  attestation: Attestation
  identitySignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes }
  sessionSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes }
}

export type ExplicitSessionCallSignature = {
  permissionIndex: bigint
  sessionSignature: { v: number; r: Bytes.Bytes; s: Bytes.Bytes }
}

export type SessionCallSignature = ImplicitSessionCallSignature | ExplicitSessionCallSignature

export function isImplicitSessionCallSignature(
  callSignature: SessionCallSignature,
): callSignature is ImplicitSessionCallSignature {
  return 'attestation' in callSignature && 'identitySignature' in callSignature && 'sessionSignature' in callSignature
}

export function isExplicitSessionCallSignature(
  callSignature: SessionCallSignature,
): callSignature is ExplicitSessionCallSignature {
  return 'permissionIndex' in callSignature && 'sessionSignature' in callSignature
}

// JSON

export function sessionCallSignatureToJson(callSignature: SessionCallSignature): string {
  return JSON.stringify(encodeSessionCallSignatureForJson(callSignature))
}

export function encodeSessionCallSignatureForJson(callSignature: SessionCallSignature): any {
  if (isImplicitSessionCallSignature(callSignature)) {
    return {
      attestation: encodeAttestationForJson(callSignature.attestation),
      identitySignature: rsvToStr(callSignature.identitySignature),
      sessionSignature: rsvToStr(callSignature.sessionSignature),
    }
  } else if (isExplicitSessionCallSignature(callSignature)) {
    return {
      permissionIndex: callSignature.permissionIndex,
      sessionSignature: rsvToStr(callSignature.sessionSignature),
    }
  } else {
    throw new Error('Invalid call signature')
  }
}

export function sessionCallSignatureFromJson(json: string): SessionCallSignature {
  const decoded = JSON.parse(json)
  return sessionCallSignatureFromParsed(decoded)
}

export function sessionCallSignatureFromParsed(decoded: any): SessionCallSignature {
  if (decoded.attestation) {
    return {
      attestation: attestationFromParsed(decoded.attestation),
      identitySignature: rsvFromStr(decoded.identitySignature),
      sessionSignature: rsvFromStr(decoded.sessionSignature),
    }
  } else if (decoded.permissionIndex) {
    return {
      permissionIndex: decoded.permissionIndex,
      sessionSignature: rsvFromStr(decoded.sessionSignature),
    }
  } else {
    throw new Error('Invalid call signature')
  }
}

function rsvToStr(rsv: { v: number; r: Bytes.Bytes; s: Bytes.Bytes }): string {
  return `${rsv.r.toString()}:${rsv.s.toString()}:${rsv.v}`
}

function rsvFromStr(sigStr: string): { v: number; r: Bytes.Bytes; s: Bytes.Bytes } {
  const parts = sigStr.split(':')
  if (parts.length !== 3) {
    throw new Error('Signature must be in r:s:v format')
  }
  const [rStr, sStr, vStr] = parts
  if (!rStr || !sStr || !vStr) {
    throw new Error('Invalid signature format')
  }
  return {
    v: parseInt(vStr, 10),
    r: Bytes.fromHex(rStr as `0x${string}`),
    s: Bytes.fromHex(sStr as `0x${string}`),
  }
}

// Usage

export function encodeSessionCallSignatures(
  callSignatures: SessionCallSignature[],
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

  // Create unique attestation list and maintain index mapping
  const attestationMap = new Map<string, number>()
  const encodedAttestations: Bytes.Bytes[] = []

  // Map each call signature to its attestation index
  callSignatures.filter(isImplicitSessionCallSignature).forEach((callSig) => {
    if (callSig.attestation) {
      const attestationStr = JSON.stringify(callSig.attestation)
      if (!attestationMap.has(attestationStr)) {
        attestationMap.set(attestationStr, encodedAttestations.length)
        encodedAttestations.push(
          Bytes.concat(encodeAttestation(callSig.attestation), packRSV(callSig.identitySignature)),
        )
      }
    }
  })

  // Add the attestations to the parts
  if (encodedAttestations.length >= 128) {
    throw new Error('Too many attestations')
  }
  parts.push(Bytes.fromNumber(encodedAttestations.length, { size: 1 }), Bytes.concat(...encodedAttestations))

  // Call signature parts
  for (const callSignature of callSignatures) {
    if (isImplicitSessionCallSignature(callSignature)) {
      // Implicit
      const attestationIndex = attestationMap.get(JSON.stringify(callSignature.attestation))
      if (attestationIndex === undefined) {
        // Unreachable
        throw new Error('Failed to find attestation index')
      }
      const packedFlag = 0x80 | attestationIndex // Implicit flag (MSB) true + attestation index
      parts.push(Bytes.fromNumber(packedFlag, { size: 1 }), packRSV(callSignature.sessionSignature))
    } else if (isExplicitSessionCallSignature(callSignature)) {
      // Explicit
      if (callSignature.permissionIndex > MAX_PERMISSIONS_COUNT) {
        throw new Error('Permission index is too large')
      }
      const packedFlag = callSignature.permissionIndex // Implicit flag (MSB) false + permission index
      parts.push(Bytes.fromNumber(packedFlag, { size: 1 }), packRSV(callSignature.sessionSignature))
    } else {
      // Invalid call signature
      throw new Error('Invalid call signature')
    }
  }

  return Bytes.concat(...parts)
}
