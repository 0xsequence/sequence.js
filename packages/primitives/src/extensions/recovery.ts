import { Address, Bytes, Hash, Hex } from 'ox'
import * as Payload from '../payload'
import { getSignPayload } from 'ox/TypedData'

export const FLAG_RECOVERY_LEAF = 1
export const FLAG_NODE = 3
export const FLAG_BRANCH = 4

/**
 * A leaf in the Recovery tree, storing:
 *  - signer who can queue a payload
 *  - requiredDeltaTime how many seconds must pass since the payload is queued
 *  - minTimestamp a minimal timestamp that must be at or below the queueing time
 */
export type RecoveryLeaf = {
  type: 'leaf'
  signer: Address.Address
  requiredDeltaTime: bigint
  minTimestamp: bigint
}

/**
 * A node is just a 32-byte hash
 */
export type NodeLeaf = Hex.Hex

/**
 * A branch is a list of subtrees (≥2 in length).
 */
export type Node = [Node, Node]

/**
 * The topology of a recovery tree can be either:
 * - A node (pair of subtrees)
 * - A node leaf (32-byte hash)
 * - A recovery leaf (signer with timing constraints)
 */
export type Topology = Node | NodeLeaf | RecoveryLeaf

/**
 * Type guard to check if a value is a RecoveryLeaf
 */
export function isRecoveryLeaf(cand: any): cand is RecoveryLeaf {
  return typeof cand === 'object' && cand !== null && cand.type === 'leaf'
}

/**
 * Type guard to check if a value is a NodeLeaf (32-byte hash)
 */
export function isNodeLeaf(cand: any): cand is NodeLeaf {
  return typeof cand === 'string' && cand.length === 66 && cand.startsWith('0x')
}

/**
 * Type guard to check if a value is a Node (pair of subtrees)
 */
export function isNode(cand: any): cand is Node {
  return Array.isArray(cand) && cand.length === 2 && isNode(cand[0]) && isNode(cand[1])
}

/**
 * EIP-712 domain parameters for "Sequence Wallet - Recovery Mode"
 */
export const DOMAIN_NAME = 'Sequence Wallet - Recovery Mode'
export const DOMAIN_VERSION = '1'

/**
 * Recursively computes the root hash of a RecoveryTree,
 * consistent with the contract's fkeccak256 usage for (root, node).
 *
 * For recovery leaves, it hashes the leaf data with a prefix.
 * For node leaves, it returns the hash directly.
 * For nodes, it hashes the concatenation of the hashes of both subtrees.
 */
export function hashConfiguration(topology: Topology): Hex.Hex {
  if (isRecoveryLeaf(topology)) {
    return Hash.keccak256(
      Bytes.concat(
        Bytes.fromString('Sequence recovery leaf:\n'),
        Bytes.fromHex(topology.signer, { size: 20 }),
        Bytes.padLeft(Bytes.fromNumber(topology.requiredDeltaTime), 32),
        Bytes.padLeft(Bytes.fromNumber(topology.minTimestamp), 32),
      ),
      { as: 'Hex' },
    )
  } else if (isNodeLeaf(topology)) {
    return topology
  } else if (isNode(topology)) {
    return Hash.keccak256(Hex.concat(hashConfiguration(topology[0]), hashConfiguration(topology[1])), { as: 'Hex' })
  } else {
    throw new Error('Invalid topology')
  }
}

/**
 * Flatten a RecoveryTree into an array of just the leaves.
 * Ignores branch boundaries or node references.
 *
 * @returns Object containing:
 * - leaves: Array of RecoveryLeaf nodes
 * - isComplete: boolean indicating if all leaves are present (no node references)
 */
export function getRecoveryLeaves(topology: Topology): { leaves: RecoveryLeaf[]; isComplete: boolean } {
  const isComplete = true
  if (isRecoveryLeaf(topology)) {
    return { leaves: [topology], isComplete }
  } else if (isNodeLeaf(topology)) {
    return { leaves: [], isComplete: false }
  } else if (isNode(topology)) {
    const left = getRecoveryLeaves(topology[0])
    const right = getRecoveryLeaves(topology[1])
    return { leaves: [...left.leaves, ...right.leaves], isComplete: left.isComplete && right.isComplete }
  } else {
    throw new Error('Invalid topology')
  }
}

