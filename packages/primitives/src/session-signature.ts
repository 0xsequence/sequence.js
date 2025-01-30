import { Address, Bytes } from 'ox'
import { Attestation, encodeAttestation } from './attestation'
import { Permission, SessionPermissions } from './permission'
import { minBytesFor, packRSV } from './utils'

import { encodePermission } from './permission'
import { encodeSessionConfig } from './session-config'
export const FLAG_PERMISSIONS = 0
export const FLAG_NODE = 1
export const FLAG_BRANCH = 2

export type SessionManagerSignature = {
  attestation: Attestation
  globalSigner: Address.Address
  permissionsRoot: Bytes.Bytes
  sessionPermissions: SessionsTopology
  isImplicit: boolean
  implicitBlacklist: Address.Address[]
  permissionIdxPerCall: number[]
}

export type SessionLeaf = SessionPermissions
export type SessionNode = [SessionsTopology, SessionsTopology]
export type SessionsTopology = SessionNode | SessionLeaf

function isLeaf(topology: SessionsTopology): topology is SessionLeaf {
  return typeof topology === 'object' && 'signer' in topology
}

function isNode(topology: SessionsTopology): topology is SessionNode {
  return Array.isArray(topology) && topology.length === 2 && isTopology(topology[0]!) && isTopology(topology[1]!)
}

function isTopology(topology: SessionsTopology): topology is SessionsTopology {
  return isNode(topology) || isLeaf(topology)
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

  // Encode permissions tree
  const encodedPermissions = encodePermissionsTree(signature.sessionPermissions)
  parts.push(Bytes.padLeft(Bytes.fromNumber(encodedPermissions.length), 3))
  parts.push(encodedPermissions)

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

function encodePermissionsTree(topolgy: SessionsTopology): Bytes.Bytes {
  if (isNode(topolgy)) {
    const encoded0 = encodePermissionsTree(topolgy[0]!)
    const encoded1 = encodePermissionsTree(topolgy[1]!)
    const isBranching = isNode(topolgy[1]!)

    if (isBranching) {
      const encoded1Size = minBytesFor(BigInt(encoded1.length))
      if (encoded1Size > 15) {
        throw new Error('Branch too large')
      }

      const flag = (FLAG_BRANCH << 4) | encoded1Size
      return Bytes.concat(
        encoded0,
        Bytes.fromNumber(flag),
        Bytes.padLeft(Bytes.fromNumber(encoded1.length), encoded1Size),
        encoded1,
      )
    }

    return Bytes.concat(Bytes.fromNumber(FLAG_NODE), encoded0, encoded1)
  }

  if (isLeaf(topolgy)) {
    const encodedLeaf = encodeSessionConfig(topolgy)
    return Bytes.concat(Bytes.fromNumber(FLAG_PERMISSIONS), encodedLeaf)
  }

  throw new Error('Invalid topology')
}
