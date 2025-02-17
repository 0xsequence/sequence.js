import { Bytes, Address } from 'ox'
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

export type ImplicitBlacklist = {
  blacklist: Address.Address[]
}

export type GlobalSignerLeaf = {
  globalSigner: Address.Address
}

export type SessionNode = Bytes.Bytes // Hashed
export type SessionLeaf = SessionPermissions | ImplicitBlacklist | GlobalSignerLeaf
export type SessionBranch = [SessionsTopology, SessionsTopology, ...SessionsTopology[]]
export type SessionsTopology = SessionBranch | SessionLeaf | SessionNode

function isSessionsNode(topology: any): topology is SessionNode {
  return Bytes.validate(topology)
}

function isImplicitBlacklist(topology: any): topology is ImplicitBlacklist {
  return typeof topology === 'object' && topology !== null && 'blacklist' in topology
}

function isGlobalSignerLeaf(topology: any): topology is GlobalSignerLeaf {
  return typeof topology === 'object' && topology !== null && 'globalSigner' in topology
}

function isSessionPermissions(topology: any): topology is SessionPermissions {
  return typeof topology === 'object' && topology !== null && 'signer' in topology
}

function isSessionsLeaf(topology: any): topology is SessionLeaf {
  return isImplicitBlacklist(topology) || isGlobalSignerLeaf(topology) || isSessionPermissions(topology)
}

function isSessionsBranch(topology: any): topology is SessionBranch {
  return Array.isArray(topology) && topology.length >= 2 && topology.every((child) => isSessionsTopology(child))
}

export function isSessionsTopology(topology: any): topology is SessionsTopology {
  return isSessionsBranch(topology) || isSessionsLeaf(topology) || isSessionsNode(topology)
}

export function isValidSessionsTopology(topology: any): topology is SessionsTopology {
  // A valid topology has exactly one global signer leaf and blacklist leaf
  let hasGlobal
  let hasBlacklist
  //FIXME This no work
  if (isSessionsBranch(topology)) {
    return false
  }
  if (isSessionsLeaf(topology)) {
    return false
  }
  return isSessionsNode(topology)
}

export function getGlobalSigner(topolgy: SessionsTopology): Address.Address | null {
  if (isGlobalSignerLeaf(topolgy)) {
    // Got it
    return topolgy.globalSigner
  }

  if (isSessionsBranch(topolgy)) {
    // Check branches
    const results = topolgy.map(getGlobalSigner).filter((t) => t !== null)
    if (results.length > 1) {
      throw new Error('Multiple global signers')
    }
    if (results.length === 1) {
      return results[0]!
    }
  }

  return null
}

export function getImplicitBlacklist(topolgy: SessionsTopology): Address.Address[] | null {
  const blacklistNode = getImplicitBlacklistNode(topolgy)
  if (!blacklistNode) {
    return null
  }
  return blacklistNode.blacklist
}

export function getImplicitBlacklistNode(topolgy: SessionsTopology): ImplicitBlacklist | null {
  if (isImplicitBlacklist(topolgy)) {
    // Got it
    return topolgy
  }

  if (isSessionsBranch(topolgy)) {
    // Check branches
    const results = topolgy.map(getImplicitBlacklistNode).filter((t) => t !== null)
    if (results.length > 1) {
      throw new Error('Multiple blacklists')
    }
    if (results.length === 1) {
      return results[0]!
    }
  }

  return null
}

// Encoding

