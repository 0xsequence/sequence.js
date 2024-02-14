import { ethers } from 'ethers'
import { MAX_UINT_256 } from '@0xsequence/utils'
import { isValidSignature, recoverSigner } from '../commons/signer'
import {
  hashNode,
  isNestedLeaf,
  isNode,
  isNodeLeaf,
  isSignerLeaf,
  isSubdigestLeaf,
  Leaf,
  WalletConfig,
  SignerLeaf,
  Topology,
  imageHash,
  NodeLeaf,
  decodeSignerLeaf,
  isEncodedSignerLeaf
} from './config'
import * as base from '../commons/signature'
import { hashSetImageHash } from './chained'

export enum SignatureType {
  Legacy = 0,
  Dynamic = 1,
  NoChainIdDynamic = 2,
  Chained = 3
}

export enum SignaturePartType {
  Signature = 0,
  Address = 1,
  DynamicSignature = 2,
  Node = 3,
  Branch = 4,
  Subdigest = 5,
  Nested = 6
}

export const SignaturePartTypeLength = 66

export type SignatureLeaf = SignerLeaf & {
  signature: string
  isDynamic: boolean
}

export type UnrecoveredSignatureLeaf = Omit<SignatureLeaf, 'address'> &
  Pick<Partial<SignatureLeaf>, 'address'> & {
    unrecovered: true
  }

export type UnrecoveredNestedLeaf = {
  tree: UnrecoveredTopology
  weight: ethers.BigNumberish
  threshold: ethers.BigNumberish
}

export type UnrecoveredLeaf = UnrecoveredNestedLeaf | UnrecoveredSignatureLeaf | Leaf

export type UnrecoveredNode = {
  left: UnrecoveredNode | UnrecoveredLeaf
  right: UnrecoveredNode | UnrecoveredLeaf
}

export type UnrecoveredTopology = UnrecoveredNode | UnrecoveredLeaf

export function isUnrecoveredNode(node: UnrecoveredTopology): node is UnrecoveredNode {
  return (node as UnrecoveredNode).left !== undefined && (node as UnrecoveredNode).right !== undefined
}

export function isUnrecoveredNestedLeaf(leaf: UnrecoveredTopology): leaf is UnrecoveredNestedLeaf {
  return (leaf as UnrecoveredNestedLeaf).tree !== undefined
}

export function isUnrecoveredSignatureLeaf(leaf: UnrecoveredTopology): leaf is UnrecoveredSignatureLeaf {
  return (
    (leaf as UnrecoveredSignatureLeaf).unrecovered &&
    (leaf as UnrecoveredSignatureLeaf).signature !== undefined &&
    (leaf as UnrecoveredSignatureLeaf).isDynamic !== undefined
  )
}

