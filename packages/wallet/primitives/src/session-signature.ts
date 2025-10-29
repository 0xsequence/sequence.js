import { Address, Bytes, Hash, Hex } from 'ox'
import { Attestation, Extensions, Payload } from './index.js'
import { MAX_PERMISSIONS_COUNT } from './permission.js'
import {
  decodeSessionsTopology,
  encodeSessionsTopology,
  getIdentitySigners,
  isCompleteSessionsTopology,
  minimiseSessionsTopology,
  SessionsTopology,
} from './session-config.js'
import { RSY } from './signature.js'
import { minBytesFor, packRSY, unpackRSY } from './utils.js'

export type ImplicitSessionCallSignature = {
  attestation: Attestation.Attestation
  identitySignature: RSY
  sessionSignature: RSY
}

export type ExplicitSessionCallSignature = {
  permissionIndex: bigint
  sessionSignature: RSY
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
      attestation: Attestation.encodeForJson(callSignature.attestation),
      identitySignature: rsyToRsvStr(callSignature.identitySignature),
      sessionSignature: rsyToRsvStr(callSignature.sessionSignature),
    }
  } else if (isExplicitSessionCallSignature(callSignature)) {
    return {
      permissionIndex: callSignature.permissionIndex,
      sessionSignature: rsyToRsvStr(callSignature.sessionSignature),
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
      attestation: Attestation.fromParsed(decoded.attestation),
      identitySignature: rsyFromRsvStr(decoded.identitySignature),
      sessionSignature: rsyFromRsvStr(decoded.sessionSignature),
    }
  } else if (decoded.permissionIndex) {
    return {
      permissionIndex: decoded.permissionIndex,
      sessionSignature: rsyFromRsvStr(decoded.sessionSignature),
    }
  } else {
    throw new Error('Invalid call signature')
  }
}

function rsyToRsvStr(sig: RSY): string {
  return `${sig.r.toString()}:${sig.s.toString()}:${sig.yParity + 27}`
}

function rsyFromRsvStr(sigStr: string): RSY {
  const parts = sigStr.split(':')
  if (parts.length !== 3) {
    throw new Error('Signature must be in r:s:v format')
  }
  const [rStr, sStr, vStr] = parts
  if (!rStr || !sStr || !vStr) {
    throw new Error('Invalid signature format')
  }
  return {
    r: Bytes.toBigInt(Bytes.fromHex(rStr as `0x${string}`, { size: 32 })),
    s: Bytes.toBigInt(Bytes.fromHex(sStr as `0x${string}`, { size: 32 })),
    yParity: parseInt(vStr, 10) - 27,
  }
}

// Usage

/**
 * Encodes a list of session call signatures into a bytes array for contract validation.
 * @param callSignatures The list of session call signatures to encode.
 * @param topology The complete session topology.
 * @param explicitSigners The list of explicit signers to encode. Others will be hashed into nodes.
 * @param implicitSigners The list of implicit signers to encode. Others will be hashed into nodes.
 * @param identitySigner  The identity signer to encode. Others will be hashed into nodes.
 * @returns The encoded session call signatures.
 */
export function encodeSessionSignature(
  callSignatures: SessionCallSignature[],
  topology: SessionsTopology,
  identitySigner: Address.Address,
  explicitSigners: Address.Address[] = [],
  implicitSigners: Address.Address[] = [],
): Bytes.Bytes {
  const parts: Bytes.Bytes[] = []

  // Validate the topology
  if (!isCompleteSessionsTopology(topology)) {
    // Refuse to encode incomplete topologies
    throw new Error('Incomplete topology')
  }

  // Check the topology contains the identity signer
  const identitySigners = getIdentitySigners(topology)
  if (!identitySigners.some((s) => Address.isEqual(s, identitySigner))) {
    throw new Error('Identity signer not found')
  }

  // Optimise the configuration tree by rolling unused signers into nodes.
  topology = minimiseSessionsTopology(topology, explicitSigners, implicitSigners, identitySigner)

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
      const attestationStr = Attestation.toJson(callSig.attestation)
      if (!attestationMap.has(attestationStr)) {
        attestationMap.set(attestationStr, encodedAttestations.length)
        encodedAttestations.push(
          Bytes.concat(Attestation.encode(callSig.attestation), packRSY(callSig.identitySignature)),
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
      const attestationStr = Attestation.toJson(callSignature.attestation)
      const attestationIndex = attestationMap.get(attestationStr)
      if (attestationIndex === undefined) {
        // Unreachable
        throw new Error('Failed to find attestation index')
      }
      const packedFlag = 0x80 | attestationIndex // Implicit flag (MSB) true + attestation index
      parts.push(Bytes.fromNumber(packedFlag, { size: 1 }), packRSY(callSignature.sessionSignature))
    } else if (isExplicitSessionCallSignature(callSignature)) {
      // Explicit
      if (callSignature.permissionIndex > MAX_PERMISSIONS_COUNT) {
        throw new Error('Permission index is too large')
      }
      const packedFlag = callSignature.permissionIndex // Implicit flag (MSB) false + permission index
      parts.push(Bytes.fromNumber(packedFlag, { size: 1 }), packRSY(callSignature.sessionSignature))
    } else {
      // Invalid call signature
      throw new Error('Invalid call signature')
    }
  }

  return Bytes.concat(...parts)
}