/**
 * Decode a binary encoded topology into a Topology object
 *
 * @param encoded - The binary encoded topology
 * @returns The decoded Topology object
 * @throws Error if the encoding is invalid
 */
export function decodeTopology(encoded: Bytes.Bytes): Topology {
  const { nodes, leftover } = parseBranch(encoded)
  if (leftover.length > 0) {
    throw new Error('Leftover bytes in branch')
  }
  return foldNodes(nodes)
}

/**
 * Parse a branch of the topology from binary encoding
 *
 * @param encoded - The binary encoded branch
 * @returns Object containing:
 * - nodes: Array of parsed Topology nodes
 * - leftover: Any remaining unparsed bytes
 * @throws Error if the encoding is invalid
 */
export function parseBranch(encoded: Bytes.Bytes): { nodes: Topology[]; leftover: Bytes.Bytes } {
  if (encoded.length === 0) {
    throw new Error('Empty branch')
  }

  const nodes: Topology[] = []
  let index = 0

  while (index < encoded.length) {
    const flag = encoded[index]!
    if (flag === FLAG_RECOVERY_LEAF) {
      if (encoded.length < index + 85) {
        throw new Error('Invalid recovery leaf')
      }
      const signer = Address.from(Hex.fromBytes(encoded.slice(index + 1, index + 21)))
      const requiredDeltaTime = Bytes.toBigInt(encoded.slice(index + 21, index + 53))
      const minTimestamp = Bytes.toBigInt(encoded.slice(index + 53, index + 85))
      nodes.push({ type: 'leaf', signer, requiredDeltaTime, minTimestamp })
      index += 85
      continue
    } else if (flag === FLAG_NODE) {
      if (encoded.length < index + 33) {
        throw new Error('Invalid node')
      }
      // Read just the first 32 bytes of the node
      const node = Hex.fromBytes(encoded.slice(index + 1, index + 33))
      nodes.push(node)
      index += 33
      continue
    } else if (flag === FLAG_BRANCH) {
      if (encoded.length < index + 4) {
        throw new Error('Invalid branch')
      }
      const size = Bytes.toNumber(encoded.slice(index + 1, index + 4))
      if (encoded.length < index + 4 + size) {
        throw new Error('Invalid branch')
      }
      const branch = encoded.slice(index + 4, index + 4 + size)
      const { nodes: subNodes, leftover } = parseBranch(branch)
      if (leftover.length > 0) {
        throw new Error('Leftover bytes in sub-branch')
      }
      const subTree = foldNodes(subNodes)
      nodes.push(subTree)
      index += 4 + size
      continue
    } else {
      throw new Error('Invalid flag')
    }
  }

  return { nodes, leftover: encoded.slice(index) }
}

/**
 * Trim a topology tree to only include leaves for a specific signer.
 * All other leaves are replaced with their hashes.
 *
 * @param topology - The topology to trim
 * @param signer - The signer address to keep
 * @returns The trimmed topology
 */
export function trimTopology(topology: Topology, signer: Address.Address): Topology {
  if (isRecoveryLeaf(topology)) {
    if (topology.signer === signer) {
      return topology
    } else {
      return hashConfiguration(topology)
    }
  }

  if (isNodeLeaf(topology)) {
    return topology
  }

  if (isNode(topology)) {
    const left = trimTopology(topology[0], signer)
    const right = trimTopology(topology[1], signer)

    // If both are hashes, we can just return the hash of the node
    if (isNodeLeaf(left) && isNodeLeaf(right)) {
      return hashConfiguration(topology)
    }

    return [left, right] as Node
  }

  throw new Error('Invalid topology')
}

/**
 * Encode a topology into its binary representation
 *
 * @param topology - The topology to encode
 * @returns The binary encoded topology
 * @throws Error if the topology is invalid
 */