export function decodeSignatureTree(body: ethers.BytesLike): UnrecoveredTopology {
  let arr = ethers.getBytes(body)

  let pointer: undefined | (Omit<UnrecoveredNode, 'right'> & Pick<Partial<UnrecoveredNode>, 'right'>)

  const append = (prevPointer: typeof pointer, node: UnrecoveredNode | UnrecoveredLeaf): typeof pointer => {
    if (!prevPointer) {
      return {
        left: node
      }
    }

    if (!prevPointer.right) {
      return {
        left: prevPointer.left,
        right: node
      }
    }

    return {
      left: prevPointer as Required<typeof prevPointer>,
      right: node
    }
  }

  while (arr.length > 0) {
    const type = arr[0] as SignaturePartType
    arr = arr.slice(1)

    switch (type) {
      case SignaturePartType.Signature:
        {
          const weight = arr[0]
          const signature = ethers.hexlify(arr.slice(1, SignaturePartTypeLength + 1))

          pointer = append(pointer, {
            signature,
            weight,
            unrecovered: true,
            isDynamic: false
          })
          arr = arr.slice(SignaturePartTypeLength + 1)
        }
        break

      case SignaturePartType.Address:
        {
          const weight = arr[0]
          const address = ethers.getAddress(ethers.hexlify(arr.slice(1, 21)))

          pointer = append(pointer, {
            address,
            weight
          })
          arr = arr.slice(21)
        }
        break

      case SignaturePartType.DynamicSignature:
        {
          const weight = arr[0]
          const address = ethers.getAddress(ethers.hexlify(arr.slice(1, 21)))
          const size = (arr[21] << 16) | (arr[22] << 8) | arr[23]
          const signature = ethers.hexlify(arr.slice(24, 24 + size))

          pointer = append(pointer, {
            address,
            signature,
            weight,
            unrecovered: true,
            isDynamic: true
          })
          arr = arr.slice(24 + size)
        }
        break

      case SignaturePartType.Node:
        {
          const nodeHash = ethers.hexlify(arr.slice(0, 32))

          pointer = append(pointer, { nodeHash })
          arr = arr.slice(32)
        }
        break

      case SignaturePartType.Branch:
        {
          const size = (arr[0] << 16) | (arr[1] << 8) | arr[2]
          const branch = decodeSignatureTree(arr.slice(3, 3 + size))

          pointer = append(pointer, branch)
          arr = arr.slice(3 + size)
        }
        break

      case SignaturePartType.Subdigest:
        {
          const subdigest = ethers.hexlify(arr.slice(0, 32))

          pointer = append(pointer, { subdigest })
          arr = arr.slice(32)
        }
        break

      case SignaturePartType.Nested:
        {
          const weight = arr[0]
          const threshold = (arr[1] << 8) | arr[2]
          const size = (arr[3] << 16) | (arr[4] << 8) | arr[5]

          const tree = decodeSignatureTree(arr.slice(6, 6 + size))

          pointer = append(pointer, {
            weight,
            threshold,
            tree
          })
          arr = arr.slice(6 + size)
        }
        break

      default:
        throw new Error(`Unknown signature part type: ${type}: ${ethers.hexlify(arr)}`)
    }
  }

  if (!pointer) {
    throw new Error('Empty signature tree')
  }

  if (pointer.right) {
    return pointer as Required<typeof pointer>
  }

  return pointer.left
}

export class InvalidSignatureLeafError extends Error {
  constructor(public leaf: UnrecoveredLeaf) {
    super(`Invalid signature leaf: ${JSON.stringify(leaf)}`)
  }
}

export async function recoverTopology(
  unrecovered: UnrecoveredTopology,
  subdigest: string,
  provider: ethers.Provider
): Promise<Topology> {
  if (isUnrecoveredNode(unrecovered)) {
    const [left, right] = await Promise.all([
      recoverTopology(unrecovered.left, subdigest, provider),
      recoverTopology(unrecovered.right, subdigest, provider)
    ])

    return { left, right }
  }

  if (isUnrecoveredNestedLeaf(unrecovered)) {
    return {
      weight: unrecovered.weight,
      threshold: unrecovered.threshold,
      tree: await recoverTopology(unrecovered.tree, subdigest, provider)
    }
  }

  if (isUnrecoveredSignatureLeaf(unrecovered)) {
    if (unrecovered.isDynamic) {
      if (!unrecovered.address) {
        throw new Error('Dynamic signature leaf without address')
      }

      const isValid = await isValidSignature(unrecovered.address, subdigest, unrecovered.signature, provider)
      if (!isValid) {
        throw new InvalidSignatureLeafError(unrecovered)
      }

      return {
        weight: unrecovered.weight,
        address: unrecovered.address!,
        signature: unrecovered.signature,
        subdigest
      }
    } else {
      return {
        weight: unrecovered.weight,
        address: recoverSigner(subdigest, unrecovered.signature),
        signature: unrecovered.signature,
        subdigest
      }
    }
  }

  return unrecovered
}