export function decodeSessionSignature(encodedSignatures: Bytes.Bytes): {
  topology: SessionsTopology
  callSignatures: SessionCallSignature[]
} {
  let offset = 0

  // Parse session topology length (3 bytes)
  const topologyLength = Bytes.toNumber(encodedSignatures.slice(offset, offset + 3))
  offset += 3

  // Parse session topology
  const topologyBytes = encodedSignatures.slice(offset, offset + topologyLength)
  offset += topologyLength
  const topology = decodeSessionsTopology(topologyBytes)

  // Parse attestations count (1 byte)
  const attestationsCount = Bytes.toNumber(encodedSignatures.slice(offset, offset + 1))
  offset += 1

  // Parse attestations and identity signatures
  const attestations: Attestation.Attestation[] = []
  const identitySignatures: RSY[] = []

  for (let i = 0; i < attestationsCount; i++) {
    // Parse attestation
    const attestation = Attestation.decode(encodedSignatures.slice(offset))
    offset += Attestation.encode(attestation).length
    attestations.push(attestation)

    // Parse identity signature (64 bytes)
    const identitySignature = unpackRSY(encodedSignatures.slice(offset, offset + 64))
    offset += 64
    identitySignatures.push(identitySignature)
  }

  // Parse call signatures
  const callSignatures: SessionCallSignature[] = []

  while (offset < encodedSignatures.length) {
    // Parse flag byte
    const flagByte = encodedSignatures[offset]!
    offset += 1

    // Parse session signature (64 bytes)
    const sessionSignature = unpackRSY(encodedSignatures.slice(offset, offset + 64))
    offset += 64

    // Check if implicit (MSB set) or explicit
    if ((flagByte & 0x80) !== 0) {
      // Implicit call signature
      const attestationIndex = flagByte & 0x7f
      if (attestationIndex >= attestations.length) {
        throw new Error('Invalid attestation index')
      }

      callSignatures.push({
        attestation: attestations[attestationIndex]!,
        identitySignature: identitySignatures[attestationIndex]!,
        sessionSignature,
      })
    } else {
      // Explicit call signature
      const permissionIndex = flagByte
      callSignatures.push({
        permissionIndex: BigInt(permissionIndex),
        sessionSignature,
      })
    }
  }

  return {
    topology,
    callSignatures,
  }
}

// Call encoding

/**
 * Hashes a call with replay protection parameters.
 * @param payload The payload to hash.
 * @param callIdx The index of the call to hash.
 * @param chainId The chain ID. Use 0 when noChainId enabled.
 * @param sessionManagerAddress The session manager address to compile the hash for. Only required to support deprecated hash encodings for Dev1, Dev2 and Rc3.
 * @returns The hash of the call with replay protection parameters for sessions.
 */
export function hashCallWithReplayProtection(
  wallet: Address.Address,
  payload: Payload.Calls,
  callIdx: number,
  chainId: number,
  sessionManagerAddress?: Address.Address,
): Hex.Hex {
  const call = payload.calls[callIdx]!
  // Support deprecated hashes for Dev1, Dev2 and Rc3
  const ignoreCallIdx =
    sessionManagerAddress &&
    (Address.isEqual(sessionManagerAddress, Extensions.Dev1.sessions) ||
      Address.isEqual(sessionManagerAddress, Extensions.Dev2.sessions))
  const ignoreWallet =
    ignoreCallIdx || (sessionManagerAddress && Address.isEqual(sessionManagerAddress, Extensions.Rc3.sessions))
  return Hex.fromBytes(
    Hash.keccak256(
      Bytes.concat(
        ignoreWallet ? Bytes.from([]) : Bytes.fromHex(wallet),
        Bytes.fromNumber(chainId, { size: 32 }),
        Bytes.fromNumber(payload.space, { size: 32 }),
        Bytes.fromNumber(payload.nonce, { size: 32 }),
        ignoreCallIdx ? Bytes.from([]) : Bytes.fromNumber(callIdx, { size: 32 }),
        Bytes.fromHex(Payload.hashCall(call)),
      ),
    ),
  )
}