export function encodeTopology(topology: Topology): Bytes.Bytes {
  if (isNode(topology)) {
    const encoded0 = encodeTopology(topology[0]!)
    const encoded1 = encodeTopology(topology[1]!)
    const isBranching = isNode(topology[1]!)

    if (isBranching) {
      // max 3 bytes for the size
      if (encoded1.length > 16777215) {
        throw new Error('Branch too large')
      }

      const flag = Bytes.fromNumber(FLAG_BRANCH)
      const size = Bytes.padLeft(Bytes.fromNumber(encoded1.length), 3)
      return Bytes.concat(encoded0, flag, size, encoded1)
    } else {
      return Bytes.concat(encoded0, encoded1)
    }
  }

  if (isNodeLeaf(topology)) {
    return Bytes.fromHex(topology)
  }

  if (isRecoveryLeaf(topology)) {
    const flag = Bytes.fromNumber(FLAG_RECOVERY_LEAF)
    const signer = Bytes.fromHex(topology.signer, { size: 20 })
    const requiredDeltaTime = Bytes.padLeft(Bytes.fromNumber(topology.requiredDeltaTime), 32)
    const minTimestamp = Bytes.padLeft(Bytes.fromNumber(topology.minTimestamp), 32)
    return Bytes.concat(flag, signer, requiredDeltaTime, minTimestamp)
  }

  throw new Error('Invalid topology')
}

/**
 * Helper function to fold a list of nodes into a binary tree structure
 *
 * @param nodes - Array of topology nodes
 * @returns A binary tree structure
 * @throws Error if the nodes array is empty
 */
function foldNodes(nodes: Topology[]): Topology {
  if (nodes.length === 0) {
    throw new Error('Empty signature tree')
  }

  if (nodes.length === 1) {
    return nodes[0]!
  }

  let tree: Topology = nodes[0]!
  for (let i = 1; i < nodes.length; i++) {
    tree = [tree, nodes[i]!] as Topology
  }
  return tree
}

/**
 * Build a RecoveryTree from an array of leaves, making a minimal branch structure.
 * If there's exactly one leaf, we return that leaf. If there's more than one, we
 * build a branch of them in pairs.
 *
 * @param leaves - Array of recovery leaves
 * @returns A topology tree structure
 * @throws Error if the leaves array is empty
 */
export function fromRecoveryLeaves(leaves: RecoveryLeaf[]): Topology {
  if (leaves.length === 0) {
    throw new Error('Cannot build a tree with zero leaves')
  }

  if (leaves.length === 1) {
    return leaves[0] as RecoveryLeaf
  }

  const mid = Math.floor(leaves.length / 2)
  const left = fromRecoveryLeaves(leaves.slice(0, mid))
  const right = fromRecoveryLeaves(leaves.slice(mid))
  return [left, right] as Node
}

/**
 * Creates the EIP-712 domain separator for the "Sequence Wallet - Recovery Mode" domain
 *
 * @param wallet - The wallet address
 * @param chainId - The chain ID
 * @param noChainId - Whether to omit the chain ID from the domain separator
 * @returns The domain separator hash
 */
export function domainSeparator(wallet: Address.Address, chainId: bigint, noChainId: boolean): Hex.Hex {
  // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
  const EIP712_DOMAIN_TYPEHASH = Hash.keccak256(
    Bytes.fromString('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
  )
  const nameHash = Hash.keccak256(Bytes.fromString(DOMAIN_NAME))
  const versionHash = Hash.keccak256(Bytes.fromString(DOMAIN_VERSION))

  const chain = noChainId ? 0 : Number(chainId)
  const encoded = Bytes.concat(
    EIP712_DOMAIN_TYPEHASH,
    nameHash,
    versionHash,
    Bytes.padLeft(Bytes.fromNumber(chain), 32),
    Bytes.padLeft(Bytes.fromHex(wallet), 32),
  )
  return Hash.keccak256(encoded, { as: 'Hex' })
}

/**
 * Produces an EIP-712 typed data hash for a "recovery mode" payload,
 * matching the logic in Recovery.sol:
 *
 *   keccak256(
 *     "\x19\x01",
 *     domainSeparator(noChainId, wallet),
 *     Payload.toEIP712(payload)
 *   )
 *
 * @param payload - The payload to hash
 * @param wallet - The wallet address
 * @param chainId - The chain ID
 * @param noChainId - Whether to omit the chain ID from the domain separator
 * @returns The payload hash
 */
export function hashRecoveryPayload(
  payload: Payload.Parented,
  wallet: Address.Address,
  chainId: bigint,
  noChainId: boolean,
): Hex.Hex {
  const ds = domainSeparator(wallet, chainId, noChainId)
  const structHash = Bytes.fromHex(getSignPayload(Payload.toTyped(wallet, noChainId ? 0n : chainId, payload)))
  return Hash.keccak256(Bytes.concat(Bytes.fromString('\x19\x01'), Hex.toBytes(ds), structHash), { as: 'Hex' })
}