// TODO: It should be possible to re-use encodeSignatureTree
// and avoid duplicating this logic
export const partEncoder = {
  concat: (a: ethers.BytesLike, b: ethers.BytesLike) => {
    return ethers.solidityPacked(['bytes', 'bytes'], [a, b])
  },
  node: (nodeHash: ethers.BytesLike): string => {
    return ethers.solidityPacked(['uint8', 'bytes32'], [SignaturePartType.Node, nodeHash])
  },
  branch: (tree: ethers.BytesLike): string => {
    const arr = ethers.getBytes(tree)
    return ethers.solidityPacked(['uint8', 'uint24', 'bytes'], [SignaturePartType.Branch, arr.length, arr])
  },
  nested: (weight: ethers.BigNumberish, threshold: ethers.BigNumberish, tree: ethers.BytesLike): string => {
    const arr = ethers.getBytes(tree)
    return ethers.solidityPacked(
      ['uint8', 'uint8', 'uint16', 'uint24', 'bytes'],
      [SignaturePartType.Nested, weight, threshold, arr.length, arr]
    )
  },
  subdigest: (subdigest: ethers.BytesLike): string => {
    return ethers.solidityPacked(['uint8', 'bytes32'], [SignaturePartType.Subdigest, subdigest])
  },
  signature: (weight: ethers.BigNumberish, signature: ethers.BytesLike): string => {
    return ethers.solidityPacked(['uint8', 'uint8', 'bytes'], [SignaturePartType.Signature, weight, signature])
  },
  dynamicSignature: (weight: ethers.BigNumberish, address: ethers.BytesLike, signature: ethers.BytesLike): string => {
    const arrSignature = ethers.getBytes(signature)
    return ethers.solidityPacked(
      ['uint8', 'uint8', 'address', 'uint24', 'bytes'],
      [SignaturePartType.DynamicSignature, weight, address, arrSignature.length, arrSignature]
    )
  },
  address: (weight: ethers.BigNumberish, address: ethers.BytesLike): string => {
    return ethers.solidityPacked(['uint8', 'uint8', 'address'], [SignaturePartType.Address, weight, address])
  }
}

export type EncodingOptions = {
  forceDynamicEncoding?: boolean
  disableTrim?: boolean
}

export function encodeSigners(
  config: WalletConfig,
  parts: Map<string, base.SignaturePart>,
  subdigests: string[],
  chainId: ethers.BigNumberish,
  options: EncodingOptions = {}
): {
  encoded: string
  weight: bigint
} {
  const tree = encodeTree(config.tree, parts, subdigests, options)

  if (BigInt(chainId) === 0n) {
    return {
      encoded: ethers.solidityPacked(
        ['uint8', 'uint16', 'uint32', 'bytes'],
        [SignatureType.NoChainIdDynamic, config.threshold, config.checkpoint, tree.encoded]
      ),
      weight: tree.weight
    }
  }

  if (BigInt(config.threshold) > 255n) {
    return {
      encoded: ethers.solidityPacked(
        ['uint8', 'uint16', 'uint32', 'bytes'],
        [SignatureType.Dynamic, config.threshold, config.checkpoint, tree.encoded]
      ),
      weight: tree.weight
    }
  }

  return {
    encoded: ethers.solidityPacked(
      ['uint8', 'uint8', 'uint32', 'bytes'],
      [SignatureType.Legacy, config.threshold, config.checkpoint, tree.encoded]
    ),
    weight: tree.weight
  }
}

