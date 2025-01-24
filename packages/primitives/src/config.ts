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

export function isSignerLeaf(cand: any): cand is SignerLeaf {
  return typeof cand === 'object' && 'address' in cand && 'weight' in cand && !('imageHash' in cand)
}

export function isSapientSignerLeaf(cand: any): cand is SapientSigner {
  return typeof cand === 'object' && 'address' in cand && 'weight' in cand && 'imageHash' in cand
}

export function isSubdigestLeaf(cand: any): cand is SubdigestLeaf {
  return typeof cand === 'object' && 'digest' in cand
}

export function isNodeLeaf(cand: any): cand is NodeLeaf {
  return cand instanceof Uint8Array && cand.length === 32
}

export function isNestedLeaf(cand: any): cand is NestedLeaf {
  return typeof cand === 'object' && !Array.isArray(cand) && 'tree' in cand && 'weight' in cand && 'threshold' in cand
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

export function configToJson(item: Topology | Configuration): string {
  function encodeTopology(topology: Topology): any {
    if (isNode(topology)) {
      return {
        type: 'Node',
        left: encodeTopology(topology[0]),
        right: encodeTopology(topology[1]),
      }
    } else if (isSignerLeaf(topology)) {
      return {
        type: 'SignerLeaf',
        address: topology.address,
        weight: topology.weight.toString(),
      }
    } else if (isSapientSignerLeaf(topology)) {
      return {
        type: 'SapientSignerLeaf',
        address: topology.address,
        weight: topology.weight.toString(),
        imageHash: Bytes.toHex(topology.imageHash),
      }
    } else if (isSubdigestLeaf(topology)) {
      return {
        type: 'SubdigestLeaf',
        digest: Bytes.toHex(topology.digest),
      }
    } else if (isNodeLeaf(topology)) {
      return {
        type: 'NodeLeaf',
        data: Bytes.toHex(topology),
      }
    } else if (isNestedLeaf(topology)) {
      return {
        type: 'NestedLeaf',
        tree: encodeTopology(topology.tree),
        weight: topology.weight.toString(),
        threshold: topology.threshold.toString(),
      }
    }
    throw new Error('encodeTopology: Unrecognized Topology')
  }

  if (isConfiguration(item)) {
    return JSON.stringify({
      type: 'Configuration',
      threshold: item.threshold.toString(),
      checkpoint: item.checkpoint.toString(),
      checkpointer: item.checkpointer ?? '0x0000000000000000000000000000000000000000',
      topology: encodeTopology(item.topology),
    })
  } else {
    // It's just a Topology
    return JSON.stringify(encodeTopology(item))
  }
}

export function configFromJson(json: string): Topology | Configuration {
  const parsed = JSON.parse(json)

  function decodeTopology(obj: any): Topology {
    if (!obj || typeof obj !== 'object') {
      throw new Error('decodeTopology: Invalid object')
    }
    switch (obj.type) {
      case 'Node':
        return [decodeTopology(obj.left), decodeTopology(obj.right)]
      case 'SignerLeaf':
        return {
          address: obj.address as Address.Address,
          weight: BigInt(obj.weight),
          imageHash: undefined,
        }
      case 'SapientSignerLeaf':
        return {
          address: obj.address,
          weight: BigInt(obj.weight),
          imageHash: Bytes.fromHex(obj.imageHash),
        }
      case 'SubdigestLeaf':
        return {
          digest: Bytes.fromHex(obj.digest),
        }
      case 'NodeLeaf':
        return Bytes.fromHex(obj.data)
      case 'NestedLeaf':
        return {
          tree: decodeTopology(obj.tree),
          weight: BigInt(obj.weight),
          threshold: BigInt(obj.threshold),
        }
      default:
        throw new Error('decodeTopology: Unrecognized type ' + obj.type)
    }
  }

  if (parsed.type === 'Configuration') {
    return {
      threshold: BigInt(parsed.threshold),
      checkpoint: BigInt(parsed.checkpoint),
      checkpointer: parsed.checkpointer ?? '0x0000000000000000000000000000000000000000',
      topology: decodeTopology(parsed.topology),
    }
  } else {
    return decodeTopology(parsed)
  }
}

export function topologyToJson(topology: Topology): string {
  function encodeTopology(top: Topology): any {
    if (isNode(top)) {
      return {
        type: 'Node',
        left: encodeTopology(top[0]),
        right: encodeTopology(top[1]),
      }
    } else if (isSignerLeaf(top)) {
      return {
        type: 'SignerLeaf',
        address: top.address,
        weight: top.weight.toString(),
      }
    } else if (isSapientSignerLeaf(top)) {
      return {
        type: 'SapientSignerLeaf',
        address: top.address,
        weight: top.weight.toString(),
        imageHash: Bytes.toHex(top.imageHash),
      }
    } else if (isSubdigestLeaf(top)) {
      return {
        type: 'SubdigestLeaf',
        digest: Bytes.toHex(top.digest),
      }
    } else if (isNodeLeaf(top)) {
      return {
        type: 'NodeLeaf',
        data: Bytes.toHex(top),
      }
    } else if (isNestedLeaf(top)) {
      return {
        type: 'NestedLeaf',
        tree: encodeTopology(top.tree),
        weight: top.weight.toString(),
        threshold: top.threshold.toString(),
      }
    }
    throw new Error('topologyToJson: Unrecognized Topology')
  }

  return JSON.stringify(encodeTopology(topology))
}

export function topologyFromJson(json: string): Topology {
  // We'll parse just a Topology here
  const parsed = JSON.parse(json)

  function decodeTopology(obj: any): Topology {
    if (!obj || typeof obj !== 'object') {
      throw new Error('topologyFromJson: Invalid object')
    }
    switch (obj.type) {
      case 'Node':
        return [decodeTopology(obj.left), decodeTopology(obj.right)]
      case 'SignerLeaf':
        return {
          address: obj.address,
          weight: BigInt(obj.weight),
          imageHash: undefined,
        }
      case 'SapientSignerLeaf':
        return {
          address: obj.address,
          weight: BigInt(obj.weight),
          imageHash: Bytes.padLeft(Bytes.fromHex(obj.imageHash), 32),
        }
      case 'SubdigestLeaf':
        return {
          digest: Bytes.padLeft(Bytes.fromHex(obj.digest), 32),
        }
      case 'NodeLeaf':
        return Bytes.padLeft(Bytes.fromHex(obj.data), 32)
      case 'NestedLeaf':
        return {
          tree: decodeTopology(obj.tree),
          weight: BigInt(obj.weight),
          threshold: BigInt(obj.threshold),
        }
      default:
        throw new Error('topologyFromJson: Unrecognized type ' + obj.type)
    }
  }

  return decodeTopology(parsed)
}
