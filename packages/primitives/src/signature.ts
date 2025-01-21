import {
  SignerLeaf,
  SapientSigner,
  isSignerLeaf,
  isSapientSigner,
  Topology,
  Leaf,
  NodeLeaf,
  SubdigestLeaf,
} from './config'
import { Bytes } from 'ox'

export type SignedSignerLeaf = SignerLeaf & {
  signature:
    | {
        r: Uint8Array
        s: Uint8Array
        v: number
        type: 'eth_sign' | 'hash'
      }
    | {
        data: Uint8Array
        type: 'erc1271'
      }
}

export type SignedSapientLeaf = SapientSigner & {
  signature: {
    data: Uint8Array
    type: 'sapient' | 'sapient_compact'
  }
}

export type RawSignerLeaf = {
  weight: bigint
  signature:
    | {
        r: Uint8Array
        s: Uint8Array
        v: number
        type: 'eth_sign' | 'hash'
      }
    | {
        address: string
        data: Uint8Array
        type: 'erc1271'
      }
    | {
        address: string
        data: Uint8Array
        type: 'sapient' | 'sapient_compact'
      }
}

export type RawNestedLeaf = {
  tree: RawTopology
  weight: bigint
  threshold: bigint
}

export type RawLeaf = Leaf | RawSignerLeaf | RawNestedLeaf

export type RawNode = [RawTopology, RawTopology]

export type RawTopology = RawNode | RawLeaf

export type RawConfiguration = {
  threshold: bigint
  checkpoint: bigint
  topology: RawTopology
  checkpointer?: `0x${string}`
}

export type RawSignature = {
  noChainId: boolean
  checkpointerData?: Uint8Array
  configuration: RawConfiguration
  suffix?: Omit<RawSignature, 'checkpointerData'>[]
}

export type Signature = {
  noChainId: boolean
  checkpointerData?: Uint8Array
  topology: Topology
  suffix?: Omit<Signature, 'checkpointerData'>[]
}

export function isSignedSignerLeaf(cand: any): cand is SignedSignerLeaf {
  return isSignerLeaf(cand) && 'signature' in cand
}

export function isSignedSapientLeaf(cand: any): cand is SignedSapientLeaf {
  return isSapientSigner(cand) && 'signature' in cand
}

export function decodeSignature(signature: Uint8Array): RawSignature {
  if (signature.length < 1) {
    throw new Error('Signature is empty')
  }

  const flag = signature[0]!
  let index = 1

  // If bit 0 is set => chained signature (not implemented here)
  if ((flag & 0x01) === 0x01) {
    throw new Error('TODO')
  }

  const noChainId = (flag & 0x02) === 0x02

  // bits [2..4] => checkpoint size
  const checkpointSize = (flag & 0x1c) >> 2
  if (index + checkpointSize > signature.length) {
    throw new Error('Not enough bytes for checkpoint')
  }
  const checkpoint = Bytes.toBigInt(signature.slice(index, index + checkpointSize))
  index += checkpointSize

  // bit [5] => threshold size offset
  const thresholdSize = ((flag & 0x20) >> 5) + 1
  if (index + thresholdSize > signature.length) {
    throw new Error('Not enough bytes for threshold')
  }
  const threshold = Bytes.toBigInt(signature.slice(index, index + thresholdSize))
  index += thresholdSize

  let checkpointerAddress: `0x${string}` | undefined
  let checkpointerData: Uint8Array | undefined

  // bit [6] => checkpointer address + data
  if ((flag & 0x40) === 0x40) {
    if (index + 20 > signature.length) {
      throw new Error('Not enough bytes for checkpointer address')
    }
    checkpointerAddress = Bytes.toHex(signature.slice(index, index + 20)) as `0x${string}`
    index += 20

    const checkpointerDataSize = (flag & 0x1c) >> 2
    if (index + checkpointerDataSize > signature.length) {
      throw new Error('Not enough bytes for checkpointer data')
    }
    checkpointerData = signature.slice(index, index + checkpointerDataSize)
    index += checkpointerDataSize
  }

  const { nodes, leftover } = parseBranch(signature.slice(index))
  if (leftover.length !== 0) {
    throw new Error('Leftover bytes in signature')
  }

  const topology = foldNodes(nodes)

  return {
    noChainId,
    checkpointerData,
    configuration: {
      threshold,
      checkpoint,
      topology,
      checkpointer: checkpointerAddress,
    },
  }
}