export function encodeTree(
  topology: Topology,
  parts: Map<string, base.SignaturePart>,
  subdigests: string[],
  options: EncodingOptions = {}
): {
  encoded: string
  weight: bigint
} {
  const trim = !options.disableTrim

  if (isNode(topology)) {
    const left = encodeTree(topology.left, parts, subdigests)
    const right = encodeTree(topology.right, parts, subdigests)

    const isLeftSigner = isSignerLeaf(topology.left)
    const isRightSigner = isSignerLeaf(topology.right)

    if (trim && left.weight === 0n && right.weight === 0n && !isLeftSigner && !isRightSigner) {
      return {
        // We don't need to include anything for this node
        // just the hash will be enough
        encoded: partEncoder.node(hashNode(topology)),
        weight: 0n
      }
    }

    if (trim && right.weight === 0n && !isRightSigner) {
      return {
        // The right node doesn't have any weight
        // but we still need to include the left node encoded
        encoded: partEncoder.concat(left.encoded, partEncoder.node(hashNode(topology.right))),
        weight: left.weight
      }
    }

    if (trim && left.weight === 0n && !isLeftSigner) {
      return {
        // The left node doesn't have any weight
        // we can just append its hash, but for the right node
        // we need to create a new "branch"
        encoded: partEncoder.concat(partEncoder.node(hashNode(topology.left)), partEncoder.branch(right.encoded)),
        weight: right.weight
      }
    }

    return {
      // Both nodes have weight, we need to include both
      // the right one must be a branch
      encoded: partEncoder.concat(left.encoded, partEncoder.branch(right.encoded)),
      weight: left.weight + right.weight
    }
  }

  if (isNestedLeaf(topology)) {
    const tree = encodeTree(topology.tree, parts, subdigests)

    if (trim && tree.weight === 0n) {
      return {
        encoded: partEncoder.node(hashNode(topology)),
        weight: 0n
      }
    }

    return {
      encoded: partEncoder.nested(topology.weight, topology.threshold, tree.encoded),
      weight: tree.weight
    }
  }

  if (isNodeLeaf(topology)) {
    return {
      encoded: partEncoder.node(hashNode(topology)),
      weight: 0n
    }
  }

  if (isSubdigestLeaf(topology)) {
    const include = subdigests.includes(topology.subdigest)
    return {
      encoded: partEncoder.subdigest(topology.subdigest),
      weight: include ? MAX_UINT_256 : 0n
    }
  }

  if (isSignerLeaf(topology)) {
    const include = parts.has(topology.address)

    if (include) {
      const part = parts.get(topology.address)!
      const signature = part.signature

      if (options.forceDynamicEncoding || part.isDynamic) {
        return {
          encoded: partEncoder.dynamicSignature(topology.weight, topology.address, signature),
          weight: BigInt(topology.weight)
        }
      } else {
        return {
          encoded: partEncoder.signature(topology.weight, signature),
          weight: BigInt(topology.weight)
        }
      }
    } else {
      return {
        encoded: partEncoder.address(topology.weight, topology.address),
        weight: 0n
      }
    }
  }

  throw new Error(`Invalid topology - unknown error: ${JSON.stringify(topology)}`)
}

export type UnrecoveredConfig = {
  tree: UnrecoveredTopology
  threshold: ethers.BigNumberish
  checkpoint: ethers.BigNumberish
}

export type UnrecoveredSignature = base.UnrecoveredSignature & {
  type: SignatureType
  decoded: UnrecoveredConfig
}

export type Signature = base.Signature<WalletConfig> & {
  type: SignatureType
}

export type UnrecoveredChainedSignature = UnrecoveredSignature & {
  suffix: (UnrecoveredSignature | UnrecoveredChainedSignature)[]
}

export type ChainedSignature = Signature & {
  suffix: (Signature | ChainedSignature)[]
}

export function deepestConfigOfSignature(signature: Signature | ChainedSignature): WalletConfig {
  return isChainedSignature(signature)
    ? deepestConfigOfSignature(signature.suffix[signature.suffix.length - 1])
    : signature.config
}

export function isUnrecoveredSignature(sig: any): sig is UnrecoveredSignature {
  return sig.type !== undefined && sig.decoded !== undefined && sig.version !== undefined && sig.version === 2
}

export function isUnrecoveredChainedSignature(sig: any): sig is UnrecoveredChainedSignature {
  return sig.suffix !== undefined && Array.isArray(sig.suffix) && sig.suffix.every(isUnrecoveredSignature)
}

export function isSignature(sig: any): sig is Signature {
  return (
    sig.type !== undefined &&
    sig.config !== undefined &&
    sig.digest !== undefined &&
    sig.version !== undefined &&
    sig.version === 2
  )
}

export function isChainedSignature(sig: any): sig is ChainedSignature {
  return sig.chain !== undefined && Array.isArray(sig.chain) && sig.chain.every(isSignature)
}

