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

export type RawNode = {
  left: RawTopology
  right: RawTopology
}

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
  const flag = signature[0]

  // Chained signature
  if ((flag & 0x01) === 0x01) {
    throw new Error('TODO')
  }

  let index = 1

  // Normal signature
  let noChainId = (flag & 0x02) === 0x02

  // Checkpoint size
  let checkpointSize = (flag & 0x1c) >> 2

  // Read the next `checkpointSize` bytes as the checkpoint
  const checkpoint = Bytes.toBigInt(signature.slice(index, index + checkpointSize))
  index += checkpointSize

  // Read the next `thresholdSize` bytes as the threshold
  const thresholdSize = ((flag & 0x20) >> 5) + 1
  const threshold = Bytes.toBigInt(signature.slice(index, index + thresholdSize))
  index += thresholdSize

  let checkpointerAddress: `0x${string}` | undefined
  let checkpointerData: Uint8Array | undefined

  // Read the checkpointer
  if ((flag & 0x40) === 0x40) {
    // Read the checkpointer address
    checkpointerAddress = Bytes.toHex(signature.slice(index, index + 20))
    index += 20

    // Read the checkpointer data size
    const checkpointerDataSize = (flag & 0x1c) >> 2
    checkpointerData = signature.slice(index, index + checkpointerDataSize)
    index += checkpointerDataSize
  }

  // Parse rest of the signature
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
  let weightSum = 0n

  while (index < signature.length) {
    const firstByte = signature[index]
    index++

    const flag = (firstByte & 0xf0) >> 4

    // Signature hash (0x00)
    if (flag === 0x00 || flag === 0x07) {
      const v = (firstByte & 0x10) >> (4 + 27)
      let weight = firstByte & 0x07
      if (weight === 0) {
        weight = signature[index]
        index++
      }

      const r = signature.slice(index, index + 32)
      const s = signature.slice(index + 32, index + 64)
      index += 64

      weightSum += BigInt(weight)

      nodes.push({
        weight: BigInt(weight),
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
      let weight = firstByte & 0x0f
      if (weight === 0) {
        weight = signature[index]
        index++
      }

      const address = signature.slice(index, index + 20)
      index += 20

      nodes.push({
        weight: BigInt(weight),
        address: Bytes.toHex(address),
      } as SignerLeaf)
      continue
    }

    // Signature ERC1271 (0x02)
    if (flag === 0x02) {
      let weight = firstByte & 0x03
      if (weight === 0) {
        weight = signature[index]
        index++
      }

      // Read signer
      const signer = signature.slice(index, index + 20)
      index += 20

      // Read signature size
      const sizeSize = (firstByte & 0x0c) >> 2
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      const subSignature = signature.slice(index, index + size)
      index += size

      nodes.push({
        weight: BigInt(weight),
        signature: {
          address: Bytes.toHex(signer),
          data: subSignature,
          type: 'erc1271',
        },
      } as RawSignerLeaf)
      continue
    }

    // Node (0x03)
    if (flag === 0x03) {
      // Read only the node hash
      const node = signature.slice(index, index + 32)
      index += 32

      nodes.push({
        nodeHash: node,
      } as NodeLeaf)
      continue
    }

    // Branch (0x04)
    if (flag === 0x04) {
      // Read size of the branch
      const sizeSize = firstByte & 0x0f
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      // Enter a branch of the signature merkle tree
      const branchBytes = signature.slice(index, index + size)
      index += size

      const { nodes, leftover } = parseBranch(branchBytes)
      if (leftover.length > 0) {
        throw new Error('Leftover bytes in branch')
      }

      const subTree = foldNodes(nodes)
      nodes.push(subTree)
      continue
    }

    // Nested (0x05)
    if (flag === 0x05) {
      // Read external weight
      let weight = firstByte & 0x03
      if (weight === 0) {
        weight = signature[index]
        index++
      }

      // Read internal threshold
      let threshold = (firstByte & 0x0c) >> 2
      if (threshold === 0) {
        // Read 2 bytes
        threshold = Bytes.toNumber(signature.slice(index, index + 2))
        index += 2
      }

      // Read size (3 bytes)
      const size = Bytes.toNumber(signature.slice(index, index + 3))
      index += 3

      // Read the nested tree
      const nestedTree = signature.slice(index, index + size)
      index += size

      const { nodes, leftover } = parseBranch(nestedTree)
      if (leftover.length > 0) {
        throw new Error('Leftover bytes in nested tree')
      }

      const subTree = foldNodes(nodes)
      nodes.push({
        tree: subTree,
        weight: BigInt(weight),
        threshold: BigInt(threshold),
      } as RawNestedLeaf)
      continue
    }

    // Subdigest 0x06
    if (flag === 0x06) {
      const hardcoded = signature.slice(index, index + 32)
      index += 32

      nodes.push({
        digest: hardcoded,
      } as SubdigestLeaf)
      continue
    }

    // Signature Sapient signer (0x09) or Sapient compact (0x0a)
    if (flag === 0x09 || flag === 0x0a) {
      let addrWeight = firstByte & 0x03
      if (addrWeight === 0) {
        addrWeight = signature[index]
        index++
      }

      const address = signature.slice(index, index + 20)
      index += 20

      // Read signature size
      const sizeSize = (firstByte & 0x0c) >> 2
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      const subSignature = signature.slice(index, index + size)
      index += size

      nodes.push({
        weight: BigInt(addrWeight),
        signature: {
          address: Bytes.toHex(address),
          data: subSignature,
          type: flag === 0x09 ? 'sapient' : 'sapient_compact',
        },
      } as RawSignerLeaf)
      continue
    }

    throw new Error(`Invalid signature flag: ${flag}`)
  }

  return { nodes, leftover: signature.slice(index) }
}

function foldNodes(nodes: RawTopology[]): RawTopology {
  if (nodes.length === 0) {
    throw new Error('Empty signature tree')
  }

  if (nodes.length === 1) {
    return nodes[0]
  }

  let tree = nodes[0]

  for (let i = 1; i < nodes.length; i++) {
    tree = { left: tree, right: nodes[i] }
  }

  return tree
}
