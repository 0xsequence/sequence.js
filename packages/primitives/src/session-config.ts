import { Address, Bytes, Hash } from 'ox'
import { EncodedConfigurationBranch, EncodedConfigurationTree, isEncodedConfigurationBranch } from './config'
import {
  encodeSessionPermissions,
  encodeSessionPermissionsForJson,
  SessionPermissions,
  sessionPermissionsFromParsed,
} from './permission'
import { minBytesFor } from './utils'

//FIXME Reorder by expected usage
export const SESSIONS_FLAG_PERMISSIONS = 0
export const SESSIONS_FLAG_NODE = 1
export const SESSIONS_FLAG_BRANCH = 2
export const SESSIONS_FLAG_BLACKLIST = 3
export const SESSIONS_FLAG_IDENTITY_SIGNER = 4

export type ImplicitBlacklist = {
  blacklist: Address.Address[]
}

export type IdentitySignerLeaf = {
  identitySigner: Address.Address
}

export type SessionNode = Bytes.Bytes // Hashed
export type SessionLeaf = SessionPermissions | ImplicitBlacklist | IdentitySignerLeaf
export type SessionBranch = [SessionsTopology, SessionsTopology, ...SessionsTopology[]]
export type SessionsTopology = SessionBranch | SessionLeaf | SessionNode

function isSessionsNode(topology: any): topology is SessionNode {
  return Bytes.validate(topology)
}

function isImplicitBlacklist(topology: any): topology is ImplicitBlacklist {
  return typeof topology === 'object' && topology !== null && 'blacklist' in topology
}

function isIdentitySignerLeaf(topology: any): topology is IdentitySignerLeaf {
  return typeof topology === 'object' && topology !== null && 'identitySigner' in topology
}

function isSessionPermissions(topology: any): topology is SessionPermissions {
  return typeof topology === 'object' && topology !== null && 'signer' in topology
}

function isSessionsLeaf(topology: any): topology is SessionLeaf {
  return isImplicitBlacklist(topology) || isIdentitySignerLeaf(topology) || isSessionPermissions(topology)
}

function isSessionsBranch(topology: any): topology is SessionBranch {
  return Array.isArray(topology) && topology.length >= 2 && topology.every((child) => isSessionsTopology(child))
}

export function isSessionsTopology(topology: any): topology is SessionsTopology {
  return isSessionsBranch(topology) || isSessionsLeaf(topology) || isSessionsNode(topology)
}

/**
 * Checks if the topology is complete.
 * A complete topology has exactly one identity signer and one blacklist.
 * @param topology The topology to check
 * @returns True if the topology is complete
 */
export function isCompleteSessionsTopology(topology: any): topology is SessionsTopology {
  // Ensure the object is a sessions topology
  if (!isSessionsTopology(topology)) {
    return false
  }
  // Check the topology contains exactly one identity signer and one blacklist
  const { identitySignerCount, blacklistCount } = checkIsCompleteSessionsBranch(topology)
  return identitySignerCount === 1 && blacklistCount === 1
}

function checkIsCompleteSessionsBranch(topology: SessionsTopology): {
  identitySignerCount: number
  blacklistCount: number
} {
  let thisHasIdentitySigner = 0
  let thisHasBlacklist = 0
  if (isSessionsBranch(topology)) {
    for (const child of topology) {
      const { identitySignerCount, blacklistCount } = checkIsCompleteSessionsBranch(child)
      thisHasIdentitySigner += identitySignerCount
      thisHasBlacklist += blacklistCount
    }
  }
  if (isIdentitySignerLeaf(topology)) {
    thisHasIdentitySigner++
  }
  if (isImplicitBlacklist(topology)) {
    thisHasBlacklist++
  }
  return { identitySignerCount: thisHasIdentitySigner, blacklistCount: thisHasBlacklist }
}

/**
 * Gets the identity signer from the topology.
 * @param topology The topology to get the identity signer from
 * @returns The identity signer or null if it's not present
 */
export function getIdentitySigner(topology: SessionsTopology): Address.Address | null {
  if (isIdentitySignerLeaf(topology)) {
    // Got it
    return topology.identitySigner
  }

  if (isSessionsBranch(topology)) {
    // Check branches
    const results = topology.map(getIdentitySigner).filter((t) => t !== null)
    if (results.length > 1) {
      throw new Error('Multiple identity signers')
    }
    if (results.length === 1) {
      return results[0]!
    }
  }

  return null
}

/**
 * Gets the implicit blacklist from the topology.
 * @param topology The topology to get the implicit blacklist from
 * @returns The implicit blacklist or null if it's not present
 */
export function getImplicitBlacklist(topology: SessionsTopology): Address.Address[] | null {
  const blacklistNode = getImplicitBlacklistLeaf(topology)
  if (!blacklistNode) {
    return null
  }
  return blacklistNode.blacklist
}