export function decodeSignature(signature: ethers.BytesLike): UnrecoveredSignature | UnrecoveredChainedSignature {
  const bytes = ethers.getBytes(signature)
  const type = bytes[0]

  switch (type) {
    case SignatureType.Legacy:
      return { version: 2, type: SignatureType.Legacy, decoded: decodeSignatureBody(bytes) }

    case SignatureType.Dynamic:
      return { version: 2, type: SignatureType.Dynamic, decoded: decodeSignatureBody(bytes.slice(1)) }

    case SignatureType.NoChainIdDynamic:
      return { version: 2, type: SignatureType.NoChainIdDynamic, decoded: decodeSignatureBody(bytes.slice(1)) }

    case SignatureType.Chained:
      return decodeChainedSignature(bytes)

    default:
      throw new Error(`Invalid signature type: ${type}`)
  }
}

export function decodeSignatureBody(signature: ethers.BytesLike): UnrecoveredConfig {
  const bytes = ethers.getBytes(signature)

  const threshold = (bytes[0] << 8) | bytes[1]
  const checkpoint = (bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5]

  const tree = decodeSignatureTree(bytes.slice(6))

  return { threshold, checkpoint, tree }
}

export function decodeChainedSignature(signature: ethers.BytesLike): UnrecoveredChainedSignature {
  const arr = ethers.getBytes(signature)
  const type = arr[0]

  if (type !== SignatureType.Chained) {
    throw new Error(`Expected chained signature type: ${type}`)
  }

  const chain: (UnrecoveredSignature | UnrecoveredChainedSignature)[] = []
  let index = 1

  while (index < arr.length) {
    const size = (arr[index] << 16) | (arr[index + 1] << 8) | arr[index + 2]
    index += 3

    const sig = decodeSignature(arr.slice(index, index + size))
    chain.push(sig)

    index += size
  }

  const main = chain[0]
  if (isUnrecoveredChainedSignature(main)) {
    throw new Error(`Expected first link of chained signature to be a simple signature (not chained)`)
  }

  const suffix = chain.slice(1)

  return { ...main, suffix }
}

export function setImageHashStruct(imageHash: string) {
  return ethers.solidityPacked(
    ['bytes32', 'bytes32'],
    [ethers.solidityPackedKeccak256(['string'], ['SetImageHash(bytes32 imageHash)']), imageHash]
  )
}

export async function recoverSignature(
  signature: UnrecoveredSignature | UnrecoveredChainedSignature,
  payload: base.SignedPayload | { subdigest: string },
  provider: ethers.Provider
): Promise<Signature | ChainedSignature> {
  const signedPayload = (payload as { subdigest: string }).subdigest === undefined ? (payload as base.SignedPayload) : undefined

  const isNoChainId = signature.type === SignatureType.NoChainIdDynamic
  if (isNoChainId && signedPayload) {
    signedPayload.chainId = 0
  }

  const subdigest = signedPayload ? base.subdigestOf(signedPayload) : (payload as { subdigest: string }).subdigest

  if (!isUnrecoveredChainedSignature(signature)) {
    const tree = await recoverTopology(signature.decoded.tree, subdigest, provider)
    return { version: 2, type: signature.type, subdigest, config: { version: 2, ...signature.decoded, tree } }
  }

  if (!base.isSignedPayload(signedPayload)) {
    throw new Error(`Chained signature recovery requires detailed signed payload, subdigest is not enough`)
  }

  const result: (Signature | ChainedSignature)[] = []
  let mutatedPayload = signedPayload

  // Recover the chain of signatures
  // NOTICE: Remove the suffix from the "first" siganture
  // otherwise we recurse infinitely
  for (const sig of [{ ...signature, suffix: undefined }, ...signature.suffix]) {
    const recovered = await recoverSignature(sig, mutatedPayload, provider)
    result.unshift(recovered)

    const nextMessage = setImageHashStruct(imageHash(deepestConfigOfSignature(recovered)))

    mutatedPayload = {
      ...mutatedPayload,
      message: nextMessage,
      digest: ethers.keccak256(nextMessage)
    }
  }

  const main = result[0]
  const suffix = result.slice(1)

  return { ...main, suffix }
}

