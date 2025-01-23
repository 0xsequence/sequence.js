import { Address, Bytes, Hash, Hex } from 'ox'

export type SignerLeaf = {
  address: Address.Address
  weight: bigint
  imageHash: undefined
}

export type SapientSigner = {
  address: Address.Address
  weight: bigint
  imageHash: Bytes.Bytes
}

export type SubdigestLeaf = {
  digest: Bytes.Bytes
}

export type NestedLeaf = {
  tree: Topology
  weight: bigint
  threshold: bigint
}

export type NodeLeaf = Bytes.Bytes

export type Node = [Topology, Topology]

export type Leaf = SignerLeaf | SubdigestLeaf | NodeLeaf | NestedLeaf | SapientSigner

export type Topology = Node | Leaf

export type Configuration = {
  threshold: bigint
  checkpoint: bigint
  topology: Topology
  checkpointer?: Address.Address
}

export function isSignerLeaf(cand: Topology): cand is SignerLeaf {
  return typeof cand === 'object' && 'address' in cand && 'weight' in cand && !('imageHash' in cand)
}

export function isSapientSigner(cand: Topology): cand is SapientSigner {
  return typeof cand === 'object' && 'address' in cand && 'weight' in cand && 'imageHash' in cand
}

export function isSubdigestLeaf(cand: Topology): cand is SubdigestLeaf {
  return typeof cand === 'object' && 'digest' in cand
}

export function isNodeLeaf(cand: Topology): cand is NodeLeaf {
  return cand instanceof Uint8Array && cand.length === 32
}

export function isNestedLeaf(cand: Topology): cand is NestedLeaf {
  return typeof cand === 'object' && !Array.isArray(cand) && 'tree' in cand && 'weight' in cand && 'threshold' in cand
}

export function isNode(cand: Topology): cand is Node {
  return Array.isArray(cand) && cand.length === 2 && isLeaf(cand[0]) && isLeaf(cand[1])
}

export function isConfiguration(cand: any): cand is Configuration {
  return typeof cand === 'object' && 'threshold' in cand && 'checkpoint' in cand && 'topology' in cand
}

export function isLeaf(cand: Topology): cand is Leaf {
  return isSignerLeaf(cand) || isSapientSigner(cand) || isSubdigestLeaf(cand) || isNodeLeaf(cand) || isNestedLeaf(cand)
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
    root = Hash.keccak256(Bytes.concat(root, Bytes.fromNumber(topology.threshold)))
    root = Hash.keccak256(Bytes.concat(root, Bytes.fromNumber(topology.checkpoint)))
    root = Hash.keccak256(
      Bytes.concat(root, Bytes.fromHex(topology.checkpointer ?? '0x0000000000000000000000000000000000000000')),
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