// Encodes only the permissions within a topology
export function encodeSessionsPermissionsTopology(topolgy: SessionsTopology): Bytes.Bytes {
  if (isSessionsBranch(topolgy)) {
    const encodedBranches = []
    for (const node of topolgy) {
      encodedBranches.push(encodeSessionsPermissionsTopology(node))
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

  if (isSessionPermissions(topolgy)) {
    const flagByte = SESSIONS_FLAG_PERMISSIONS << 4
    const encodedLeaf = encodeSessionPermissions(topolgy)
    return Bytes.concat(Bytes.fromNumber(flagByte), encodedLeaf)
  }

  if (isSessionsNode(topolgy)) {
    const flagByte = SESSIONS_FLAG_NODE << 4
    return Bytes.concat(Bytes.fromNumber(flagByte), topolgy)
  }

  if (isImplicitBlacklist(topolgy) || isGlobalSignerLeaf(topolgy)) {
    // Return empty bytes
    return new Uint8Array()
  }

  throw new Error('Invalid topology')
}

// JSON

export function sessionsTopologyToJson(topology: SessionsTopology): string {
  return JSON.stringify(encodeSessionsTopologyForJson(topology))
}

function encodeSessionsTopologyForJson(topology: SessionsTopology): any {
  if (isSessionsNode(topology)) {
    return Bytes.toHex(topology)
  }

  if (isSessionPermissions(topology)) {
    return encodeSessionPermissionsForJson(topology)
  }

  if (isImplicitBlacklist(topology) || isGlobalSignerLeaf(topology)) {
    return topology // No encoding necessary
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
  // Parse branch
  if (Array.isArray(parsed)) {
    const branches = parsed.map((node: any) => sessionsTopologyFromParsed(node))
    return branches as SessionBranch
  }

  // Parse node
  if (typeof parsed === 'string' && parsed.startsWith('0x')) {
    const maybeBytes = Bytes.fromHex(parsed as `0x${string}`)
    if (Bytes.validate(maybeBytes)) {
      return maybeBytes
    }
  }

  // Parse permissions
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

  // Parse global signer
  if (typeof parsed === 'object' && parsed !== null && 'globalSigner' in parsed) {
    const globalSigner = parsed.globalSigner as `0x${string}`
    return { globalSigner }
  }

  // Parse blacklist
  if (typeof parsed === 'object' && parsed !== null && 'blacklist' in parsed) {
    const blacklist = parsed.blacklist.map((address: any) => Address.from(address))
    return { blacklist }
  }

  throw new Error('Invalid topology')
}

// Operations

/**
 * Removes all explicit sessions (permissions leaf nodes) that match the given signer from the topology.
 * Returns the updated topology or null if it becomes empty (for nesting).
 * If the signer is not found, the topology is returned unchanged.
 */
export function removeExplicitSession(
  topology: SessionsTopology,
  signerAddress: `0x${string}`,
): SessionsTopology | null {
  if (isSessionPermissions(topology)) {
    if (topology.signer === signerAddress) {
      return null
    }
    // Return the leaf unchanged
    return topology
  }

  // If it's a branch, recurse on each child:
  if (isSessionsBranch(topology)) {
    const newChildren: SessionsTopology[] = []
    for (const child of topology) {
      const updatedChild = removeExplicitSession(child, signerAddress)
      if (updatedChild != null) {
        newChildren.push(updatedChild)
      }
    }

    // If no children remain, return null to remove entire branch
    if (newChildren.length === 0) {
      return null
    }

    // If exactly one child remains, collapse upward
    if (newChildren.length === 1) {
      return newChildren[0]!
    }

    // Otherwise, return the updated branch
    return newChildren as SessionBranch
  }

  // Other leaf, return unchanged
  return topology
}

/**
 * Merges two topologies into a new branch of [a, b].
 */
export function mergeSessionsTopologies(a: SessionsTopology, b: SessionsTopology): SessionsTopology {
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
  if (isSessionPermissions(topology)) {
    if (topology.deadline < currentTime) {
      // Expired => remove
      return null
    }
    // Valid => keep
    return topology
  }

  if (isGlobalSignerLeaf(topology) || isImplicitBlacklist(topology)) {
    return topology
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

/**
 * Adds an address to the implicit session's blacklist.
 * If the address is not already in the blacklist, it is added and the list is sorted.
 */
export function addToImplicitBlacklist(topology: SessionsTopology, address: Address.Address): SessionsTopology {
  const blacklistNode = getImplicitBlacklistNode(topology)
  if (!blacklistNode) {
    throw new Error('No blacklist found')
  }
  const { blacklist } = blacklistNode
  if (blacklist.some((addr) => addr === address)) {
    return topology
  }
  blacklist.push(address)
  blacklist.sort() // keep sorted so on-chain binary search works as expected
  return topology
}

/**
 * Removes an address from the implicit session's blacklist.
 */
export function removeFromImplicitBlacklist(topology: SessionsTopology, address: Address.Address): SessionsTopology {
  const blacklistNode = getImplicitBlacklistNode(topology)
  if (!blacklistNode) {
    throw new Error('No blacklist found')
  }
  const { blacklist } = blacklistNode
  const newBlacklist = blacklist.filter((a) => a !== address)
  blacklistNode.blacklist = newBlacklist
  return topology
}

/**
 *  Generate an empty sessions topology with the given global signer. No session permission and an empty blacklist
 */
export function emptySessionsTopology(globalSigner: Address.Address): SessionsTopology {
  return [
    {
      blacklist: [],
    },
    {
      globalSigner,
    },
  ]
}
