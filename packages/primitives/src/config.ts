import { Bytes, Hash, Hex } from 'ox'

/**
 *  Types for the topology of the tree
 */
export type SignerLeaf = {
  address: `0x${string}`
  weight: bigint
}

export type SapientSigner = {
  address: `0x${string}`
  weight: bigint
  imageHash: Uint8Array
}

export type SubdigestLeaf = {
  digest: Uint8Array
}

export type NestedLeaf = {
  tree: Topology
  weight: bigint
  threshold: bigint
}

export type NodeLeaf = {
  nodeHash: Uint8Array
}

export type Leaf = SignerLeaf | SubdigestLeaf | NodeLeaf | NestedLeaf | SapientSigner

export type Node = {
  left: Topology
  right: Topology
}

export type Topology = Node | Leaf

export type Configuration = {
  threshold: bigint
  checkpoint: bigint
  topology: Topology
  checkpointer?: `0x${string}`
}

export function isSignerLeaf(cand: Topology): cand is SignerLeaf {
  return typeof cand === 'object' && 'address' in cand && 'weight' in cand
}

export function isSapientSigner(cand: Topology): cand is SapientSigner {
  return typeof cand === 'object' && 'address' in cand && 'weight' in cand && 'imageHash' in cand
}

export function isSubdigestLeaf(cand: Topology): cand is SubdigestLeaf {
  return typeof cand === 'object' && 'digest' in cand
}

export function isNodeLeaf(cand: Topology): cand is NodeLeaf {
  return typeof cand === 'object' && 'nodeHash' in cand
}

export function isNestedLeaf(cand: Topology): cand is NestedLeaf {
  return typeof cand === 'object' && 'tree' in cand && 'weight' in cand && 'threshold' in cand
}

export function isNode(cand: Topology): cand is Node {
  return typeof cand === 'object' && 'left' in cand && 'right' in cand
}

export function isConfiguration(cand: any): cand is Configuration {
  return (
    typeof cand === 'object' && 'threshold' in cand && 'checkpoint' in cand && 'topology' in cand
  )
}

export function isLeaf(cand: Topology): cand is Leaf {
  return (
    isSignerLeaf(cand) ||
    isSapientSigner(cand) ||
    isSubdigestLeaf(cand) ||
    isNodeLeaf(cand) ||
    isNestedLeaf(cand)
  )
}

function hashConfiguration(topology: Topology | Configuration): Uint8Array {
  if (isConfiguration(topology)) {
    let root = hashConfiguration(topology.topology)
    root = Hash.keccak256(Bytes.concat(root, Bytes.fromNumber(topology.threshold)))
    root = Hash.keccak256(Bytes.concat(root, Bytes.fromNumber(topology.checkpoint)))
    root = Hash.keccak256(
      Bytes.concat(
        root,
        Bytes.fromHex(topology.checkpointer ?? '0x0000000000000000000000000000000000000000')
      )
    )
    return root
  }

  if (isSignerLeaf(topology)) {
    const addrBigInt = Hex.toBigInt(topology.address)
    const combined = (topology.weight << 160n) | addrBigInt
    return Bytes.padLeft(Bytes.fromNumber(combined), 32)
  }

  if (isSapientSigner(topology)) {
    return Hash.keccak256(
      Bytes.concat(
        Bytes.fromString('Sequence sapient config:\n'),
        Bytes.fromHex(topology.address),
        Bytes.padLeft(Bytes.fromNumber(topology.weight), 32),
        topology.imageHash
      )
    )
  }

  if (isSubdigestLeaf(topology)) {
    return Hash.keccak256(
      Bytes.concat(Bytes.fromString('Sequence static digest:\n'), topology.digest)
    )
  }

  if (isNodeLeaf(topology)) {
    return topology.nodeHash
  }

  if (isNestedLeaf(topology)) {
    return Hash.keccak256(
      Bytes.concat(
        Bytes.fromString('Sequence nested config:\n'),
        hashConfiguration(topology.tree),
        Bytes.padLeft(Bytes.fromNumber(topology.threshold), 32),
        Bytes.padLeft(Bytes.fromNumber(topology.weight), 32)
      )
    )
  }

  if (isNode(topology)) {
    return Hash.keccak256(
      Bytes.concat(hashConfiguration(topology.left), hashConfiguration(topology.right))
    )
  }

  throw new Error('Invalid topology')
}