/**
 * Gets the implicit blacklist leaf from the topology.
 * @param topology The topology to get the implicit blacklist leaf from
 * @returns The implicit blacklist leaf or null if it's not present
 */
export function getImplicitBlacklistLeaf(topology: SessionsTopology): ImplicitBlacklist | null {
  if (isImplicitBlacklist(topology)) {
    // Got it
    return topology
  }

  if (isSessionsBranch(topology)) {
    // Check branches
    const results = topology.map(getImplicitBlacklistLeaf).filter((t) => t !== null)
    if (results.length > 1) {
      throw new Error('Multiple blacklists')
    }
    if (results.length === 1) {
      return results[0]!
    }
  }

  return null
}

export function getSessionPermissions(topology: SessionsTopology, address: Address.Address): SessionPermissions | null {
  if (isSessionPermissions(topology)) {
    if (topology.signer === address) {
      return topology
    }
  }
  if (isSessionsBranch(topology)) {
    for (const child of topology) {
      const result = getSessionPermissions(child, address)
      if (result) {
        return result
      }
    }
  }
  return null
}

// Encode / decode to configuration tree

/**
 * Encodes a leaf to bytes.
 * This can be Hash.keccak256'd to convert to a node..
 * @param leaf The leaf to encode
 * @returns The encoded leaf
 */
export function encodeLeafToBytes(leaf: SessionLeaf): Bytes.Bytes {
  if (isSessionPermissions(leaf)) {
    return Bytes.concat(Bytes.fromNumber(SESSIONS_FLAG_PERMISSIONS), encodeSessionPermissions(leaf))
  }
  if (isImplicitBlacklist(leaf)) {
    return Bytes.concat(
      Bytes.fromNumber(SESSIONS_FLAG_BLACKLIST),
      Bytes.concat(...leaf.blacklist.map((b) => Bytes.padLeft(Bytes.fromHex(b), 20))),
    )
  }
  if (isIdentitySignerLeaf(leaf)) {
    return Bytes.concat(
      Bytes.fromNumber(SESSIONS_FLAG_IDENTITY_SIGNER),
      Bytes.padLeft(Bytes.fromHex(leaf.identitySigner), 20),
    )
  }
  // Unreachable
  throw new Error('Invalid leaf')
}

export function decodeLeafFromBytes(bytes: Bytes.Bytes): SessionLeaf {
  const flag = bytes[0]!
  if (flag === SESSIONS_FLAG_BLACKLIST) {
    const blacklist: `0x${string}`[] = []
    for (let i = 1; i < bytes.length; i += 20) {
      blacklist.push(Bytes.toHex(bytes.slice(i, i + 20)))
    }
    return { blacklist }
  }
  if (flag === SESSIONS_FLAG_IDENTITY_SIGNER) {
    return { identitySigner: Bytes.toHex(bytes.slice(1, 21)) }
  }
  if (flag === SESSIONS_FLAG_PERMISSIONS) {
    return sessionPermissionsFromParsed(bytes.slice(1))
  }
  throw new Error('Invalid leaf')
}

export function sessionsTopologyToConfigurationTree(topology: SessionsTopology): EncodedConfigurationTree {
  if (isSessionsBranch(topology)) {
    return topology.map(sessionsTopologyToConfigurationTree) as EncodedConfigurationBranch
  }
  if (isImplicitBlacklist(topology) || isIdentitySignerLeaf(topology) || isSessionPermissions(topology)) {
    return encodeLeafToBytes(topology)
  }
  if (isSessionsNode(topology)) {
    // A node is already encoded and hashed
    return topology
  }
  throw new Error('Invalid topology')
}

export function configurationTreeToSessionsTopology(tree: EncodedConfigurationTree): SessionsTopology {
  if (isEncodedConfigurationBranch(tree)) {
    return tree.map(configurationTreeToSessionsTopology) as SessionBranch
  }

  try {
    return decodeLeafFromBytes(tree)
  } catch (error) {
    // If we can't decode it, it's a node.
    // This is _probably_ a bug as decoding a node in a configuration tree leads to incomplete topologies.
    return tree as SessionNode
  }
}

// Encoding for contract validation

/**
 * Encodes a topology into bytes for contract validation.
 * @param topology The topology to encode
 * @returns The encoded topology
 */