export function encodeChain(main: ethers.BytesLike, suffix: ethers.BytesLike[]): string {
  const allSignatures = [main, ...(suffix || [])]
  const encodedMap = allSignatures.map(s => ethers.getBytes(encodeSignature(s)))

  const body = ethers.solidityPacked(encodedMap.map(() => ['uint24', 'bytes']).flat(), encodedMap.map(s => [s.length, s]).flat())

  return ethers.solidityPacked(['uint8', 'bytes'], [SignatureType.Chained, body])
}

export function encodeSignature(
  decoded: UnrecoveredChainedSignature | ChainedSignature | UnrecoveredSignature | Signature | ethers.BytesLike
): string {
  if (ethers.isBytesLike(decoded)) return ethers.hexlify(decoded)

  if (isUnrecoveredChainedSignature(decoded) || isChainedSignature(decoded)) {
    return encodeChain(encodeSignature(decoded), (decoded.suffix || []).map(encodeSignature))
  }

  const body = isUnrecoveredSignature(decoded) ? decoded.decoded : decoded.config

  switch (decoded.type) {
    case SignatureType.Legacy:
      if (BigInt(body.threshold) > 255n) {
        throw new Error(`Legacy signature threshold is too large: ${body.threshold} (max 255)`)
      }

      return encodeSignatureBody(body)

    case SignatureType.NoChainIdDynamic:
    case SignatureType.Dynamic:
      return ethers.solidityPacked(['uint8', 'bytes'], [decoded.type, encodeSignatureBody(body)])

    case SignatureType.Chained:
      throw new Error(`Unreachable code: Chained signature should be handled above`)

    default:
      throw new Error(`Invalid signature type: ${decoded.type}`)
  }
}

export function encodeSignatureBody(decoded: WalletConfig | UnrecoveredConfig): string {
  return ethers.solidityPacked(
    ['uint16', 'uint32', 'bytes'],
    [decoded.threshold, decoded.checkpoint, encodeSignatureTree(decoded.tree)]
  )
}

export function encodeSignatureTree(tree: UnrecoveredTopology | Topology): string {
  if (isNode(tree) || isUnrecoveredNode(tree)) {
    const encodedRight = ethers.getBytes(encodeSignatureTree(tree.right))
    const encodedLeft = ethers.getBytes(encodeSignatureTree(tree.left))
    const isBranching = isNode(tree.right) || isUnrecoveredNode(tree.right)

    if (isBranching) {
      return ethers.solidityPacked(
        ['bytes', 'uint8', 'uint24', 'bytes'],
        [encodedLeft, SignaturePartType.Branch, encodedRight.length, encodedRight]
      )
    } else {
      return ethers.solidityPacked(['bytes', 'bytes'], [encodedLeft, encodedRight])
    }
  }

  if (isNestedLeaf(tree) || isUnrecoveredNestedLeaf(tree)) {
    const nested = ethers.getBytes(encodeSignatureTree(tree.tree))

    return ethers.solidityPacked(
      ['uint8', 'uint8', 'uint16', 'uint24', 'bytes'],
      [SignaturePartType.Nested, tree.weight, tree.threshold, nested.length, nested]
    )
  }

  if (isUnrecoveredSignatureLeaf(tree) || (isSignerLeaf(tree) && tree.signature !== undefined)) {
    const signature = ethers.getBytes(tree.signature!)

    if ((tree as { isDynamic?: boolean }).isDynamic || signature.length !== SignaturePartTypeLength) {
      if (!tree.address) throw new Error(`Dynamic signature leaf must have address`)
      return ethers.solidityPacked(
        ['uint8', 'uint8', 'address', 'uint24', 'bytes'],
        [SignaturePartType.DynamicSignature, tree.weight, tree.address, signature.length, signature]
      )
    } else {
      return ethers.solidityPacked(['uint8', 'uint8', 'bytes'], [SignaturePartType.Signature, tree.weight, signature])
    }
  }

  if (isSignerLeaf(tree)) {
    return ethers.solidityPacked(['uint8', 'uint8', 'address'], [SignaturePartType.Address, tree.weight, tree.address])
  }

  if (isNodeLeaf(tree)) {
    return ethers.solidityPacked(['uint8', 'bytes32'], [SignaturePartType.Node, tree.nodeHash])
  }

  if (isSubdigestLeaf(tree)) {
    return ethers.solidityPacked(['uint8', 'bytes32'], [SignaturePartType.Subdigest, tree.subdigest])
  }

  throw new Error(`Unknown signature tree type: ${tree}`)
}

