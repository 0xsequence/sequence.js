import { AbiFunction, AbiParameters, Bytes, Hash, Hex, Provider, Secp256k1, Signature } from 'ox'
import {
  Config,
  Leaf,
  NestedLeaf,
  SapientSignerLeaf,
  SignerLeaf,
  SubdigestLeaf,
  AnyAddressSubdigestLeaf,
  Topology,
  hashConfiguration,
  isNestedLeaf,
  isNode,
  isNodeLeaf,
  isSapientSignerLeaf,
  isSignerLeaf,
  isSubdigestLeaf,
  isAnyAddressSubdigestLeaf,
  isTopology,
} from './config.js'
import { RECOVER_SAPIENT_SIGNATURE, RECOVER_SAPIENT_SIGNATURE_COMPACT, IS_VALID_SIGNATURE } from './constants.js'
import { wrap, decode } from './erc-6492.js'
import { fromConfigUpdate, hash, Parented } from './payload.js'
import { minBytesFor, packRSY, unpackRSY } from './utils.js'
import { Constants } from './index.js'

export const FLAG_SIGNATURE_HASH = 0
export const FLAG_ADDRESS = 1
export const FLAG_SIGNATURE_ERC1271 = 2
export const FLAG_NODE = 3
export const FLAG_BRANCH = 4
export const FLAG_SUBDIGEST = 5
export const FLAG_NESTED = 6
export const FLAG_SIGNATURE_ETH_SIGN = 7
export const FLAG_SIGNATURE_ANY_ADDRESS_SUBDIGEST = 8
export const FLAG_SIGNATURE_SAPIENT = 9
export const FLAG_SIGNATURE_SAPIENT_COMPACT = 10

export type RSY = {
  r: bigint
  s: bigint
  yParity: number
}

export type SignatureOfSignerLeafEthSign = {
  type: 'eth_sign'
} & RSY

export type SignatureOfSignerLeafHash = {
  type: 'hash'
} & RSY

export type SignatureOfSignerLeafErc1271 = {
  type: 'erc1271'
  address: Checksummed
  data: Hex.Hex
}

export type SignatureOfSignerLeaf =
  | SignatureOfSignerLeafEthSign
  | SignatureOfSignerLeafHash
  | SignatureOfSignerLeafErc1271

