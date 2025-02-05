import { Address, Bytes } from 'ox'
import {
  Leaf,
  NestedLeaf,
  SapientSignerLeaf,
  SignerLeaf,
  SubdigestLeaf,
  Topology,
  hashConfiguration,
  isNestedLeaf,
  isNode,
  isNodeLeaf,
  isSapientSignerLeaf,
  isSignerLeaf,
  isSubdigestLeaf,
  isTopology,
} from './config'
import { minBytesFor } from './utils'

export const FLAG_SIGNATURE_HASH = 0
export const FLAG_ADDRESS = 1
export const FLAG_SIGNATURE_ERC1271 = 2
export const FLAG_NODE = 3
export const FLAG_BRANCH = 4
export const FLAG_SUBDIGEST = 5
export const FLAG_NESTED = 6
export const FLAG_SIGNATURE_ETH_SIGN = 7
export const FLAG_SIGNATURE_EIP712 = 8
export const FLAG_SIGNATURE_SAPIENT = 9
export const FLAG_SIGNATURE_SAPIENT_COMPACT = 10

export type SignatureOfSignerLeaf =
  | {
      r: Bytes.Bytes
      s: Bytes.Bytes
      v: number
      type: 'eth_sign' | 'hash'
    }
  | {
      address: `0x${string}`
      data: Bytes.Bytes
      type: 'erc1271'
    }

export type SignatureOfSapientSignerLeaf = {
  address: `0x${string}`
  data: Bytes.Bytes
  type: 'sapient' | 'sapient_compact'
}

export type SignedSignerLeaf = SignerLeaf & {
  signed: true
  signature: SignatureOfSignerLeaf
}

export type SignedSapientSignerLeaf = SapientSignerLeaf & {
  signed: true
  signature: SignatureOfSapientSignerLeaf
}

export type RawSignerLeaf = {
  type: 'unrecovered-signer'
  weight: bigint
  signature: SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf
}

export type RawNestedLeaf = {
  type: 'nested'
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
  checkpointer?: Address.Address
}

export type RawSignature = {
  noChainId: boolean
  checkpointerData?: Bytes.Bytes
  configuration: RawConfiguration
  suffix?: Array<RawSignature>
}

export function isRawSignature(signature: any): signature is RawSignature {
  return (
    typeof signature === 'object' &&
    signature &&
    typeof signature.noChainId === 'boolean' &&
    (signature.checkpointerData === undefined || Bytes.validate(signature.checkpointerData)) &&
    isRawConfiguration(signature.configuration) &&
    (signature.suffix === undefined ||
      (Array.isArray(signature.suffix) &&
        signature.suffix.every(
          (signature: any) => isRawSignature(signature) && signature.checkpointerData === undefined,
        )))
  )
}

export function isRawConfiguration(configuration: any): configuration is RawConfiguration {
  return (
    typeof configuration === 'object' &&
    configuration &&
    typeof configuration.threshold === 'bigint' &&
    typeof configuration.checkpoint === 'bigint' &&
    isRawTopology(configuration.topology) &&
    (configuration.checkpointer === undefined || Address.validate(configuration.checkpointer))
  )
}

export function isRawSignerLeaf(cand: any): cand is RawSignerLeaf {
  return typeof cand === 'object' && 'weight' in cand && 'signature' in cand
}

export function isSignedSignerLeaf(cand: any): cand is SignedSignerLeaf {
  return isSignerLeaf(cand) && 'signature' in cand
}

export function isSignedSapientSignerLeaf(cand: any): cand is SignedSapientSignerLeaf {
  return isSapientSignerLeaf(cand) && 'signature' in cand
}

export function isRawNode(cand: any): cand is RawNode {
  return (
    Array.isArray(cand) &&
    cand.length === 2 &&
    (isRawTopology(cand[0]) || isTopology(cand[0])) &&
    (isRawTopology(cand[1]) || isTopology(cand[1]))
  )
}

export function isRawTopology(cand: any): cand is RawTopology {
  return isRawNode(cand) || isRawLeaf(cand)
}

export function isRawLeaf(cand: any): cand is RawLeaf {
  return typeof cand === 'object' && 'weight' in cand && 'signature' in cand && !('tree' in cand)
}

