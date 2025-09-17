import { Address, Bytes, Hash, Hex } from 'ox'
import * as GenericTree from './generic-tree.js'
import {
  decodeSessionPermissions,
  encodeSessionPermissions,
  encodeSessionPermissionsForJson,
  SessionPermissions,
  sessionPermissionsFromParsed,
} from './permission.js'
import { minBytesFor } from './utils.js'

//FIXME Reorder by expected usage
export const SESSIONS_FLAG_PERMISSIONS = 0
export const SESSIONS_FLAG_NODE = 1
export const SESSIONS_FLAG_BRANCH = 2
export const SESSIONS_FLAG_BLACKLIST = 3
export const SESSIONS_FLAG_IDENTITY_SIGNER = 4

export type ImplicitBlacklistLeaf = {
  type: 'implicit-blacklist'
  blacklist: Address.Address[]
}

export type IdentitySignerLeaf = {
  type: 'identity-signer'
  identitySigner: Address.Address
}

export type SessionPermissionsLeaf = SessionPermissions & {
  type: 'session-permissions'
}

export type SessionNode = Hex.Hex // Hashed leaf
export type SessionLeaf = SessionPermissionsLeaf | ImplicitBlacklistLeaf | IdentitySignerLeaf
export type SessionBranch = [SessionsTopology, SessionsTopology, ...SessionsTopology[]]
export type SessionsTopology = SessionBranch | SessionLeaf | SessionNode

function isSessionsNode(topology: any): topology is SessionNode {
  return Hex.validate(topology) && Hex.size(topology) === 32
}

function isImplicitBlacklist(topology: any): topology is ImplicitBlacklistLeaf {
  return typeof topology === 'object' && topology !== null && 'blacklist' in topology
}

function isIdentitySignerLeaf(topology: any): topology is IdentitySignerLeaf {
  return typeof topology === 'object' && topology !== null && 'identitySigner' in topology
}