export type SignatureOfSapientSignerLeaf = {
  address: Checksummed
  data: Hex.Hex
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

export type RawConfig = {
  threshold: bigint
  checkpoint: bigint
  topology: RawTopology
  checkpointer?: Checksummed
}

export type RawSignature = {
  noChainId: boolean
  checkpointerData?: Bytes.Bytes
  configuration: RawConfig
  suffix?: RawSignature[]
  erc6492?: { to: Checksummed; data: Bytes.Bytes }
}

export function isSignatureOfSapientSignerLeaf(signature: any): signature is SignatureOfSapientSignerLeaf {
  return (
    'type' in signature &&
    (signature.type === 'sapient_compact' || signature.type === 'sapient') &&
    typeof signature === 'object' &&
    'address' in signature &&
    'data' in signature
  )
}

export function isRawSignature(signature: any): signature is RawSignature {
  return (
    typeof signature === 'object' &&
    signature &&
    typeof signature.noChainId === 'boolean' &&
    (signature.checkpointerData === undefined || Bytes.validate(signature.checkpointerData)) &&
    isRawConfig(signature.configuration) &&
    (signature.suffix === undefined ||
      (Array.isArray(signature.suffix) &&
        signature.suffix.every(
          (signature: any) => isRawSignature(signature) && signature.checkpointerData === undefined,
        )))
  )
}

export function isRawConfig(configuration: any): configuration is RawConfig {
  return (
    configuration &&
    typeof configuration === 'object' &&
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
  return typeof cand === 'object' && 'weight' in cand && !('tree' in cand)
}

export function isRawNestedLeaf(cand: any): cand is RawNestedLeaf {
  return typeof cand === 'object' && 'tree' in cand && 'weight' in cand && 'threshold' in cand
}

export function decodeSignature(erc6492Signature: Bytes.Bytes): RawSignature {
  const { signature, erc6492 } = decode(erc6492Signature)

  if (signature.length < 1) {
    throw new Error('Signature is empty')
  }

  const flag = signature[0]!
  let index = 1

  const noChainId = (flag & 0x02) === 0x02

  let checkpointerAddress: Checksummed | undefined
  let checkpointerData: Bytes.Bytes | undefined

  // bit [6] => checkpointer address + data
  if ((flag & 0x40) === 0x40) {
    if (index + 20 > signature.length) {
      throw new Error('Not enough bytes for checkpointer address')
    }
    checkpointerAddress = Bytes.toHex(signature.slice(index, index + 20))
    index += 20

    if (index + 3 > signature.length) {
      throw new Error('Not enough bytes for checkpointer data size')
    }
    const checkpointerDataSize = Bytes.toNumber(signature.slice(index, index + 3))
    index += 3

    if (index + checkpointerDataSize > signature.length) {
      throw new Error('Not enough bytes for checkpointer data')
    }
    checkpointerData = signature.slice(index, index + checkpointerDataSize)
    index += checkpointerDataSize
  }

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

    return { ...subsignatures[0]!, suffix: subsignatures.slice(1), erc6492 }
  }

  const { nodes, leftover } = parseBranch(signature.slice(index))
  if (leftover.length !== 0) {
    throw new Error('Leftover bytes in signature')
  }

  const topology = foldNodes(nodes)

  return {
    noChainId,
    checkpointerData,
    configuration: { threshold, checkpoint, topology, checkpointer: checkpointerAddress },
    erc6492,
  }
}

export function parseBranch(signature: Bytes.Bytes): {
  nodes: RawTopology[]
  leftover: Bytes.Bytes
} {
  const nodes: RawTopology[] = []
  let index = 0

  while (index < signature.length) {
    const firstByte = signature[index]!
    index++

    const flag = (firstByte & 0xf0) >> 4

    // FLAG_SIGNATURE_HASH = 0 => bottom nibble is weight
    // Then read 64 bytes => r, yParityAndS => top bit => yParity => s is the rest => v=27+yParity
    if (flag === FLAG_SIGNATURE_HASH) {
      let weight = firstByte & 0x0f
      if (weight === 0) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for dynamic weight')
        }
        weight = signature[index]!
        index++
      }
      if (index + 64 > signature.length) {
        throw new Error('Not enough bytes for hash signature (r + yParityAndS)')
      }
      const unpackedRSY = unpackRSY(signature.slice(index, index + 64))
      index += 64

      nodes.push({
        type: 'unrecovered-signer',
        weight: BigInt(weight),
        signature: {
          type: 'hash',
          ...unpackedRSY,
        },
      } as RawSignerLeaf)
      continue
    }

    // FLAG_ADDRESS = 1 => bottom nibble is weight => read 20 bytes => no signature
    if (flag === FLAG_ADDRESS) {
      let weight = firstByte & 0x0f
      if (weight === 0) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for address weight')
        }
        weight = signature[index]!
        index++
      }
      if (index + 20 > signature.length) {
        throw new Error('Not enough bytes for address leaf')
      }
      const addr = Bytes.toHex(signature.slice(index, index + 20))
      index += 20

      nodes.push({
        type: 'signer',
        address: addr,
        weight: BigInt(weight),
      } as SignerLeaf)
      continue
    }

    // FLAG_SIGNATURE_ERC1271 = 2 => bottom 2 bits => weight, next 2 bits => sizeSize
    if (flag === FLAG_SIGNATURE_ERC1271) {
      let weight = firstByte & 0x03
      if (weight === 0) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for ERC1271 weight')
        }
        weight = signature[index]!
        index++
      }
      if (index + 20 > signature.length) {
        throw new Error('Not enough bytes for ERC1271 signer address')
      }
      const signer = Bytes.toHex(signature.slice(index, index + 20))
      index += 20

      const sizeSize = (firstByte & 0x0c) >> 2
      if (index + sizeSize > signature.length) {
        throw new Error('Not enough bytes for ERC1271 sizeSize')
      }
      const dataSize = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      if (index + dataSize > signature.length) {
        throw new Error('Not enough bytes for ERC1271 data')
      }
      const subSignature = signature.slice(index, index + dataSize)
      index += dataSize

      nodes.push({
        type: 'unrecovered-signer',
        weight: BigInt(weight),
        signature: {
          type: 'erc1271',
          address: signer,
          data: Bytes.toHex(subSignature),
        },
      } as RawSignerLeaf)
      continue
    }

    // FLAG_NODE = 3 => read 32 bytes as a node hash
    if (flag === FLAG_NODE) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for node leaf')
      }
      const node = signature.slice(index, index + 32)
      index += 32

      nodes.push(Bytes.toHex(node))
      continue
    }

    // FLAG_BRANCH = 4 => next nibble => sizeSize => read size => parse sub-branch
    if (flag === FLAG_BRANCH) {
      const sizeSize = firstByte & 0x0f
      if (index + sizeSize > signature.length) {
        throw new Error('Not enough bytes for branch sizeSize')
      }
      const size = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      if (index + size > signature.length) {
        throw new Error('Not enough bytes in sub-branch')
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

    // FLAG_SUBDIGEST = 5 => read 32 bytes => push subdigest leaf
    if (flag === FLAG_SUBDIGEST) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for subdigest')
      }
      const hardcoded = signature.slice(index, index + 32)
      index += 32
      nodes.push({
        type: 'subdigest',
        digest: Bytes.toHex(hardcoded),
      } as SubdigestLeaf)
      continue
    }

    // FLAG_NESTED = 6 => read externalWeight + internalThreshold, then read 3 bytes => parse subtree
    if (flag === FLAG_NESTED) {
      // bits [3..2] => external weight
      let externalWeight = (firstByte & 0x0c) >> 2
      if (externalWeight === 0) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for nested weight')
        }
        externalWeight = signature[index]!
        index++
      }

      // bits [1..0] => internal threshold
      let internalThreshold = firstByte & 0x03
      if (internalThreshold === 0) {
        if (index + 2 > signature.length) {
          throw new Error('Not enough bytes for nested threshold')
        }
        internalThreshold = Bytes.toNumber(signature.slice(index, index + 2))
        index += 2
      }

      if (index + 3 > signature.length) {
        throw new Error('Not enough bytes for nested sub-tree size')
      }
      const size = Bytes.toNumber(signature.slice(index, index + 3))
      index += 3

      if (index + size > signature.length) {
        throw new Error('Not enough bytes for nested sub-tree')
      }
      const nestedTreeBytes = signature.slice(index, index + size)
      index += size

      const { nodes: subNodes, leftover } = parseBranch(nestedTreeBytes)
      if (leftover.length > 0) {
        throw new Error('Leftover bytes in nested sub-tree')
      }
      const subTree = foldNodes(subNodes)

      nodes.push({
        type: 'nested',
        tree: subTree,
        weight: BigInt(externalWeight),
        threshold: BigInt(internalThreshold),
      } as RawNestedLeaf)
      continue
    }

    // FLAG_SIGNATURE_ETH_SIGN = 7 => parse it same as hash, but interpret the subdigest as an Ethereum Signed Message
    if (flag === FLAG_SIGNATURE_ETH_SIGN) {
      let weight = firstByte & 0x0f
      if (weight === 0) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for dynamic weight in eth_sign')
        }
        weight = signature[index]!
        index++
      }
      if (index + 64 > signature.length) {
        throw new Error('Not enough bytes for eth_sign signature')
      }
      const unpackedRSY = unpackRSY(signature.slice(index, index + 64))
      index += 64

      nodes.push({
        type: 'unrecovered-signer',
        weight: BigInt(weight),
        signature: {
          type: 'eth_sign',
          ...unpackedRSY,
        },
      } as RawSignerLeaf)
      continue
    }

    // FLAG_SIGNATURE_ANY_ADDRESS_SUBDIGEST = 8 => read 32 bytes => push any address subdigest leaf
    if (flag === FLAG_SIGNATURE_ANY_ADDRESS_SUBDIGEST) {
      if (index + 32 > signature.length) {
        throw new Error('Not enough bytes for any address subdigest')
      }
      const anyAddressSubdigest = signature.slice(index, index + 32)
      index += 32
      nodes.push({
        type: 'any-address-subdigest',
        digest: Bytes.toHex(anyAddressSubdigest),
      } as AnyAddressSubdigestLeaf)
      continue
    }

    if (flag === FLAG_SIGNATURE_SAPIENT || flag === FLAG_SIGNATURE_SAPIENT_COMPACT) {
      let addrWeight = firstByte & 0x03
      if (addrWeight === 0) {
        if (index >= signature.length) {
          throw new Error('Not enough bytes for sapient weight')
        }
        addrWeight = signature[index]!
        index++
      }
      if (index + 20 > signature.length) {
        throw new Error('Not enough bytes for sapient signer address')
      }
      const address = Bytes.toHex(signature.slice(index, index + 20))
      index += 20

      const sizeSize = (firstByte & 0x0c) >> 2
      if (index + sizeSize > signature.length) {
        throw new Error('Not enough bytes for sapient signature size')
      }
      const dataSize = Bytes.toNumber(signature.slice(index, index + sizeSize))
      index += sizeSize

      if (index + dataSize > signature.length) {
        throw new Error('Not enough bytes for sapient signature data')
      }
      const subSignature = signature.slice(index, index + dataSize)
      index += dataSize

      nodes.push({
        type: 'unrecovered-signer',
        weight: BigInt(addrWeight),
        signature: {
          address,
          data: Bytes.toHex(subSignature),
          type: flag === FLAG_SIGNATURE_SAPIENT ? 'sapient' : 'sapient_compact',
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

  if (isAnyAddressSubdigestLeaf(topology)) {
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
    const encoded = encodeSignature(signature, true, i === signatures.length - 1)
    if (encoded.length > 16777215) {
      throw new Error('Chained signature too large')
    }
    const encodedSize = Bytes.padLeft(Bytes.fromNumber(encoded.length), 3)
    output = Bytes.concat(output, encodedSize, encoded)
  }

  return output
}

export function encodeSignature(
  signature: RawSignature,
  skipCheckpointerData?: boolean,
  skipCheckpointerAddress?: boolean,
): Uint8Array {
  const { noChainId, checkpointerData, configuration: config, suffix, erc6492 } = signature

  if (suffix?.length) {
    const chainedSig = encodeChainedSignature([{ ...signature, suffix: undefined, erc6492: undefined }, ...suffix])
    return erc6492 ? wrap(chainedSig, erc6492) : chainedSig
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

  if (config.checkpointer && !skipCheckpointerAddress) {
    flag |= 0x40
  }

  let output = Bytes.fromNumber(flag)

  if (config.checkpointer && !skipCheckpointerAddress) {
    output = Bytes.concat(output, Bytes.padLeft(Bytes.fromHex(config.checkpointer), 20))
    if (!skipCheckpointerData) {
      const checkpointerDataSize = checkpointerData?.length ?? 0
      if (checkpointerDataSize > 16777215) {
        throw new Error('Checkpointer data too large')
      }

      const checkpointerDataSizeBytes = Bytes.padLeft(Bytes.fromNumber(checkpointerDataSize), 3)
      output = Bytes.concat(output, checkpointerDataSizeBytes, checkpointerData ?? Bytes.fromArray([]))
    }
  }

  const checkpointBytes = Bytes.padLeft(Bytes.fromNumber(config.checkpoint), bytesForCheckpoint)
  output = Bytes.concat(output, checkpointBytes)

  const thresholdBytes = Bytes.padLeft(Bytes.fromNumber(config.threshold), bytesForThreshold)
  output = Bytes.concat(output, thresholdBytes)

  const topologyBytes = encodeTopology(config.topology, signature)
  output = Bytes.concat(output, topologyBytes)

  return erc6492 ? wrap(output, erc6492) : output
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
    return Bytes.concat(Bytes.fromNumber(FLAG_NODE << 4), Bytes.fromHex(topology))
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

      const packedRSY = packRSY(topology.signature)
      return Bytes.concat(Bytes.fromNumber(flag), weightBytes, packedRSY)
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
        Bytes.padLeft(Bytes.fromNumber(Bytes.fromHex(topology.signature.data).length), bytesForSignatureSize),
        Bytes.fromHex(topology.signature.data),
      )
    } else if (topology.signature.type === 'sapient' || topology.signature.type === 'sapient_compact') {
      let flag = (topology.signature.type === 'sapient' ? FLAG_SIGNATURE_SAPIENT : FLAG_SIGNATURE_SAPIENT_COMPACT) << 4

      const signatureBytes = Bytes.fromHex(topology.signature.data)
      let bytesForSignatureSize = minBytesFor(BigInt(signatureBytes.length))
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
        Bytes.padLeft(Bytes.fromNumber(signatureBytes.length), bytesForSignatureSize),
        signatureBytes,
      )
    } else {
      throw new Error(`Invalid signature type: ${topology.signature.type}`)
    }
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

  if (isSubdigestLeaf(topology)) {
    return Bytes.concat(Bytes.fromNumber(FLAG_SUBDIGEST << 4), Bytes.fromHex(topology.digest))
  }

  if (isAnyAddressSubdigestLeaf(topology)) {
    return Bytes.concat(Bytes.fromNumber(FLAG_SIGNATURE_ANY_ADDRESS_SUBDIGEST << 4), Bytes.fromHex(topology.digest))
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
            imageHash: top.imageHash,
          }
        case 'subdigest':
          return {
            type: 'subdigest',
            digest: top.digest,
          }
        case 'any-address-subdigest':
          return {
            type: 'any-address-subdigest',
            digest: top.digest,
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
  if (typeof top === 'string') {
    return top
  }
  throw new Error('Invalid raw topology format')
}

function rawSignatureOfLeafToJson(sig: SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf): any {
  if (sig.type === 'eth_sign' || sig.type === 'hash') {
    return {
      type: sig.type,
      r: Hex.fromNumber(sig.r, { size: 32 }),
      s: Hex.fromNumber(sig.s, { size: 32 }),
      yParity: sig.yParity,
    }
  }
  if (sig.type === 'erc1271') {
    return {
      type: sig.type,
      address: sig.address,
      data: sig.data,
    }
  }
  if (sig.type === 'sapient' || sig.type === 'sapient_compact') {
    return {
      type: sig.type,
      address: sig.address,
      data: sig.data,
    }
  }
  throw new Error('Unknown signature type in raw signature')
}

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
            imageHash: obj.imageHash,
          }
        case 'subdigest':
          return {
            type: 'subdigest',
            digest: obj.digest,
          }
        case 'any-address-subdigest':
          return {
            type: 'any-address-subdigest',
            digest: obj.digest,
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
    Hex.assert(obj)
    return obj
  }
  throw new Error('Invalid raw topology format')
}

