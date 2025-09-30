import { Address, Bytes, Hash, Hex } from 'ox';
import { encode, encodeForJson, fromParsed, toJson } from './attestation.js';
import { MAX_PERMISSIONS_COUNT } from './permission.js';
import { encodeSessionsTopology, getIdentitySigners, isCompleteSessionsTopology, minimiseSessionsTopology, } from './session-config.js';
import { minBytesFor, packRSY } from './utils.js';
import { Payload } from './index.js';
export function isImplicitSessionCallSignature(callSignature) {
    return 'attestation' in callSignature && 'identitySignature' in callSignature && 'sessionSignature' in callSignature;
}
export function isExplicitSessionCallSignature(callSignature) {
    return 'permissionIndex' in callSignature && 'sessionSignature' in callSignature;
}
// JSON
export function sessionCallSignatureToJson(callSignature) {
    return JSON.stringify(encodeSessionCallSignatureForJson(callSignature));
}
export function encodeSessionCallSignatureForJson(callSignature) {
    if (isImplicitSessionCallSignature(callSignature)) {
        return {
            attestation: encodeForJson(callSignature.attestation),
            identitySignature: rsyToRsvStr(callSignature.identitySignature),
            sessionSignature: rsyToRsvStr(callSignature.sessionSignature),
        };
    }
    else if (isExplicitSessionCallSignature(callSignature)) {
        return {
            permissionIndex: callSignature.permissionIndex,
            sessionSignature: rsyToRsvStr(callSignature.sessionSignature),
        };
    }
    else {
        throw new Error('Invalid call signature');
    }
}
export function sessionCallSignatureFromJson(json) {
    const decoded = JSON.parse(json);
    return sessionCallSignatureFromParsed(decoded);
}
export function sessionCallSignatureFromParsed(decoded) {
    if (decoded.attestation) {
        return {
            attestation: fromParsed(decoded.attestation),
            identitySignature: rsyFromRsvStr(decoded.identitySignature),
            sessionSignature: rsyFromRsvStr(decoded.sessionSignature),
        };
    }
    else if (decoded.permissionIndex) {
        return {
            permissionIndex: decoded.permissionIndex,
            sessionSignature: rsyFromRsvStr(decoded.sessionSignature),
        };
    }
    else {
        throw new Error('Invalid call signature');
    }
}
function rsyToRsvStr(sig) {
    return `${sig.r.toString()}:${sig.s.toString()}:${sig.yParity + 27}`;
}
function rsyFromRsvStr(sigStr) {
    const parts = sigStr.split(':');
    if (parts.length !== 3) {
        throw new Error('Signature must be in r:s:v format');
    }
    const [rStr, sStr, vStr] = parts;
    if (!rStr || !sStr || !vStr) {
        throw new Error('Invalid signature format');
    }
    return {
        r: Bytes.toBigInt(Bytes.fromHex(rStr, { size: 32 })),
        s: Bytes.toBigInt(Bytes.fromHex(sStr, { size: 32 })),
        yParity: parseInt(vStr, 10) - 27,
    };
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
export function encodeSessionCallSignatures(callSignatures, topology, identitySigner, explicitSigners = [], implicitSigners = []) {
    const parts = [];
    // Validate the topology
    if (!isCompleteSessionsTopology(topology)) {
        // Refuse to encode incomplete topologies
        throw new Error('Incomplete topology');
    }
    // Check the topology contains the identity signer
    const identitySigners = getIdentitySigners(topology);
    if (!identitySigners.some((s) => Address.isEqual(s, identitySigner))) {
        throw new Error('Identity signer not found');
    }
    // Optimise the configuration tree by rolling unused signers into nodes.
    topology = minimiseSessionsTopology(topology, explicitSigners, implicitSigners, identitySigner);
    // Session topology
    const encodedTopology = encodeSessionsTopology(topology);
    if (minBytesFor(BigInt(encodedTopology.length)) > 3) {
        throw new Error('Session topology is too large');
    }
    parts.push(Bytes.fromNumber(encodedTopology.length, { size: 3 }), encodedTopology);
    // Create unique attestation list and maintain index mapping
    const attestationMap = new Map();
    const encodedAttestations = [];
    // Map each call signature to its attestation index
    callSignatures.filter(isImplicitSessionCallSignature).forEach((callSig) => {
        if (callSig.attestation) {
            const attestationStr = toJson(callSig.attestation);
            if (!attestationMap.has(attestationStr)) {
                attestationMap.set(attestationStr, encodedAttestations.length);
                encodedAttestations.push(Bytes.concat(encode(callSig.attestation), packRSY(callSig.identitySignature)));
            }
        }
    });
    // Add the attestations to the parts
    if (encodedAttestations.length >= 128) {
        throw new Error('Too many attestations');
    }
    parts.push(Bytes.fromNumber(encodedAttestations.length, { size: 1 }), Bytes.concat(...encodedAttestations));
    // Call signature parts
    for (const callSignature of callSignatures) {
        if (isImplicitSessionCallSignature(callSignature)) {
            // Implicit
            const attestationStr = toJson(callSignature.attestation);
            const attestationIndex = attestationMap.get(attestationStr);
            if (attestationIndex === undefined) {
                // Unreachable
                throw new Error('Failed to find attestation index');
            }
            const packedFlag = 0x80 | attestationIndex; // Implicit flag (MSB) true + attestation index
            parts.push(Bytes.fromNumber(packedFlag, { size: 1 }), packRSY(callSignature.sessionSignature));
        }
        else if (isExplicitSessionCallSignature(callSignature)) {
            // Explicit
            if (callSignature.permissionIndex > MAX_PERMISSIONS_COUNT) {
                throw new Error('Permission index is too large');
            }
            const packedFlag = callSignature.permissionIndex; // Implicit flag (MSB) false + permission index
            parts.push(Bytes.fromNumber(packedFlag, { size: 1 }), packRSY(callSignature.sessionSignature));
        }
        else {
            // Invalid call signature
            throw new Error('Invalid call signature');
        }
    }
    return Bytes.concat(...parts);
}
// Helper
export function hashCallWithReplayProtection(payload, callIdx, chainId, skipCallIdx = false) {
    const call = payload.calls[callIdx];
    return Hex.fromBytes(Hash.keccak256(Bytes.concat(Bytes.fromNumber(chainId, { size: 32 }), Bytes.fromNumber(payload.space, { size: 32 }), Bytes.fromNumber(payload.nonce, { size: 32 }), skipCallIdx ? Bytes.from([]) : Bytes.fromNumber(callIdx, { size: 32 }), Bytes.fromHex(Payload.hashCall(call)))));
}
//# sourceMappingURL=session-signature.js.map