export function isRawNestedLeaf(cand: any): cand is RawNestedLeaf {
  return typeof cand === 'object' && 'tree' in cand && 'weight' in cand && 'threshold' in cand
}

export function decodeSignature(signature: Bytes.Bytes): RawSignature {
  if (signature.length < 1) {
    throw new Error('Signature is empty')
  }

  const flag = signature[0]!
  let index = 1

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

  let checkpointerAddress: Address.Address | undefined
  let checkpointerData: Bytes.Bytes | undefined

  // bit [6] => checkpointer address + data
  if ((flag & 0x40) === 0x40) {
    if (index + 20 > signature.length) {
      throw new Error('Not enough bytes for checkpointer address')
    }
    checkpointerAddress = Bytes.toHex(signature.slice(index, index + 20))
    index += 20

    const checkpointerDataSize = (flag & 0x1c) >> 2
    if (index + checkpointerDataSize > signature.length) {
      throw new Error('Not enough bytes for checkpointer data')
    }
    checkpointerData = signature.slice(index, index + checkpointerDataSize)
    index += checkpointerDataSize
  }

  // If bit 1 is set => chained signature
  if ((flag & 0x01) === 0x01) {
    const subsignatures: Array<RawSignature & { checkpointerData: undefined }> = []

    while (index < signature.length) {
      if (index + 3 > signature.length) {
        throw new Error('Not enough bytes for chained subsignature size')
      }
      const subsignatureSize = Bytes.toNumber(signature.subarray(index, index + 3))
      index += 3

      if (index + subsignatureSize > signature.length) {
        throw new Error('Not enough bytes for chained subsignature')
      }
      const subsignature = decodeSignature(signature.subarray(index, index + subsignatureSize))
      index += subsignatureSize

      if (subsignature.checkpointerData) {
        throw new Error('Chained subsignature has checkpointer data')
      }

      subsignatures.push({ ...subsignature, checkpointerData: undefined })
    }

    if (subsignatures.length === 0) {
      throw new Error('Chained signature has no subsignatures')
    }

    return { ...subsignatures[0]!, suffix: subsignatures.slice(1) }
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

export function parseBranch(signature: Bytes.Bytes): {
  nodes: RawTopology[]
  leftover: Bytes.Bytes
} {
  const nodes: RawTopology[] = []
  let index = 0

  while (index < signature.length) {
    if (index >= signature.length) {
      throw new Error('Unexpected end of signature while parsing branch')
    }
    const firstByte = signature[index]!
    index++

    const flag = (firstByte & 0xf0) >> 4

    if (flag === FLAG_SIGNATURE_HASH || flag === FLAG_SIGNATURE_ETH_SIGN) {
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

    if (flag === FLAG_ADDRESS) {
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
        type: 'signer',
        address: Bytes.toHex(address),
        weight,
      } as SignerLeaf)
      continue
    }

    if (flag === FLAG_SIGNATURE_ERC1271) {
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

    if (flag === FLAG_NODE) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for node hash')
      }
      const node = signature.slice(index, index + 32)
      index += 32

      nodes.push(node)
      continue
    }

    if (flag === FLAG_BRANCH) {
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

    if (flag === FLAG_NESTED) {
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
        type: 'nested',
        tree: subTree,
        weight,
        threshold,
      } as RawNestedLeaf)
      continue
    }

    if (flag === FLAG_SUBDIGEST) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for subdigest')
      }
      const hardcoded = signature.slice(index, index + 32)
      index += 32

      nodes.push({
        type: 'subdigest',
        digest: hardcoded,
      } as SubdigestLeaf)
      continue
    }

    if (flag === FLAG_SIGNATURE_SAPIENT || flag === FLAG_SIGNATURE_SAPIENT_COMPACT) {
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

export function fillLeaves(
  topology: Topology,
  signatureFor: (
    leaf: SignerLeaf | SapientSignerLeaf,
  ) => SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf | undefined,
): Topology {
  if (isNode(topology)) {
    return [fillLeaves(topology[0]!, signatureFor), fillLeaves(topology[1]!, signatureFor)] as Topology
  }

  if (isSignerLeaf(topology)) {
    const signature = signatureFor(topology)
    if (!signature) {
      return topology
    }
    return { ...topology, signature } as SignedSignerLeaf
  }

  if (isSapientSignerLeaf(topology)) {
    const signature = signatureFor(topology)
    if (!signature) {
      return topology
    }
    return { ...topology, signature } as SignedSapientSignerLeaf
  }

  if (isSubdigestLeaf(topology)) {
    return topology
  }

  if (isNestedLeaf(topology)) {
    return { ...topology, tree: fillLeaves(topology.tree, signatureFor) } as NestedLeaf
  }

  if (isNodeLeaf(topology)) {
    return topology
  }

  throw new Error('Invalid topology')
}

export function encodeChainedSignature(signatures: RawSignature[]): Uint8Array {
  let flag = 0x01

  let sigForCheckpointer = signatures[signatures.length - 1]

  if (sigForCheckpointer?.configuration.checkpointer) {
    flag |= 0x40
  }

  let output = Bytes.fromNumber(flag)
  if (sigForCheckpointer?.configuration.checkpointer) {
    output = Bytes.concat(output, Bytes.padLeft(Bytes.fromHex(sigForCheckpointer.configuration.checkpointer), 20))
    const checkpointerDataSize = sigForCheckpointer.checkpointerData?.length ?? 0
    if (checkpointerDataSize > 16777215) {
      throw new Error('Checkpointer data too large')
    }
    const checkpointerDataSizeBytes = Bytes.padLeft(Bytes.fromNumber(checkpointerDataSize), 3)
    output = Bytes.concat(output, checkpointerDataSizeBytes, sigForCheckpointer.checkpointerData ?? Bytes.fromArray([]))
  }

  for (let i = 0; i < signatures.length; i++) {
    const signature = signatures[i]!
    const encoded = encodeSignature(signature, true)
    if (encoded.length > 16777215) {
      throw new Error('Chained signature too large')
    }
    const encodedSize = Bytes.padLeft(Bytes.fromNumber(encoded.length), 3)
    output = Bytes.concat(output, encodedSize, encoded)
  }

  return output
}

export function encodeSignature(signature: RawSignature, skipCheckpointerData?: boolean): Uint8Array {
  const { noChainId, checkpointerData, configuration: config, suffix } = signature

  if (suffix?.length) {
    return encodeChainedSignature([{ ...signature, suffix: undefined }, ...suffix])
  }

  let flag = 0

  if (noChainId) {
    flag |= 0x02
  }

  const bytesForCheckpoint = minBytesFor(config.checkpoint)
  if (bytesForCheckpoint > 7) {
    throw new Error('Checkpoint too large')
  }
  flag |= bytesForCheckpoint << 2

  let bytesForThreshold = minBytesFor(config.threshold)
  bytesForThreshold = bytesForThreshold === 0 ? 1 : bytesForThreshold
  if (bytesForThreshold > 2) {
    throw new Error('Threshold too large')
  }
  flag |= bytesForThreshold == 2 ? 0x20 : 0x00

  if (config.checkpointer) {
    flag |= 0x40
  }

  let output = Bytes.fromNumber(flag)

  if (config.checkpointer && !skipCheckpointerData) {
    output = Bytes.concat(output, Bytes.padLeft(Bytes.fromHex(config.checkpointer), 20))

    const checkpointerDataSize = checkpointerData?.length ?? 0
    if (checkpointerDataSize > 16777215) {
      throw new Error('Checkpointer data too large')
    }

    const checkpointerDataSizeBytes = Bytes.padLeft(Bytes.fromNumber(checkpointerDataSize), 3)
    output = Bytes.concat(output, checkpointerDataSizeBytes, checkpointerData ?? Bytes.fromArray([]))
  }

  const checkpointBytes = Bytes.padLeft(Bytes.fromNumber(config.checkpoint), bytesForCheckpoint)
  output = Bytes.concat(output, checkpointBytes)

  const thresholdBytes = Bytes.padLeft(Bytes.fromNumber(config.threshold), bytesForThreshold)
  output = Bytes.concat(output, thresholdBytes)

  const topologyBytes = encodeTopology(config.topology, signature)
  output = Bytes.concat(output, topologyBytes)

  return output
}

export function encodeTopology(
  topology: Topology | RawTopology,
  options: {
    noChainId?: boolean
    checkpointerData?: Uint8Array
  } = {},
): Uint8Array {
  if (isNode(topology) || isRawNode(topology)) {
    const encoded0 = encodeTopology(topology[0]!, options)
    const encoded1 = encodeTopology(topology[1]!, options)
    const isBranching = isNode(topology[1]!) || isRawNode(topology[1]!)

    if (isBranching) {
      let encoded1Size = minBytesFor(BigInt(encoded1.length))
      if (encoded1Size > 15) {
        throw new Error('Branch too large')
      }

      const flag = (FLAG_BRANCH << 4) | encoded1Size
      return Bytes.concat(
        encoded0,
        Bytes.fromNumber(flag),
        Bytes.padLeft(Bytes.fromNumber(encoded1.length), encoded1Size),
        encoded1,
      )
    } else {
      return Bytes.concat(encoded0, encoded1)
    }
  }

  if (isNestedLeaf(topology) || isRawNestedLeaf(topology)) {
    const nested = encodeTopology(topology.tree, options)

    // - XX00 : Weight (00 = dynamic, 01 = 1, 10 = 2, 11 = 3)
    // - 00XX : Threshold (00 = dynamic, 01 = 1, 10 = 2, 11 = 3)
    let flag = FLAG_NESTED << 4

    let weightBytes = Bytes.fromArray([])
    if (topology.weight <= 3n && topology.weight > 0n) {
      flag |= Number(topology.weight) << 2
    } else if (topology.weight <= 255n) {
      weightBytes = Bytes.fromNumber(Number(topology.weight))
    } else {
      throw new Error('Weight too large')
    }

    let thresholdBytes = Bytes.fromArray([])
    if (topology.threshold <= 3n && topology.threshold > 0n) {
      flag |= Number(topology.threshold)
    } else if (topology.threshold <= 65535n) {
      thresholdBytes = Bytes.padLeft(Bytes.fromNumber(Number(topology.threshold)), 2)
    } else {
      throw new Error('Threshold too large')
    }

    if (nested.length > 16777215) {
      throw new Error('Nested tree too large')
    }

    return Bytes.concat(
      Bytes.fromNumber(flag),
      weightBytes,
      thresholdBytes,
      Bytes.padLeft(Bytes.fromNumber(nested.length), 3),
      nested,
    )
  }

  if (isNodeLeaf(topology)) {
    return Bytes.concat(Bytes.fromNumber(FLAG_NODE << 4), topology)
  }

  if (isSignedSignerLeaf(topology) || isRawSignerLeaf(topology)) {
    if (topology.signature.type === 'hash' || topology.signature.type === 'eth_sign') {
      let flag = (topology.signature.type === 'hash' ? FLAG_SIGNATURE_HASH : FLAG_SIGNATURE_ETH_SIGN) << 4
      let weightBytes = Bytes.fromArray([])
      if (topology.weight <= 15n && topology.weight > 0n) {
        flag |= Number(topology.weight)
      } else if (topology.weight <= 255n) {
        weightBytes = Bytes.fromNumber(Number(topology.weight))
      } else {
        throw new Error('Weight too large')
      }

      const r = Bytes.padLeft(topology.signature.r, 32)
      const s = Bytes.padLeft(topology.signature.s, 32)
      if (topology.signature.v % 2 === 0) {
        s[0]! |= 0x80
      }

      return Bytes.concat(Bytes.fromNumber(flag), weightBytes, r, s)
    } else if (topology.signature.type === 'erc1271') {
      let flag = FLAG_SIGNATURE_ERC1271 << 4

      let bytesForSignatureSize = minBytesFor(BigInt(topology.signature.data.length))
      if (bytesForSignatureSize > 3) {
        throw new Error('Signature too large')
      }

      flag |= bytesForSignatureSize << 2

      let weightBytes = Bytes.fromArray([])
      if (topology.weight <= 3n && topology.weight > 0n) {
        flag |= Number(topology.weight)
      } else if (topology.weight <= 255n) {
        weightBytes = Bytes.fromNumber(Number(topology.weight))
      } else {
        throw new Error('Weight too large')
      }

      return Bytes.concat(
        Bytes.fromNumber(flag),
        weightBytes,
        Bytes.padLeft(Bytes.fromHex(topology.signature.address), 20),
        Bytes.padLeft(Bytes.fromNumber(topology.signature.data.length), bytesForSignatureSize),
        topology.signature.data,
      )
    } else if (topology.signature.type === 'sapient' || topology.signature.type === 'sapient_compact') {
      let flag = (topology.signature.type === 'sapient' ? FLAG_SIGNATURE_SAPIENT : FLAG_SIGNATURE_SAPIENT_COMPACT) << 4

      let bytesForSignatureSize = minBytesFor(BigInt(topology.signature.data.length))
      if (bytesForSignatureSize > 3) {
        throw new Error('Signature too large')
      }

      flag |= bytesForSignatureSize << 2

      let weightBytes = Bytes.fromArray([])
      if (topology.weight <= 3n && topology.weight > 0n) {
        flag |= Number(topology.weight)
      } else if (topology.weight <= 255n) {
        weightBytes = Bytes.fromNumber(Number(topology.weight))
      } else {
        throw new Error('Weight too large')
      }

      return Bytes.concat(
        Bytes.fromNumber(flag),
        weightBytes,
        Bytes.padLeft(Bytes.fromHex(topology.signature.address), 20),
        Bytes.padLeft(Bytes.fromNumber(topology.signature.data.length), bytesForSignatureSize),
        topology.signature.data,
      )
    } else {
      throw new Error(`Invalid signature type: ${topology.signature.type}`)
    }
  }

  if (isSubdigestLeaf(topology)) {
    return Bytes.concat(Bytes.fromNumber(FLAG_SUBDIGEST << 4), topology.digest)
  }

  if (isSignerLeaf(topology)) {
    let flag = FLAG_ADDRESS << 4
    let weightBytes = Bytes.fromArray([])
    if (topology.weight <= 15n && topology.weight > 0n) {
      flag |= Number(topology.weight)
    } else if (topology.weight <= 255n) {
      weightBytes = Bytes.fromNumber(Number(topology.weight))
    } else {
      throw new Error('Weight too large')
    }

    return Bytes.concat(Bytes.fromNumber(flag), weightBytes, Bytes.padLeft(Bytes.fromHex(topology.address), 20))
  }

  if (isSapientSignerLeaf(topology)) {
    // Encode as node directly
    const hash = hashConfiguration(topology)
    return Bytes.concat(Bytes.fromNumber(FLAG_NODE << 4), hash)
  }

  throw new Error('Invalid topology')
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

export function rawSignatureToJson(signature: RawSignature): string {
  return JSON.stringify(rawSignatureToJsonParsed(signature))
}

function rawSignatureToJsonParsed(signature: RawSignature): any {
  return {
    noChainId: signature.noChainId,
    checkpointerData: signature.checkpointerData ? Bytes.toHex(signature.checkpointerData) : undefined,
    configuration: {
      threshold: signature.configuration.threshold.toString(),
      checkpoint: signature.configuration.checkpoint.toString(),
      topology: rawTopologyToJson(signature.configuration.topology),
      checkpointer: signature.configuration.checkpointer,
    },
    suffix: signature.suffix ? signature.suffix.map((sig) => rawSignatureToJsonParsed(sig)) : undefined,
  }
}

function rawTopologyToJson(top: RawTopology): any {
  if (Array.isArray(top)) {
    return [rawTopologyToJson(top[0]), rawTopologyToJson(top[1])]
  }
  if (typeof top === 'object' && top !== null) {
    if ('type' in top) {
      switch (top.type) {
        case 'signer':
          return {
            type: 'signer',
            address: top.address,
            weight: top.weight.toString(),
          }
        case 'sapient-signer':
          return {
            type: 'sapient-signer',
            address: top.address,
            weight: top.weight.toString(),
            imageHash: Bytes.toHex(Bytes.padLeft(top.imageHash, 32)),
          }
        case 'subdigest':
          return {
            type: 'subdigest',
            digest: Bytes.toHex(top.digest),
          }
        case 'nested':
          return {
            type: 'nested',
            tree: rawTopologyToJson(top.tree),
            weight: top.weight.toString(),
            threshold: top.threshold.toString(),
          }
        case 'unrecovered-signer':
          return {
            type: 'unrecovered-signer',
            weight: top.weight.toString(),
            signature: rawSignatureOfLeafToJson(top.signature),
          }
        default:
          throw new Error('Invalid raw topology type')
      }
    }
  }
  if (top instanceof Uint8Array) {
    return Bytes.toHex(top)
  }
  if (typeof top === 'string') {
    return top
  }
  throw new Error('Invalid raw topology format')
}

function rawSignatureOfLeafToJson(sig: SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf): any {
  if (sig.type === 'eth_sign' || sig.type === 'hash') {
    return {
      type: sig.type,
      r: Bytes.toHex(sig.r),
      s: Bytes.toHex(sig.s),
      v: sig.v,
    }
  }
  if (sig.type === 'erc1271') {
    return {
      type: sig.type,
      address: sig.address,
      data: Bytes.toHex(sig.data),
    }
  }
  if (sig.type === 'sapient' || sig.type === 'sapient_compact') {
    return {
      type: sig.type,
      address: sig.address,
      data: Bytes.toHex(sig.data),
    }
  }
  throw new Error('Unknown signature type in raw signature')
}

// Re-create a RawSignature from its JSON string representation.
export function rawSignatureFromJson(json: string): RawSignature {
  const parsed = JSON.parse(json)
  return rawSignatureFromParsed(parsed)
}

function rawSignatureFromParsed(parsed: any): RawSignature {
  return {
    noChainId: parsed.noChainId,
    checkpointerData: parsed.checkpointerData ? Bytes.fromHex(parsed.checkpointerData) : undefined,
    configuration: {
      threshold: BigInt(parsed.configuration.threshold),
      checkpoint: BigInt(parsed.configuration.checkpoint),
      topology: rawTopologyFromJson(parsed.configuration.topology),
      checkpointer: parsed.configuration.checkpointer,
    },
    suffix: parsed.suffix ? parsed.suffix.map((sig: any) => rawSignatureFromParsed(sig)) : undefined,
  }
}

function rawTopologyFromJson(obj: any): RawTopology {
  if (Array.isArray(obj)) {
    if (obj.length !== 2) {
      throw new Error('Invalid raw topology node')
    }
    return [rawTopologyFromJson(obj[0]), rawTopologyFromJson(obj[1])]
  }
  if (typeof obj === 'object' && obj !== null) {
    if ('type' in obj) {
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
            imageHash: Bytes.fromHex(obj.imageHash),
          }
        case 'subdigest':
          return {
            type: 'subdigest',
            digest: Bytes.fromHex(obj.digest),
          }
        case 'nested':
          return {
            type: 'nested',
            tree: rawTopologyFromJson(obj.tree),
            weight: BigInt(obj.weight),
            threshold: BigInt(obj.threshold),
          }
        case 'unrecovered-signer':
          return {
            type: 'unrecovered-signer',
            weight: BigInt(obj.weight),
            signature: rawSignatureOfLeafFromJson(obj.signature),
          }
        default:
          throw new Error('Invalid raw topology type')
      }
    }
  }
  if (typeof obj === 'string') {
    return Bytes.fromHex(obj as `0x${string}`)
  }
  throw new Error('Invalid raw topology format')
}

function rawSignatureOfLeafFromJson(obj: any): SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf {
  switch (obj.type) {
    case 'eth_sign':
    case 'hash':
      return {
        type: obj.type,
        r: Bytes.fromHex(obj.r),
        s: Bytes.fromHex(obj.s),
        v: obj.v,
      }
    case 'erc1271':
      return {
        type: 'erc1271',
        address: obj.address,
        data: Bytes.fromHex(obj.data),
      }
    case 'sapient':
    case 'sapient_compact':
      return {
        type: obj.type,
        address: obj.address,
        data: Bytes.fromHex(obj.data),
      }
    default:
      throw new Error('Invalid signature type in raw signature')
  }
}