function rawSignatureOfLeafFromJson(obj: any): SignatureOfSignerLeaf | SignatureOfSapientSignerLeaf {
  switch (obj.type) {
    case 'eth_sign':
    case 'hash':
      return {
        type: obj.type,
        r: Hex.toBigInt(obj.r),
        s: Hex.toBigInt(obj.s),
        yParity: obj.yParity,
      }
    case 'erc1271':
      return {
        type: 'erc1271',
        address: obj.address,
        data: obj.data,
      }
    case 'sapient':
    case 'sapient_compact':
      return {
        type: obj.type,
        address: obj.address,
        data: obj.data,
      }
    default:
      throw new Error('Invalid signature type in raw signature')
  }
}

export async function recover(
  signature: RawSignature,
  wallet: Checksummed,
  chainId: bigint,
  payload: Parented,
  options?: {
    provider?: Provider.Provider | { provider: Provider.Provider; block: number } | 'assume-valid' | 'assume-invalid'
  },
): Promise<{ configuration: Config; weight: bigint }> {
  if (signature.suffix?.length) {
    let invalid = false

    let { configuration, weight } = await recover(
      { ...signature, suffix: undefined },
      wallet,
      chainId,
      payload,
      options,
    )

    invalid ||= weight < configuration.threshold

    for (const subsignature of signature.suffix) {
      const recovered = await recover(
        subsignature,
        wallet,
        subsignature.noChainId ? 0n : chainId,
        fromConfigUpdate(Bytes.toHex(hashConfiguration(configuration))),
        options,
      )

      invalid ||= recovered.weight < recovered.configuration.threshold
      invalid ||= recovered.configuration.checkpoint >= configuration.checkpoint

      configuration = recovered.configuration
      weight = recovered.weight
    }

    return { configuration, weight: invalid ? 0n : weight }
  }

  const { topology, weight } = await recoverTopology(
    signature.configuration.topology,
    wallet,
    chainId,
    payload,
    options,
  )

  return { configuration: { ...signature.configuration, topology }, weight }
}