function isSessionPermissions(topology: any): topology is SessionPermissionsLeaf {
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
 * A complete topology has at least one identity signer and one blacklist.
 * When performing encoding, exactly one identity signer is required. Others must be hashed into nodes.
 * @param topology The topology to check
 * @returns True if the topology is complete
 */
export function isCompleteSessionsTopology(topology: any): topology is SessionsTopology {
  // Ensure the object is a sessions topology
  if (!isSessionsTopology(topology)) {
    return false
  }
  // Check the topology contains at least one identity signer and exactly one blacklist
  const { identitySignerCount, blacklistCount } = checkIsCompleteSessionsBranch(topology)
  return identitySignerCount >= 1 && blacklistCount === 1
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
 * Gets the identity signers from the topology.
 * @param topology The topology to get the identity signer from
 * @returns The identity signers
 */
export function getIdentitySigners(topology: SessionsTopology): Address.Address[] {
  if (isIdentitySignerLeaf(topology)) {
    // Got one
    return [topology.identitySigner]
  }

  if (isSessionsBranch(topology)) {
    // Check branches
    return topology.map(getIdentitySigners).flat()
  }

  return []
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
export function getImplicitBlacklistLeaf(topology: SessionsTopology): ImplicitBlacklistLeaf | null {
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

export function getSessionPermissions(
  topology: SessionsTopology,
  address: Address.Address,
): SessionPermissionsLeaf | null {
  if (isSessionPermissions(topology)) {
    if (Address.isEqual(topology.signer, address)) {
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

export function getExplicitSigners(topology: SessionsTopology): Address.Address[] {
  return getExplicitSignersFromBranch(topology, [])
}

function getExplicitSignersFromBranch(topology: SessionsTopology, current: Address.Address[]): Address.Address[] {
  if (isSessionPermissions(topology)) {
    return [...current, topology.signer]
  }
  if (isSessionsBranch(topology)) {
    const result: Address.Address[] = [...current]
    for (const child of topology) {
      result.push(...getExplicitSignersFromBranch(child, current))
    }
    return result
  }
  return current
}

// Encode / decode to configuration tree

/**
 * Encodes a leaf to bytes.
 * This can be Hash.keccak256'd to convert to a node..
 * @param leaf The leaf to encode
 * @returns The encoded leaf
 */
export function encodeLeafToGeneric(leaf: SessionLeaf): GenericTree.Leaf {
  if (isSessionPermissions(leaf)) {
    return {
      type: 'leaf',
      value: Bytes.concat(Bytes.fromNumber(SESSIONS_FLAG_PERMISSIONS), encodeSessionPermissions(leaf)),
    }
  }
  if (isImplicitBlacklist(leaf)) {
    return {
      type: 'leaf',
      value: Bytes.concat(
        Bytes.fromNumber(SESSIONS_FLAG_BLACKLIST),
        Bytes.concat(...leaf.blacklist.map((b) => Bytes.padLeft(Bytes.fromHex(b), 20))),
      ),
    }
  }
  if (isIdentitySignerLeaf(leaf)) {
    return {
      type: 'leaf',
      value: Bytes.concat(
        Bytes.fromNumber(SESSIONS_FLAG_IDENTITY_SIGNER),
        Bytes.padLeft(Bytes.fromHex(leaf.identitySigner), 20),
      ),
    }
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
    return { type: 'implicit-blacklist', blacklist }
  }
  if (flag === SESSIONS_FLAG_IDENTITY_SIGNER) {
    return { type: 'identity-signer', identitySigner: Bytes.toHex(bytes.slice(1, 21)) }
  }
  if (flag === SESSIONS_FLAG_PERMISSIONS) {
    return { type: 'session-permissions', ...decodeSessionPermissions(bytes.slice(1)) }
  }
  throw new Error('Invalid leaf')
}

export function sessionsTopologyToConfigurationTree(topology: SessionsTopology): GenericTree.Tree {
  if (isSessionsBranch(topology)) {
    return topology.map(sessionsTopologyToConfigurationTree) as GenericTree.Branch
  }
  if (isImplicitBlacklist(topology) || isIdentitySignerLeaf(topology) || isSessionPermissions(topology)) {
    return encodeLeafToGeneric(topology)
  }
  if (isSessionsNode(topology)) {
    // A node is already encoded and hashed
    return topology
  }
  throw new Error('Invalid topology')
}

export function configurationTreeToSessionsTopology(tree: GenericTree.Tree): SessionsTopology {
  if (GenericTree.isBranch(tree)) {
    return tree.map(configurationTreeToSessionsTopology) as SessionBranch
  }

  if (GenericTree.isNode(tree)) {
    throw new Error('Unknown in configuration tree')
  }

  return decodeLeafFromBytes(tree.value)
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
    return Bytes.concat(Bytes.fromNumber(flagByte), Hex.toBytes(topology))
  }

  if (isImplicitBlacklist(topology)) {
    const encoded = Bytes.concat(...topology.blacklist.map((b) => Bytes.fromHex(b)))
    if (topology.blacklist.length >= 0x0f) {
      // If the blacklist is too large, we can't encode the length into the flag byte.
      // Instead we encode 0x0f and the length in the next 2 bytes.
      if (topology.blacklist.length > 0xffff) {
        throw new Error('Blacklist too large')
      }
      return Bytes.concat(
        Bytes.fromNumber((SESSIONS_FLAG_BLACKLIST << 4) | 0x0f),
        Bytes.fromNumber(topology.blacklist.length, { size: 2 }),
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
    return topology
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
  if (typeof parsed === 'string' && Hex.validate(parsed) && Hex.size(parsed) === 32) {
    return parsed
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
    return { type: 'session-permissions', ...sessionPermissionsFromParsed(parsed) }
  }

  // Parse identity signer
  if (typeof parsed === 'object' && parsed !== null && 'identitySigner' in parsed) {
    const identitySigner = parsed.identitySigner as `0x${string}`
    return { type: 'identity-signer', identitySigner }
  }

  // Parse blacklist
  if (typeof parsed === 'object' && parsed !== null && 'blacklist' in parsed) {
    const blacklist = parsed.blacklist.map((address: any) => Address.from(address))
    return { type: 'implicit-blacklist', blacklist }
  }

  throw new Error('Invalid topology')
}

// Operations

function removeLeaf(topology: SessionsTopology, leaf: SessionLeaf | SessionNode): SessionsTopology | null {
  if (isSessionsLeaf(topology) && isSessionsLeaf(leaf)) {
    if (topology.type === leaf.type) {
      if (isSessionPermissions(topology) && isSessionPermissions(leaf)) {
        if (Address.isEqual(topology.signer, leaf.signer)) {
          return null
        }
      } else if (isImplicitBlacklist(topology) && isImplicitBlacklist(leaf)) {
        // Remove blacklist items in leaf from topology
        const newBlacklist = topology.blacklist.filter((b) => !leaf.blacklist.includes(b))
        if (newBlacklist.length === 0) {
          return null
        }
        return { type: 'implicit-blacklist', blacklist: newBlacklist }
      } else if (isIdentitySignerLeaf(topology) && isIdentitySignerLeaf(leaf)) {
        // Remove identity signer from topology
        if (Address.isEqual(topology.identitySigner, leaf.identitySigner)) {
          return null
        }
      }
    }
  } else if (isSessionsNode(topology) && isSessionsNode(leaf)) {
    if (Hex.isEqual(topology, leaf)) {
      // Match, remove the node
      return null
    }
  }

  // If it's a branch, recurse on each child:
  if (isSessionsBranch(topology)) {
    const newChildren: SessionsTopology[] = []
    for (const child of topology) {
      const updatedChild = removeLeaf(child, leaf)
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
 * Removes all explicit sessions (permissions leaf nodes) that match the given signer from the topology.
 * Returns the updated topology or null if it becomes empty (for nesting).
 * If the signer is not found, the topology is returned unchanged.
 */
export function removeExplicitSession(
  topology: SessionsTopology,
  signerAddress: `0x${string}`,
): SessionsTopology | null {
  const explicitLeaf = getSessionPermissions(topology, signerAddress)
  if (!explicitLeaf) {
    // Not found, return unchanged
    return topology
  }
  const removed = removeLeaf(topology, explicitLeaf)
  if (!removed) {
    // Empty, return null
    return null
  }
  // Balance it
  return balanceSessionsTopology(removed)
}

export function addExplicitSession(
  topology: SessionsTopology,
  sessionPermissions: SessionPermissions,
): SessionsTopology {
  // Find the session in the topology
  if (getSessionPermissions(topology, sessionPermissions.signer)) {
    throw new Error('Session already exists')
  }
  // Merge and balance
  const merged = mergeSessionsTopologies(topology, { type: 'session-permissions', ...sessionPermissions })
  return balanceSessionsTopology(merged)
}

export function removeIdentitySigner(
  topology: SessionsTopology,
  identitySigner: Address.Address,
): SessionsTopology | null {
  const identityLeaf: IdentitySignerLeaf = {
    type: 'identity-signer',
    identitySigner,
  }
  // Remove the old identity signer and balance
  const removed = removeLeaf(topology, identityLeaf)
  if (!removed) {
    // Empty, return null
    return null
  }
  return balanceSessionsTopology(removed)
}

export function addIdentitySigner(topology: SessionsTopology, identitySigner: Address.Address): SessionsTopology {
  // Find the session in the topology
  if (getIdentitySigners(topology).some((s) => Address.isEqual(s, identitySigner))) {
    throw new Error('Identity signer already exists')
  }
  // Merge and balance
  const merged = mergeSessionsTopologies(topology, { type: 'identity-signer', identitySigner })
  return balanceSessionsTopology(merged)
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
  return buildBalancedSessionsTopology(flattenSessionsTopology(topology))
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
  identitySigner?: Address.Address,
): SessionsTopology {
  if (isSessionsBranch(topology)) {
    const branches = topology.map((b) => minimiseSessionsTopology(b, explicitSigners, implicitSigners, identitySigner))
    // If all branches are nodes, the branch can be a node too
    if (branches.every((b) => isSessionsNode(b))) {
      return Hash.keccak256(Bytes.concat(...branches.map((b) => Hex.toBytes(b))), { as: 'Hex' })
    }
    return branches as SessionBranch
  }
  if (isSessionPermissions(topology)) {
    if (explicitSigners.includes(topology.signer)) {
      // Don't role it up as signer permissions must be visible
      return topology
    }
    return GenericTree.hash(encodeLeafToGeneric(topology))
  }
  if (isImplicitBlacklist(topology)) {
    if (implicitSigners.length === 0) {
      // No implicit signers, so we can roll up the blacklist
      return GenericTree.hash(encodeLeafToGeneric(topology))
    }
    // If there are implicit signers, we can't roll up the blacklist
    return topology
  }
  if (isIdentitySignerLeaf(topology)) {
    if (identitySigner && !Address.isEqual(topology.identitySigner, identitySigner)) {
      // Not the identity signer we're looking for, so roll it up
      return GenericTree.hash(encodeLeafToGeneric(topology))
    }
    // Return this identity signer leaf
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
  if (blacklist.some((addr) => Address.isEqual(addr, address))) {
    return topology
  }
  blacklist.push(address)
  blacklist.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1)) // keep sorted so on-chain binary search works as expected
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
      type: 'implicit-blacklist',
      blacklist: [],
    },
    {
      type: 'identity-signer',
      identitySigner,
    },
  ]
}