export function signaturesOf(topology: Topology): { address: string; signature: string }[] {
  if (isNode(topology)) {
    return [...signaturesOf(topology.left), ...signaturesOf(topology.right)]
  }

  if (isNestedLeaf(topology)) {
    return signaturesOf(topology.tree)
  }

  if (isSignerLeaf(topology) && topology.signature) {
    return [{ address: topology.address, signature: topology.signature }]
  }

  return []
}

export function signaturesOfDecoded(utopology: UnrecoveredTopology): string[] {
  if (isUnrecoveredNode(utopology)) {
    return [...signaturesOfDecoded(utopology.left), ...signaturesOfDecoded(utopology.right)]
  }

  if (isUnrecoveredNestedLeaf(utopology)) {
    return signaturesOfDecoded(utopology.tree)
  }

  if (isUnrecoveredSignatureLeaf(utopology)) {
    return [utopology.signature]
  }

  return []
}

export function subdigestsOfDecoded(utopology: UnrecoveredTopology): string[] {
  if (isUnrecoveredNode(utopology)) {
    return [...subdigestsOfDecoded(utopology.left), ...subdigestsOfDecoded(utopology.right)]
  }

  if (isUnrecoveredNestedLeaf(utopology)) {
    return subdigestsOfDecoded(utopology.tree)
  }

  if (isSubdigestLeaf(utopology)) {
    return [utopology.subdigest]
  }

  return []
}

export async function trimSignature(signature: string | UnrecoveredSignature): Promise<string> {
  const decoded = typeof signature === 'string' ? decodeSignature(signature) : signature

  if (isUnrecoveredChainedSignature(decoded)) {
    // We need to trim every suffix AND the main signature
    const trimmed = await Promise.all([
      trimSignature({ ...decoded, suffix: undefined } as UnrecoveredSignature),
      ...decoded.suffix.map(s => trimSignature(s))
    ])

    return encodeChain(trimmed[0], trimmed.slice(1))
  }

  const { trimmed } = await trimUnrecoveredTree(decoded.decoded.tree)
  return encodeSignature({ ...decoded, decoded: { ...decoded.decoded, tree: trimmed } })
}