async function recoverTopology(
  topology: RawTopology,
  wallet: Checksummed,
  chainId: bigint,
  payload: Parented,
  options?: {
    provider?: Provider.Provider | { provider: Provider.Provider; block: number } | 'assume-valid' | 'assume-invalid'
    throw?: boolean
  },
): Promise<{ topology: Topology; weight: bigint }> {
  const digest = hash(wallet, chainId, payload)

  if (isRawSignerLeaf(topology)) {
    switch (topology.signature.type) {
      case 'eth_sign':
      case 'hash':
        return {
          topology: {
            type: 'signer',
            address: Secp256k1.recoverAddress({
              payload:
                topology.signature.type === 'eth_sign'
                  ? Hash.keccak256(
                      AbiParameters.encodePacked(
                        ['string', 'bytes32'],
                        ['\x19Ethereum Signed Message:\n32', Bytes.toHex(digest)],
                      ),
                    )
                  : digest,
              signature: topology.signature,
            }),
            weight: topology.weight,
            signed: true,
            signature: topology.signature,
          },
          weight: topology.weight,
        }

      case 'erc1271':
        switch (options?.provider) {
          case undefined:
          case 'assume-invalid':
            if (options?.throw !== false) {
              throw new Error(`unable to validate signer ${topology.signature.address} erc-1271 signature`)
            } else {
              return {
                topology: { type: 'signer', address: topology.signature.address, weight: topology.weight },
                weight: 0n,
              }
            }

          case 'assume-valid':
            return {
              topology: {
                type: 'signer',
                address: topology.signature.address,
                weight: topology.weight,
                signed: true,
                signature: topology.signature,
              },
              weight: topology.weight,
            }

          default:
            const provider = 'provider' in options!.provider ? options!.provider.provider : options!.provider
            const block = 'block' in options!.provider ? options!.provider.block : undefined

            const call = {
              to: topology.signature.address,
              data: AbiFunction.encodeData(IS_VALID_SIGNATURE, [Bytes.toHex(digest), topology.signature.data]),
            }

            const response = await provider.request({
              method: 'eth_call',
              params: block === undefined ? [call, 'latest'] : [call, Hex.fromNumber(block)],
            })
            const decodedResult = AbiFunction.decodeResult(IS_VALID_SIGNATURE, response)

            if (Hex.isEqual(decodedResult, AbiFunction.getSelector(IS_VALID_SIGNATURE))) {
              return {
                topology: {
                  type: 'signer',
                  address: topology.signature.address,
                  weight: topology.weight,
                  signed: true,
                  signature: topology.signature,
                },
                weight: topology.weight,
              }
            } else {
              if (options?.throw !== false) {
                throw new Error(`invalid signer ${topology.signature.address} erc-1271 signature`)
              } else {
                return {
                  topology: { type: 'signer', address: topology.signature.address, weight: topology.weight },
                  weight: 0n,
                }
              }
            }
        }

      case 'sapient':
      case 'sapient_compact':
        switch (options?.provider) {
          case undefined:
          case 'assume-invalid':
          case 'assume-valid':
            throw new Error(`unable to validate sapient signer ${topology.signature.address} signature`)

          default:
            const provider = 'provider' in options!.provider ? options!.provider.provider : options!.provider
            const block = 'block' in options!.provider ? options!.provider.block : undefined

            const call = {
              to: topology.signature.address,
              data:
                topology.signature.type === 'sapient'
                  ? AbiFunction.encodeData(RECOVER_SAPIENT_SIGNATURE, [
                      encode(chainId, payload),
                      topology.signature.data,
                    ])
                  : AbiFunction.encodeData(RECOVER_SAPIENT_SIGNATURE_COMPACT, [
                      Bytes.toHex(digest),
                      topology.signature.data,
                    ]),
            }

            const response = await provider.request({
              method: 'eth_call',
              params: block === undefined ? [call, 'latest'] : [call, Hex.fromNumber(block)],
            })

            return {
              topology: {
                type: 'sapient-signer',
                address: topology.signature.address,
                weight: topology.weight,
                imageHash: response,
                signed: true,
                signature: topology.signature,
              },
              weight: topology.weight,
            }
        }
    }
  } else if (isRawNestedLeaf(topology)) {
    const { topology: tree, weight } = await recoverTopology(topology.tree, wallet, chainId, payload, options)
    return { topology: { ...topology, tree }, weight: weight >= topology.threshold ? topology.weight : 0n }
  } else if (isSignerLeaf(topology)) {
    return { topology, weight: 0n }
  } else if (isSapientSignerLeaf(topology)) {
    return { topology, weight: 0n }
  } else if (isSubdigestLeaf(topology)) {
    return {
      topology,
      weight: Bytes.isEqual(Bytes.fromHex(topology.digest), digest)
        ? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
        : 0n,
    }
  } else if (isAnyAddressSubdigestLeaf(topology)) {
    const anyAddressOpHash = hash(Constants.ZeroAddress, chainId, payload)
    return {
      topology,
      weight: Bytes.isEqual(Bytes.fromHex(topology.digest), anyAddressOpHash)
        ? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
        : 0n,
    }
  } else if (isNodeLeaf(topology)) {
    return { topology, weight: 0n }
  } else {
    const [left, right] = await Promise.all(
      topology.map((topology) => recoverTopology(topology, wallet, chainId, payload, options)),
    )
    return { topology: [left!.topology, right!.topology], weight: left!.weight + right!.weight }
  }
}

