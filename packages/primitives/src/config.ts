import { Address, Bytes, Hash, Hex } from 'ox'
import {
  isRawConfig,
  isRawNestedLeaf,
  isRawSignerLeaf,
  isSignedSapientSignerLeaf,
  isSignedSignerLeaf,
  RawConfig,
  RawTopology,
  SignatureOfSapientSignerLeaf,
  SignatureOfSignerLeaf,
} from './signature'

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
  imageHash: Hex.Hex
  signed?: boolean
  signature?: SignatureOfSapientSignerLeaf
}

export type SubdigestLeaf = {
  type: 'subdigest'
  digest: Bytes.Bytes
}

export type AnyAddressSubdigestLeaf = {
  type: 'any-address-subdigest'
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

export type Leaf = SignerLeaf | SapientSignerLeaf | SubdigestLeaf | AnyAddressSubdigestLeaf | NestedLeaf | NodeLeaf

export type Topology = Node | Leaf

export type Config = {
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

export function isAnyAddressSubdigestLeaf(cand: any): cand is AnyAddressSubdigestLeaf {
  return typeof cand === 'object' && cand !== null && cand.type === 'any-address-subdigest'
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

export function isConfig(cand: any): cand is Config {
  return typeof cand === 'object' && 'threshold' in cand && 'checkpoint' in cand && 'topology' in cand
}

export function isLeaf(cand: Topology): cand is Leaf {
  return (
    isSignerLeaf(cand) ||
    isSapientSignerLeaf(cand) ||
    isSubdigestLeaf(cand) ||
    isAnyAddressSubdigestLeaf(cand) ||
    isNodeLeaf(cand) ||
    isNestedLeaf(cand)
  )
}

export function isTopology(cand: any): cand is Topology {
  return isNode(cand) || isLeaf(cand)
}

export function getSigners(configuration: Config | Topology): {
  signers: Address.Address[]
  sapientSigners: { address: Address.Address; imageHash: Hex.Hex }[]
  isComplete: boolean
} {
  const signers = new Set<Address.Address>()
  const sapientSigners = new Set<{ address: Address.Address; imageHash: Hex.Hex }>()

  let isComplete = true

  const scan = (topology: Topology) => {
    if (isNode(topology)) {
      scan(topology[0])
      scan(topology[1])
    } else if (isSignerLeaf(topology)) {
      if (topology.weight) {
        signers.add(topology.address)
      }
    } else if (isSapientSignerLeaf(topology)) {
      sapientSigners.add({ address: topology.address, imageHash: topology.imageHash })
    } else if (isNodeLeaf(topology)) {
      isComplete = false
    } else if (isNestedLeaf(topology)) {
      if (topology.weight) {
        scan(topology.tree)
      }
    }
  }

  scan(isConfig(configuration) ? configuration.topology : configuration)
  return { signers: Array.from(signers), sapientSigners: Array.from(sapientSigners), isComplete }
}

export function findSignerLeaf(
  configuration: Config | Topology,
  address: Address.Address,
): SignerLeaf | SapientSignerLeaf | undefined {
  if (isConfig(configuration)) {
    return findSignerLeaf(configuration.topology, address)
  } else if (isNode(configuration)) {
    return findSignerLeaf(configuration[0], address) || findSignerLeaf(configuration[1], address)
  } else if (isSignerLeaf(configuration)) {
    if (configuration.address === address) {
      return configuration
    }
  } else if (isSapientSignerLeaf(configuration)) {
    if (configuration.address === address) {
      return configuration
    }
  }
  return undefined
}

export function getWeight(
  topology: RawTopology | RawConfig,
  canSign: (signer: SignerLeaf | SapientSignerLeaf) => boolean,
): { weight: bigint; maxWeight: bigint } {
  topology = isRawConfig(topology) ? topology.topology : topology

  if (isSignedSignerLeaf(topology)) {
    return { weight: topology.weight, maxWeight: topology.weight }
  } else if (isSignerLeaf(topology)) {
    return { weight: 0n, maxWeight: canSign(topology) ? topology.weight : 0n }
  } else if (isRawSignerLeaf(topology)) {
    return { weight: topology.weight, maxWeight: topology.weight }
  } else if (isSignedSapientSignerLeaf(topology)) {
    return { weight: topology.weight, maxWeight: topology.weight }
  } else if (isSapientSignerLeaf(topology)) {
    return { weight: 0n, maxWeight: canSign(topology) ? topology.weight : 0n }
  } else if (isSubdigestLeaf(topology)) {
    return { weight: 0n, maxWeight: 0n }
  } else if (isAnyAddressSubdigestLeaf(topology)) {
    return { weight: 0n, maxWeight: 0n }
  } else if (isRawNestedLeaf(topology)) {
    const { weight, maxWeight } = getWeight(topology.tree, canSign)
    return {
      weight: weight >= topology.threshold ? topology.weight : 0n,
      maxWeight: maxWeight >= topology.threshold ? topology.weight : 0n,
    }
  } else if (isNodeLeaf(topology)) {
    return { weight: 0n, maxWeight: 0n }
  } else {
    const [left, right] = [getWeight(topology[0], canSign), getWeight(topology[1], canSign)]
    return { weight: left.weight + right.weight, maxWeight: left.maxWeight + right.maxWeight }
  }
}

export function hashConfiguration(topology: Topology | Config): Bytes.Bytes {
  if (isConfig(topology)) {
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
        Bytes.padLeft(Bytes.fromHex(topology.imageHash), 32),
      ),
    )
  }

  if (isSubdigestLeaf(topology)) {
    return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence static digest:\n'), topology.digest))
  }

  if (isAnyAddressSubdigestLeaf(topology)) {
    return Hash.keccak256(Bytes.concat(Bytes.fromString('Sequence any address subdigest:\n'), topology.digest))
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

export function configToJson(config: Config): string {
  return JSON.stringify({
    threshold: config.threshold.toString(),
    checkpoint: config.checkpoint.toString(),
    topology: encodeTopology(config.topology),
    checkpointer: config.checkpointer,
  })
}

export function configFromJson(json: string): Config {
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
      imageHash: top.imageHash,
    }
  } else if (isSubdigestLeaf(top)) {
    return {
      type: 'subdigest',
      digest: Bytes.toHex(top.digest),
    }
  } else if (isAnyAddressSubdigestLeaf(top)) {
    return {
      type: 'any-address-subdigest',
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
        imageHash: obj.imageHash,
      }
    case 'subdigest':
      return {
        type: 'subdigest',
        digest: Bytes.fromHex(obj.digest),
      }
    case 'any-address-subdigest':
      return {
        type: 'any-address-subdigest',
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

export type SignerSignature<T> = [T] extends [Promise<unknown>]
  ? never
  : MaybePromise<T> | { signature: Promise<T>; onSignerSignature?: SignerSignatureCallback; onCancel?: CancelCallback }

export function normalizeSignerSignature<T>(signature: SignerSignature<T>): {
  signature: Promise<T>
  onSignerSignature?: SignerSignatureCallback
  onCancel?: CancelCallback
} {
  if (signature instanceof Promise) {
    return { signature }
  } else if (
    typeof signature === 'object' &&
    signature &&
    'signature' in signature &&
    signature.signature instanceof Promise
  ) {
    return signature as ReturnType<typeof normalizeSignerSignature>
  } else {
    return { signature: Promise.resolve(signature) as Promise<T> }
  }
}

export type SignerErrorCallback = (signer: SignerLeaf | SapientSignerLeaf, error: unknown) => void

type SignerSignatureCallback = (topology: RawTopology) => void
type CancelCallback = (success: boolean) => void
type MaybePromise<T> = T | Promise<T>

export function mergeTopology(a: Topology, b: Topology): Topology {
  if (isNode(a) && isNode(b)) {
    return [mergeTopology(a[0], b[0]), mergeTopology(a[1], b[1])]
  }

  if (isNode(a) && !isNode(b)) {
    if (!isNodeLeaf(b)) {
      throw new Error('Topology mismatch: cannot merge node with non-node that is not a node leaf')
    }
    const hb = hashConfiguration(b)
    if (!Bytes.isEqual(hb, hashConfiguration(a))) {
      throw new Error('Topology mismatch: node hash does not match')
    }
    return a
  }

  if (!isNode(a) && isNode(b)) {
    if (!isNodeLeaf(a)) {
      throw new Error('Topology mismatch: cannot merge node with non-node that is not a node leaf')
    }
    const ha = hashConfiguration(a)
    if (!Bytes.isEqual(ha, hashConfiguration(b))) {
      throw new Error('Topology mismatch: node hash does not match')
    }
    return b
  }

  return mergeLeaf(a as Leaf, b as Leaf)
}

function mergeLeaf(a: Leaf, b: Leaf): Leaf {
  if (isNodeLeaf(a) && isNodeLeaf(b)) {
    if (!Bytes.isEqual(a, b)) {
      throw new Error('Topology mismatch: different node leaves')
    }
    return a
  }

  if (isNodeLeaf(a) && !isNodeLeaf(b)) {
    const hb = hashConfiguration(b)
    if (!Bytes.isEqual(hb, a)) {
      throw new Error('Topology mismatch: node leaf hash does not match')
    }
    return b
  }

  if (!isNodeLeaf(a) && isNodeLeaf(b)) {
    const ha = hashConfiguration(a)
    if (!Bytes.isEqual(ha, b)) {
      throw new Error('Topology mismatch: node leaf hash does not match')
    }
    return a
  }

  if (isSignerLeaf(a) && isSignerLeaf(b)) {
    if (a.address !== b.address || a.weight !== b.weight) {
      throw new Error('Topology mismatch: signer fields differ')
    }
    if (!!a.signed !== !!b.signed || !!a.signature !== !!b.signature) {
      throw new Error('Topology mismatch: signer signature fields differ')
    }
    return a
  }

  if (isSapientSignerLeaf(a) && isSapientSignerLeaf(b)) {
    if (a.address !== b.address || a.weight !== b.weight || a.imageHash !== b.imageHash) {
      throw new Error('Topology mismatch: sapient signer fields differ')
    }
    if (!!a.signed !== !!b.signed || !!a.signature !== !!b.signature) {
      throw new Error('Topology mismatch: sapient signature fields differ')
    }
    return a
  }

  if (isSubdigestLeaf(a) && isSubdigestLeaf(b)) {
    if (!Bytes.isEqual(a.digest, b.digest)) {
      throw new Error('Topology mismatch: subdigest fields differ')
    }
    return a
  }

  if (isAnyAddressSubdigestLeaf(a) && isAnyAddressSubdigestLeaf(b)) {
    if (!Bytes.isEqual(a.digest, b.digest)) {
      throw new Error('Topology mismatch: any-address-subdigest fields differ')
    }
    return a
  }

  if (isNestedLeaf(a) && isNestedLeaf(b)) {
    if (a.weight !== b.weight || a.threshold !== b.threshold) {
      throw new Error('Topology mismatch: nested leaf fields differ')
    }
    const mergedTree = mergeTopology(a.tree, b.tree)
    return {
      type: 'nested',
      weight: a.weight,
      threshold: a.threshold,
      tree: mergedTree,
    }
  }

  throw new Error('Topology mismatch: incompatible leaf types')
}
