import { Bytes } from 'ox'
import {
  encodeSessionPermissions,
  encodeSessionPermissionsForJson,
  SessionPermissions,
  sessionPermissionsFromParsed,
} from './permission'
import { minBytesFor } from './utils'

export const SESSIONS_FLAG_PERMISSIONS = 0
export const SESSIONS_FLAG_NODE = 1
export const SESSIONS_FLAG_BRANCH = 2

export type SessionNode = Bytes.Bytes // Hashed
export type SessionLeaf = SessionPermissions
export type SessionBranch = [SessionsTopology, SessionsTopology, ...SessionsTopology[]]
export type SessionsTopology = SessionBranch | SessionLeaf | SessionNode
export type EmptySessionsTopology = []

function isSessionsNode(topology: any): topology is SessionNode {
  return Bytes.validate(topology)
}

function isSessionsLeaf(topology: any): topology is SessionLeaf {
  return typeof topology === 'object' && topology !== null && 'signer' in topology
}

function isSessionsBranch(topology: any): topology is SessionBranch {
  return Array.isArray(topology) && topology.length >= 2 && topology.every((child) => isSessionsTopology(child))
}

export function isSessionsTopology(topology: any): topology is SessionsTopology {
  return isSessionsBranch(topology) || isSessionsLeaf(topology) || isSessionsNode(topology)
}

export function isEmptySessionsTopology(topology: any): topology is EmptySessionsTopology {
  return Array.isArray(topology) && topology.length === 0
}

// Encoding

export function encodeSessionsTopology(topolgy: SessionsTopology): Bytes.Bytes {
  if (isSessionsBranch(topolgy)) {
    const branch = topolgy as SessionBranch
    const encodedBranches = []
    for (const node of branch) {
      encodedBranches.push(encodeSessionsTopology(node))
    }
    const encoded = Bytes.concat(...encodedBranches)
    const encodedSize = minBytesFor(BigInt(encoded.length))
    if (encodedSize > 15) {
      throw new Error('Branch too large')
    }
    const flagByte = (SESSIONS_FLAG_BRANCH << 4) | encodedSize
    return Bytes.concat(
      Bytes.fromNumber(flagByte),
      Bytes.padLeft(Bytes.fromNumber(encoded.length), encodedSize),
      encoded,
    )
  }

  if (isSessionsLeaf(topolgy)) {
    const flagByte = SESSIONS_FLAG_PERMISSIONS << 4
    const encodedLeaf = encodeSessionPermissions(topolgy)
    return Bytes.concat(Bytes.fromNumber(flagByte), encodedLeaf)
  }

  if (isSessionsNode(topolgy)) {
    const flagByte = SESSIONS_FLAG_NODE << 4
    return Bytes.concat(Bytes.fromNumber(flagByte), topolgy)
  }

  throw new Error('Invalid topology')
}

// JSON

export function sessionsTopologyToJson(topology: SessionsTopology | EmptySessionsTopology): string {
  return JSON.stringify(encodeSessionsTopologyForJson(topology))
}

function encodeSessionsTopologyForJson(topology: SessionsTopology | EmptySessionsTopology): any {
  if (isEmptySessionsTopology(topology)) {
    return []
  }

  if (isSessionsNode(topology)) {
    return Bytes.toHex(topology)
  }

  if (isSessionsLeaf(topology)) {
    return encodeSessionPermissionsForJson(topology)
  }

  if (isSessionsBranch(topology)) {
    return topology.map((node) => encodeSessionsTopologyForJson(node))
  }

  throw new Error('Invalid topology')
}

export function sessionsTopologyFromJson(json: string): SessionsTopology {
  const parsed = JSON.parse(json)
  return sessionsTopologyFromParsed(parsed)
}

function sessionsTopologyFromParsed(parsed: any): SessionsTopology {
  // If it's a valid hex string, attempt to parse as node
  if (typeof parsed === 'string' && parsed.startsWith('0x')) {
    const maybeBytes = Bytes.fromHex(parsed as `0x${string}`)
    if (Bytes.validate(maybeBytes)) {
      return maybeBytes
    }
  }

  // If it looks like session permissions
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'signer' in parsed &&
    'valueLimit' in parsed &&
    'deadline' in parsed &&
    'permissions' in parsed
  ) {
    return sessionPermissionsFromParsed(parsed)
  }

  // If it's an array, try to interpret as a branch
  if (Array.isArray(parsed)) {
    const branches = parsed.map((node: any) => sessionsTopologyFromParsed(node))
    return branches as SessionBranch
  }

  throw new Error('Invalid topology')
}

// Operations

/**
 * Removes all session permissions (leaf nodes) that match the given signer from the topology.
 * Returns the updated topology or EmptySessionsTopology if it becomes empty.
 * If the signer is not found, the topology is returned unchanged.
 */