export function parseBranch(signature: Uint8Array): { nodes: RawTopology[]; leftover: Uint8Array } {
  const nodes: RawTopology[] = []
  let index = 0

  while (index < signature.length) {
    if (index >= signature.length) {
      throw new Error('Unexpected end of signature while parsing branch')
    }
    const firstByte = signature[index]!
    index++

    const flag = (firstByte & 0xf0) >> 4

    // 'hash' or 'eth_sign' (0x00 or 0x07)
    if (flag === 0x00 || flag === 0x07) {
      const v = ((firstByte & 0x10) >> 4) + 27
      let weight = BigInt(firstByte & 0x07)
      if (weight === 0n) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for weight')
        }
        weight = BigInt(signature[index]!)
        index++
      }

      if (index + 64 > signature.length) {
        throw new Error('Not enough bytes for r,s')
      }
      const r = signature.slice(index, index + 32)
      const s = signature.slice(index + 32, index + 64)
      index += 64

      nodes.push({
        weight,
        signature: {
          r,
          s,
          v,
          type: flag === 0x00 ? 'hash' : 'eth_sign',
        },
      } as RawSignerLeaf)
      continue
    }

    // Address (0x01)
    if (flag === 0x01) {
      let weight = BigInt(firstByte & 0x0f)
      if (weight === 0n) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for address weight')
        }
        weight = BigInt(signature[index]!)
        index++
      }

      if (index + 20 > signature.length) {
        throw new Error('Not enough bytes for address')
      }
      const address = signature.slice(index, index + 20)
      index += 20

      nodes.push({
        weight,
        address: Bytes.toHex(address),
      } as SignerLeaf)
      continue
    }

    // ERC1271 (0x02)
    if (flag === 0x02) {
      let weight = BigInt(firstByte & 0x03)
      if (weight === 0n) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for ERC1271 weight')
        }
        weight = BigInt(signature[index]!)
        index++
      }

      if (index + 20 > signature.length) {
        throw new Error('Not enough bytes for ERC1271 signer')
      }
      const signer = signature.slice(index, index + 20)
      index += 20

      const sizeSize = (firstByte & 0x0c) >> 2
      if (index + sizeSize > signature.length) {
        throw new Error('Not enough bytes for ERC1271 size')
      }
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      if (index + size > signature.length) {
        throw new Error('Not enough bytes for ERC1271 sub-signature')
      }
      const subSignature = signature.slice(index, index + size)
      index += size

      nodes.push({
        weight,
        signature: {
          address: Bytes.toHex(signer),
          data: subSignature,
          type: 'erc1271',
        },
      } as RawSignerLeaf)
      continue
    }

    // Node leaf (0x03) => nodeHash
    if (flag === 0x03) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for node hash')
      }
      const node = signature.slice(index, index + 32)
      index += 32

      nodes.push(node)
      continue
    }

    // Branch (0x04)
    if (flag === 0x04) {
      const sizeSize = firstByte & 0x0f
      if (index + sizeSize > signature.length) {
        throw new Error('Not enough bytes for branch size')
      }
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      if (index + size > signature.length) {
        throw new Error('Not enough bytes for branch data')
      }
      const branchBytes = signature.slice(index, index + size)
      index += size

      const { nodes: subNodes, leftover } = parseBranch(branchBytes)
      if (leftover.length > 0) {
        throw new Error('Leftover bytes in sub-branch')
      }

      const subTree = foldNodes(subNodes)
      nodes.push(subTree)
      continue
    }

    // Nested (0x05)
    if (flag === 0x05) {
      let weight = BigInt(firstByte & 0x03)
      if (weight === 0n) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for nested weight')
        }
        weight = BigInt(signature[index]!)
        index++
      }

      let threshold = BigInt((firstByte & 0x0c) >> 2)
      if (threshold === 0n) {
        if (index + 2 > signature.length) {
          throw new Error('Not enough bytes for nested threshold')
        }
        threshold = BigInt(Bytes.toNumber(signature.slice(index, index + 2)))
        index += 2
      }

      if (index + 3 > signature.length) {
        throw new Error('Not enough bytes for nested size')
      }
      const size = Bytes.toNumber(signature.slice(index, index + 3))
      index += 3

      if (index + size > signature.length) {
        throw new Error('Not enough bytes for nested sub-tree')
      }
      const nestedTree = signature.slice(index, index + size)
      index += size

      const { nodes: subNodes, leftover } = parseBranch(nestedTree)
      if (leftover.length > 0) {
        throw new Error('Leftover bytes in nested sub-tree')
      }

      const subTree = foldNodes(subNodes)
      nodes.push({
        tree: subTree,
        weight,
        threshold,
      } as RawNestedLeaf)
      continue
    }

    // Subdigest (0x06)
    if (flag === 0x06) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for subdigest')
      }
      const hardcoded = signature.slice(index, index + 32)
      index += 32

      nodes.push({
        digest: hardcoded,
      } as SubdigestLeaf)
      continue
    }

    // Sapient or Sapient compact (0x09 or 0x0a)
    if (flag === 0x09 || flag === 0x0a) {
      let addrWeight = BigInt(firstByte & 0x03)
      if (addrWeight === 0n) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for sapient weight')
        }
        addrWeight = BigInt(signature[index]!)
        index++
      }

      if (index + 20 > signature.length) {
        throw new Error('Not enough bytes for sapient address')
      }
      const address = signature.slice(index, index + 20)
      index += 20

      const sizeSize = (firstByte & 0x0c) >> 2
      if (index + sizeSize > signature.length) {
        throw new Error('Not enough bytes for sapient signature size')
      }
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      if (index + size > signature.length) {
        throw new Error('Not enough bytes for sapient sub-signature')
      }
      const subSignature = signature.slice(index, index + size)
      index += size

      nodes.push({
        weight: addrWeight,
        signature: {
          address: Bytes.toHex(address),
          data: subSignature,
          type: flag === 0x09 ? 'sapient' : 'sapient_compact',
        },
      } as RawSignerLeaf)
      continue
    }

    throw new Error(`Invalid signature flag: 0x${flag.toString(16)}`)
  }

  return { nodes, leftover: signature.slice(index) }
}

function foldNodes(nodes: RawTopology[]): RawTopology {
  if (nodes.length === 0) {
    throw new Error('Empty signature tree')
  }

  if (nodes.length === 1) {
    return nodes[0]!
  }

  let tree: RawTopology = nodes[0]!
  for (let i = 1; i < nodes.length; i++) {
    tree = [tree, nodes[i]!] as RawNode
  }
  return tree
}
