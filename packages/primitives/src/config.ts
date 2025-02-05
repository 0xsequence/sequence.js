import { Address, Bytes, Hash, Hex } from 'ox'
import { SignatureOfSapientSignerLeaf, SignatureOfSignerLeaf } from './signature'

export type SignerLeaf = {
  type: 'signer'
  address: Address.Address
  weight: bigint
  signed?: boolean
  signature?: SignatureOfSignerLeaf
}

export type SapientSignerLeaf = {
  type: 'sapient-signer'
  address: Address.Address
  weight: bigint
  imageHash: Bytes.Bytes
  signed?: boolean
  signature?: SignatureOfSapientSignerLeaf
}

export type SubdigestLeaf = {
  type: 'subdigest'
  digest: Bytes.Bytes
}

export type NestedLeaf = {
  type: 'nested'
  tree: Topology
  weight: bigint
  threshold: bigint
}

export type NodeLeaf = Bytes.Bytes

export type Node = [Topology, Topology]

export type Leaf = SignerLeaf | SapientSignerLeaf | SubdigestLeaf | NestedLeaf | NodeLeaf

export type Topology = Node | Leaf

export type Configuration = {
  threshold: bigint
  checkpoint: bigint
  topology: Topology
  checkpointer?: Address.Address
}

export function isSignerLeaf(cand: any): cand is SignerLeaf {
  return typeof cand === 'object' && cand !== null && cand.type === 'signer'
}

export function isSapientSignerLeaf(cand: any): cand is SapientSignerLeaf {
  return typeof cand === 'object' && cand !== null && cand.type === 'sapient-signer'
}

export function isSubdigestLeaf(cand: any): cand is SubdigestLeaf {
  return typeof cand === 'object' && cand !== null && cand.type === 'subdigest'
}

export function isNodeLeaf(cand: any): cand is NodeLeaf {
  return cand instanceof Uint8Array && cand.length === 32
}

export function isNestedLeaf(cand: any): cand is NestedLeaf {
  return typeof cand === 'object' && cand !== null && cand.type === 'nested'
}

export function isNode(cand: any): cand is Node {
  return Array.isArray(cand) && cand.length === 2 && isTopology(cand[0]) && isTopology(cand[1])
}

export function isConfiguration(cand: any): cand is Configuration {
  return typeof cand === 'object' && 'threshold' in cand && 'checkpoint' in cand && 'topology' in cand
}

export function isLeaf(cand: Topology): cand is Leaf {
  return (
    isSignerLeaf(cand) || isSapientSignerLeaf(cand) || isSubdigestLeaf(cand) || isNodeLeaf(cand) || isNestedLeaf(cand)
  )
}

export function isTopology(cand: any): cand is Topology {
  return isNode(cand) || isLeaf(cand)
}

export function getSigners(configuration: Configuration | Topology): {
  signers: Address.Address[]
  isComplete: boolean
} {
  const signers = new Set<Address.Address>()
  let isComplete = true

  const scan = (topology: Topology) => {
    if (isNode(topology)) {
      scan(topology[0])
      scan(topology[1])
    } else if (isSignerLeaf(topology)) {
      if (topology.weight) {
        signers.add(topology.address)
      }
    } else if (isNodeLeaf(topology)) {
      isComplete = false
    } else if (isNestedLeaf(topology)) {
      if (topology.weight) {
        scan(topology.tree)
      }
    }
  }

  scan(isConfiguration(configuration) ? configuration.topology : configuration)
  return { signers: Array.from(signers), isComplete }
}

export function getWeight(configuration: Configuration, signers: Address.Address[]): bigint {
  const set = new Set(signers)

  const scan = (topology: Topology): bigint => {
    if (isNode(topology)) {
      return scan(topology[0]) + scan(topology[1])
    } else if (isSignerLeaf(topology)) {
      return set.has(topology.address) ? topology.weight : 0n
    } else if (isSapientSignerLeaf(topology)) {
      return set.has(topology.address) ? topology.weight : 0n
    } else if (isNestedLeaf(topology)) {
      return scan(topology.tree) >= topology.threshold ? topology.weight : 0n
    } else {
      return 0n
    }
  }

  return scan(isConfiguration(configuration) ? configuration.topology : configuration)
}