export function encodeSessionsTopology(topology: SessionsTopology): Bytes.Bytes {
  if (isSessionsBranch(topology)) {
    const encodedBranches = []
    for (const node of topology) {
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

  if (isSessionPermissions(topology)) {
    const flagByte = SESSIONS_FLAG_PERMISSIONS << 4
    const encodedLeaf = encodeSessionPermissions(topology)
    return Bytes.concat(Bytes.fromNumber(flagByte), encodedLeaf)
  }

  if (isSessionsNode(topology)) {
    const flagByte = SESSIONS_FLAG_NODE << 4
    return Bytes.concat(Bytes.fromNumber(flagByte), topology)
  }

  if (isImplicitBlacklist(topology)) {
    const encoded = Bytes.concat(...topology.blacklist.map((b) => Bytes.fromHex(b)))
    if (topology.blacklist.length > 14) {
      // If the blacklist is too large, we can't encode the length into the flag byte.
      // Instead we encode 0xff and the length in the next byte.
      return Bytes.concat(
        Bytes.fromNumber((SESSIONS_FLAG_BLACKLIST << 4) | 0xff),
        Bytes.fromNumber(topology.blacklist.length),
        encoded,
      )
    }
    // Encode the size into the flag byte
    const flagByte = (SESSIONS_FLAG_BLACKLIST << 4) | topology.blacklist.length
    return Bytes.concat(Bytes.fromNumber(flagByte), encoded)
  }

  if (isIdentitySignerLeaf(topology)) {
    const flagByte = SESSIONS_FLAG_IDENTITY_SIGNER << 4
    return Bytes.concat(Bytes.fromNumber(flagByte), Bytes.padLeft(Bytes.fromHex(topology.identitySigner), 20))
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

  if (isImplicitBlacklist(topology) || isIdentitySignerLeaf(topology)) {
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

  // Parse identity signer
  if (typeof parsed === 'object' && parsed !== null && 'identitySigner' in parsed) {
    const identitySigner = parsed.identitySigner as `0x${string}`
    return { identitySigner }
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
 * This does not make a binary tree as the blacklist and identity signer are included at the top level.
 */
export function balanceSessionsTopology(topology: SessionsTopology): SessionsTopology {
  const flattened = flattenSessionsTopology(topology)
  const blacklist = flattened.find((l) => isImplicitBlacklist(l))
  const identitySigner = flattened.find((l) => isIdentitySignerLeaf(l))
  const leaves = flattened.filter((l) => isSessionPermissions(l))
  if (!blacklist || !identitySigner) {
    throw new Error('No blacklist or identity signer')
  }
  return buildBalancedSessionsTopology([blacklist, identitySigner, ...leaves])
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

  if (isIdentitySignerLeaf(topology) || isImplicitBlacklist(topology)) {
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
 * Minimise the topology by rolling unused signers into nodes.
 * @param topology The topology to minimise
 * @param signers The list of signers to consider
 * @returns The minimised topology
 */
export function minimiseSessionsTopology(
  topology: SessionsTopology,
  explicitSigners: Address.Address[] = [],
  implicitSigners: Address.Address[] = [],
): SessionsTopology {
  if (isSessionsBranch(topology)) {
    const branches = topology.map((b) => minimiseSessionsTopology(b, explicitSigners, implicitSigners))
    // If all branches are nodes, the branch can be a node too
    if (branches.every((b) => isSessionsNode(b))) {
      return Hash.keccak256(Bytes.concat(...branches))
    }
    return branches as SessionBranch
  }
  if (isSessionPermissions(topology)) {
    if (explicitSigners.includes(topology.signer)) {
      // Don't role it up as signer permissions must be visible
      return topology
    }
    return Hash.keccak256(encodeLeafToBytes(topology))
  }
  if (isImplicitBlacklist(topology)) {
    if (implicitSigners.length === 0) {
      // No implicit signers, so we can roll up the blacklist
      return Hash.keccak256(encodeLeafToBytes(topology))
    }
    // If there are implicit signers, we can't roll up the blacklist
    return topology
  }
  if (isIdentitySignerLeaf(topology)) {
    // Never roll up the identity signer
    return topology
  }
  if (isSessionsNode(topology)) {
    // Node is already encoded and hashed
    return topology
  }
  // Unreachable
  throw new Error('Invalid topology')
}

/**
 * Adds an address to the implicit session's blacklist.
 * If the address is not already in the blacklist, it is added and the list is sorted.
 */
export function addToImplicitBlacklist(topology: SessionsTopology, address: Address.Address): SessionsTopology {
  const blacklistNode = getImplicitBlacklistLeaf(topology)
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
  const blacklistNode = getImplicitBlacklistLeaf(topology)
  if (!blacklistNode) {
    throw new Error('No blacklist found')
  }
  const { blacklist } = blacklistNode
  const newBlacklist = blacklist.filter((a) => a !== address)
  blacklistNode.blacklist = newBlacklist
  return topology
}

/**
 *  Generate an empty sessions topology with the given identity signer. No session permission and an empty blacklist
 */
export function emptySessionsTopology(identitySigner: Address.Address): SessionsTopology {
  return [
    {
      blacklist: [],
    },
    {
      identitySigner,
    },
  ]
}