export async function trimUnrecoveredTree(
  tree: UnrecoveredTopology,
  trimStaticDigest: boolean = true
): Promise<{
  weight: number
  trimmed: UnrecoveredTopology
}> {
  if (isUnrecoveredNode(tree)) {
    const [left, right] = await Promise.all([trimUnrecoveredTree(tree.left), trimUnrecoveredTree(tree.right)])

    if (left.weight === 0 && right.weight === 0) {
      try {
        // If both weights are 0 then it means we don't have any signatures yet
        // because of that, we should be able to "recover" the tree with any subdigest
        // and still get the valid node hash (there shouldn't be any signatures to verify)
        const recovered = await recoverTopology(tree, ethers.ZeroHash, undefined as any)

        return {
          weight: 0,
          trimmed: {
            nodeHash: hashNode(recovered)
          } as NodeLeaf
        }
      } catch {
        // If something fails it's more likely because some signatures have sneaked in
        // in that case we should keep this node
      }
    } else {
      return {
        weight: left.weight + right.weight,
        trimmed: {
          left: left.trimmed,
          right: right.trimmed
        } as UnrecoveredNode
      }
    }
  }

  if (isUnrecoveredNestedLeaf(tree)) {
    const trimmed = await trimUnrecoveredTree(tree.tree)

    if (trimmed.weight === 0) {
      try {
        // If the nested leaf is empty, we can recover it with any subdigest
        // and still get the valid node hash (there shouldn't be any signatures to verify)
        const recovered = await recoverTopology(tree, ethers.ZeroHash, undefined as any)

        return {
          weight: 0,
          trimmed: {
            nodeHash: hashNode(recovered)
          } as NodeLeaf
        }
      } catch {
        // If something fails it's more likely because some signatures have sneaked in
        // in that case we should keep this node
      }
    }

    return {
      weight: trimmed.weight,
      trimmed: {
        weight: tree.weight,
        threshold: tree.threshold,
        tree: trimmed.trimmed
      } as UnrecoveredNestedLeaf
    }
  }

  // Hash nodes can be encoded as signer leaves if they have a weight below
  // 256, most likely the are signer leaves wrongly encoded
  if (isNodeLeaf(tree) && isEncodedSignerLeaf(tree.nodeHash)) {
    return {
      weight: 0,
      trimmed: {
        ...decodeSignerLeaf(tree.nodeHash)
      } as SignerLeaf
    }
  }

  if (isUnrecoveredSignatureLeaf(tree) || (isSignerLeaf(tree) && tree.signature !== undefined)) {
    return {
      weight: Number(tree.weight),
      trimmed: tree
    }
  }

  if (!trimStaticDigest && isSubdigestLeaf(tree)) {
    return {
      weight: +Infinity,
      trimmed: tree
    }
  }

  return {
    weight: 0,
    trimmed: tree
  }
}

export const SignatureCoder: base.SignatureCoder<WalletConfig, Signature, UnrecoveredChainedSignature | UnrecoveredSignature> = {
  decode: (data: string): UnrecoveredSignature => {
    return decodeSignature(data)
  },

  encode: (data: Signature | UnrecoveredSignature): string => {
    return encodeSignature(data)
  },

  trim: (data: string): Promise<string> => {
    return trimSignature(data)
  },

  supportsNoChainId: true,

  recover: (
    data: UnrecoveredSignature | UnrecoveredChainedSignature,
    payload: base.SignedPayload,
    provider: ethers.Provider
  ): Promise<Signature> => {
    return recoverSignature(data, payload, provider)
  },

  encodeSigners: (
    config: WalletConfig,
    signatures: Map<string, base.SignaturePart>,
    subdigests: string[],
    chainId: ethers.BigNumberish
  ): {
    encoded: string
    weight: bigint
  } => {
    return encodeSigners(config, signatures, subdigests, chainId)
  },

  hasEnoughSigningPower: (config: WalletConfig, signatures: Map<string, base.SignaturePart>): boolean => {
    const { weight } = SignatureCoder.encodeSigners(config, signatures, [], 0)
    return weight >= BigInt(config.threshold)
  },

  chainSignatures: (
    main: Signature | UnrecoveredSignature | UnrecoveredChainedSignature | ethers.BytesLike,
    suffix: (Signature | UnrecoveredSignature | UnrecoveredChainedSignature | ethers.BytesLike)[]
  ): string => {
    // Notice: v2 expects suffix to be reversed
    // that being: from signed to current imageHash
    const reversed = suffix.reverse()
    const mraw = ethers.isBytesLike(main) ? main : encodeSignature(main)
    const sraw = reversed.map(s => (ethers.isBytesLike(s) ? s : encodeSignature(s)))
    return encodeChain(mraw, sraw)
  },

  hashSetImageHash: function (imageHash: string): string {
    return hashSetImageHash(imageHash)
  },

  signaturesOf(config: WalletConfig): { address: string; signature: string }[] {
    return signaturesOf(config.tree)
  },

  signaturesOfDecoded: function (data: UnrecoveredSignature): string[] {
    return signaturesOfDecoded(data.decoded.tree)
  }
}