function encode(
  chainId: bigint,
  payload: Parented,
): Exclude<AbiFunction.encodeData.Args<typeof RECOVER_SAPIENT_SIGNATURE>, []>[0][0] {
  switch (payload.type) {
    case 'call':
      return {
        kind: 0,
        noChainId: !chainId,
        calls: payload.calls.map((call) => ({
          ...call,
          data: call.data,
          behaviorOnError: call.behaviorOnError === 'ignore' ? 0n : call.behaviorOnError === 'revert' ? 1n : 2n,
        })),
        space: payload.space,
        nonce: payload.nonce,
        message: '0x',
        imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
        parentWallets: payload.parentWallets ?? [],
      }

    case 'message':
      return {
        kind: 1,
        noChainId: !chainId,
        calls: [],
        space: 0n,
        nonce: 0n,
        message: payload.message,
        imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
        parentWallets: payload.parentWallets ?? [],
      }

    case 'config-update':
      return {
        kind: 2,
        noChainId: !chainId,
        calls: [],
        space: 0n,
        nonce: 0n,
        message: '0x',
        imageHash: payload.imageHash,
        digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
        parentWallets: payload.parentWallets ?? [],
      }

    case 'digest':
      return {
        kind: 3,
        noChainId: !chainId,
        calls: [],
        space: 0n,
        nonce: 0n,
        message: '0x',
        imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        digest: payload.digest,
        parentWallets: payload.parentWallets ?? [],
      }

    default:
      throw new Error('Invalid payload type')
  }
}