export function hashConfiguration(topology: Topology | Configuration): Bytes.Bytes {
  if (isConfiguration(topology)) {
    let root = hashConfiguration(topology.topology)
    root = Hash.keccak256(Bytes.concat(root, Bytes.padLeft(Bytes.fromNumber(topology.threshold), 32)))
    root = Hash.keccak256(Bytes.concat(root, Bytes.padLeft(Bytes.fromNumber(topology.checkpoint), 32)))
    root = Hash.keccak256(
      Bytes.concat(
        root,
        Bytes.padLeft(Bytes.fromHex(topology.checkpointer ?? '0x0000000000000000000000000000000000000000'), 32),
      ),
    )
    return root
  }

  if (isSignerLeaf(topology)) {
    return Hash.keccak256(
      Bytes.concat(
        Bytes.fromString('Sequence signer:\n'),
        Bytes.fromHex(topology.address),
        Bytes.padLeft(Bytes.fromNumber(topology.weight), 32),
      ),
    )
  }

  if (isSapientSignerLeaf(topology)) {
    return Hash.keccak256(
      Bytes.concat(
        Bytes.fromString('Sequence sapient config:\n'),
        Bytes.fromHex(topology.address),
        Bytes.padLeft(Bytes.fromNumber(topology.weight), 32),
        topology.imageHash,
      ),
    )
  }

  if (isSubdigestLeaf(topology)) {
    return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence static digest:\n'), topology.digest))
  }

  if (isNodeLeaf(topology)) {
    return topology
  }

  if (isNestedLeaf(topology)) {
    return Hash.keccak256(
      Bytes.concat(
        Bytes.fromString('Sequence nested config:\n'),
        hashConfiguration(topology.tree),
        Bytes.padLeft(Bytes.fromNumber(topology.threshold), 32),
        Bytes.padLeft(Bytes.fromNumber(topology.weight), 32),
      ),
    )
  }

  if (isNode(topology)) {
    return Hash.keccak256(Bytes.concat(hashConfiguration(topology[0]), hashConfiguration(topology[1])))
  }

  throw new Error('Invalid topology')
}

export function flatLeavesToTopology(leaves: Leaf[]): Topology {
  if (leaves.length === 0) {
    throw new Error('Cannot create topology from empty leaves')
  }

  if (leaves.length === 1) {
    return leaves[0]!
  }

  if (leaves.length === 2) {
    return [leaves[0]!, leaves[1]!]
  }

  return [
    flatLeavesToTopology(leaves.slice(0, leaves.length / 2)),
    flatLeavesToTopology(leaves.slice(leaves.length / 2)),
  ]
}

export function configToJson(config: Configuration): string {
  return JSON.stringify({
    threshold: config.threshold.toString(),
    checkpoint: config.checkpoint.toString(),
    topology: encodeTopology(config.topology),
    checkpointer: config.checkpointer,
  })
}

export function configFromJson(json: string): Configuration {
  const parsed = JSON.parse(json)
  return {
    threshold: BigInt(parsed.threshold),
    checkpoint: BigInt(parsed.checkpoint),
    checkpointer: parsed.checkpointer,
    topology: decodeTopology(parsed.topology),
  }
}

function encodeTopology(top: Topology): any {
  if (isNode(top)) {
    return [encodeTopology(top[0]), encodeTopology(top[1])]
  } else if (isSignerLeaf(top)) {
    return {
      type: 'signer',
      address: top.address,
      weight: top.weight.toString(),
    }
  } else if (isSapientSignerLeaf(top)) {
    return {
      type: 'sapient-signer',
      address: top.address,
      weight: top.weight.toString(),
      imageHash: Bytes.toHex(Bytes.padLeft(top.imageHash, 32)),
    }
  } else if (isSubdigestLeaf(top)) {
    return {
      type: 'subdigest',
      digest: Bytes.toHex(top.digest),
    }
  } else if (isNodeLeaf(top)) {
    return Bytes.toHex(top)
  } else if (isNestedLeaf(top)) {
    return {
      type: 'nested',
      tree: encodeTopology(top.tree),
      weight: top.weight.toString(),
      threshold: top.threshold.toString(),
    }
  }

  throw new Error('Invalid topology')
}

function decodeTopology(obj: any): Topology {
  if (Array.isArray(obj)) {
    if (obj.length !== 2) {
      throw new Error('Invalid node structure in JSON')
    }
    return [decodeTopology(obj[0]), decodeTopology(obj[1])]
  }

  if (typeof obj === 'string') {
    return Bytes.padLeft(Bytes.fromHex(obj as `0x${string}`), 32)
  }

  switch (obj.type) {
    case 'signer':
      return {
        type: 'signer',
        address: obj.address,
        weight: BigInt(obj.weight),
      }
    case 'sapient-signer':
      return {
        type: 'sapient-signer',
        address: obj.address,
        weight: BigInt(obj.weight),
        imageHash: Bytes.padLeft(Bytes.fromHex(obj.imageHash), 32),
      }
    case 'subdigest':
      return {
        type: 'subdigest',
        digest: Bytes.fromHex(obj.digest),
      }
    case 'nested':
      return {
        type: 'nested',
        tree: decodeTopology(obj.tree),
        weight: BigInt(obj.weight),
        threshold: BigInt(obj.threshold),
      }
    default:
      throw new Error('Invalid type in topology JSON')
  }
}