export function removeSessionPermission(
  topology: SessionsTopology | EmptySessionsTopology,
  signerAddress: `0x${string}`,
): SessionsTopology | EmptySessionsTopology {
  if (isEmptySessionsTopology(topology)) {
    return topology
  }

  // If it's a node (hashed bytes), we leave it as is:
  if (isSessionsNode(topology)) {
    return topology
  }

  // If it's a leaf, remove it if the signer matches:
  if (isSessionsLeaf(topology)) {
    if (topology.signer === signerAddress) {
      return []
    }
    // Otherwise, keep it as is
    return topology
  }

  // If it's a branch, recurse on each child:
  if (isSessionsBranch(topology)) {
    const newChildren: SessionsTopology[] = []
    for (const child of topology) {
      const updatedChild = removeSessionPermission(child, signerAddress)
      if (!isEmptySessionsTopology(updatedChild)) {
        newChildren.push(updatedChild)
      }
    }

    // If no children remain, return null to remove entire branch
    if (newChildren.length === 0) {
      return []
    }

    // If exactly one child remains, collapse upward
    if (newChildren.length === 1) {
      return newChildren[0]!
    }

    // Otherwise, return the updated branch
    return newChildren as SessionBranch
  }

  // Unreachable
  throw new Error('Invalid topology')
}

/**
 * Merges two topologies into a new branch of [a, b].
 */
export function mergeSessionsTopologies(
  a: SessionsTopology | EmptySessionsTopology,
  b: SessionsTopology | EmptySessionsTopology,
): SessionsTopology {
  const isEmptyA = isEmptySessionsTopology(a)
  const isEmptyB = isEmptySessionsTopology(b)
  if (isEmptyA && isEmptyB) {
    throw new Error('Cannot merge two empty topologies')
  }
  if (isEmptyA) {
    return b as SessionsTopology
  }
  if (isEmptyB) {
    return a as SessionsTopology
  }
  return [a, b]
}

/**
 * Helper to flatten a topology into an array of leaves and nodes only.
 * We ignore branches by recursing into them.
 */
function flattenSessionsTopology(topology: SessionsTopology): (SessionLeaf | SessionNode)[] {
  if (isSessionsLeaf(topology) || isSessionsNode(topology)) {
    return [topology]
  }
  // If it's a branch, flatten all children
  const result: (SessionLeaf | SessionNode)[] = []
  for (const child of topology) {
    result.push(...flattenSessionsTopology(child))
  }
  return result
}

/**
 * Helper to build a balanced binary tree from an array of leaves/nodes.
 * This function returns:
 *   - A single leaf/node if there's only 1 item
 *   - A branch of two subtrees otherwise
 */
function buildBalancedSessionsTopology(items: (SessionLeaf | SessionNode)[]): SessionsTopology {
  if (items.length === 1) {
    return items[0]!
  }
  if (items.length === 0) {
    throw new Error('Cannot build a topology from an empty list')
  }
  const mid = Math.floor(items.length / 2)
  const left = items.slice(0, mid)
  const right = items.slice(mid)
  // Recursively build subtrees
  const leftTopo = buildBalancedSessionsTopology(left)
  const rightTopo = buildBalancedSessionsTopology(right)
  return [leftTopo, rightTopo]
}

/**
 * Balances the topology by flattening and rebuilding as a balanced binary tree.
 */
export function balanceSessionsTopology(topology: SessionsTopology): SessionsTopology {
  const flattened = flattenSessionsTopology(topology)
  return buildBalancedSessionsTopology(flattened)
}

/**
 * Cleans a topology by removing leaves (SessionPermissions) whose deadline has expired.
 *    - currentTime is compared against `session.deadline`.
 *    - If a branch ends up with zero valid leaves, return `null`.
 *    - If it has one child, collapse that child upward.
 */
export function cleanSessionsTopology(
  topology: SessionsTopology,
  currentTime: bigint = BigInt(Math.floor(Date.now() / 1000)),
): SessionsTopology | null {
  // If it's a node, just return it as is.
  if (isSessionsNode(topology)) {
    return topology
  }

  // If it's a leaf, check the deadline
  if (isSessionsLeaf(topology)) {
    const leaf = topology
    if (leaf.deadline < currentTime) {
      // Expired => remove
      return null
    }
    // Valid => keep
    return leaf
  }

  // If it's a branch, clean all children
  const newChildren: SessionsTopology[] = []
  for (const child of topology) {
    const cleanedChild = cleanSessionsTopology(child, currentTime)
    if (cleanedChild !== null) {
      newChildren.push(cleanedChild)
    }
  }

  // If no children remain, return null
  if (newChildren.length === 0) {
    return null
  }

  // If exactly one child remains, collapse upward:
  if (newChildren.length === 1) {
    return newChildren[0]!
  }

  // Otherwise, return a new branch with the cleaned children
  return newChildren as SessionBranch
}
