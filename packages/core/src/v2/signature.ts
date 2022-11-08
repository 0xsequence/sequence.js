
import { BigNumberish, ethers } from "ethers"
import { isValidSignature, recoverSigner } from "../commons/signer"
import { hashNode, isNestedLeaf, isNode, isNodeLeaf, isSignerLeaf, isSubdigestLeaf, Leaf, WalletConfig, SignerLeaf, Topology, imageHash } from "./config"

export enum SignatureType {
  Legacy = 0,
  Dynamic = 1,
  NoChaindDynamic = 2,
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

export type SignatureLeaf = SignerLeaf & {
  signature: string,
  isDynamic: boolean
}

export type UnrecoveredSignatureLeaf = Omit<SignatureLeaf, 'address'> & Pick<Partial<SignatureLeaf>, 'address'> & {
  unrecovered: true
}

export type UnrecoveredNestedLeaf = {
  tree: UnrecoveredTopology,
  weight: BigNumberish,
  threshold: BigNumberish
}

export type UnrecoveredLeaf = UnrecoveredNestedLeaf | UnrecoveredSignatureLeaf | Leaf

export type UnrecoveredNode = {
  left: UnrecoveredNode | UnrecoveredLeaf,
  right: UnrecoveredNode | UnrecoveredLeaf
}

export type UnrecoveredTopology = UnrecoveredNode | UnrecoveredLeaf

export function isUnrecoveredNode(node: UnrecoveredTopology): node is UnrecoveredNode {
  return (node as UnrecoveredNode).left !== undefined && (node as UnrecoveredNode).right !== undefined
}

export function isUnrecoveredNestedLeaf(leaf: UnrecoveredLeaf): leaf is UnrecoveredNestedLeaf {
  return (leaf as UnrecoveredNestedLeaf).tree !== undefined
}

export function isUnrecoveredSignatureLeaf(leaf: UnrecoveredLeaf): leaf is UnrecoveredSignatureLeaf {
  return (leaf as UnrecoveredSignatureLeaf).unrecovered
}

export function decodeSignatureTree(body: ethers.BytesLike): UnrecoveredTopology {
  let arr = ethers.utils.arrayify(body)

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
      case SignaturePartType.Signature: {
        const weight = arr[0]
        const signature = ethers.utils.hexlify(arr.slice(1, 67))

        pointer = append(pointer, {
          signature,
          weight,
          unrecovered: true,
          isDynamic: false
        })
        arr = arr.slice(67)

      } break

      case SignaturePartType.Address: {
        const weight = arr[0]
        const address = ethers.utils.getAddress(ethers.utils.hexlify(arr.slice(1, 21)))

        pointer = append(pointer, {
          address,
          weight,
        })
        arr = arr.slice(21)

      } break

      case SignaturePartType.DynamicSignature: {
        const weight = arr[0]
        const address = ethers.utils.getAddress(ethers.utils.hexlify(arr.slice(1, 21)))
        const size = arr[21] << 16 | arr[22] << 8 | arr[23]
        const signature = ethers.utils.hexlify(arr.slice(24, 24 + size))

        pointer = append(pointer, {
          address,
          signature,
          weight,
          unrecovered: true,
          isDynamic: true
        })
        arr = arr.slice(24 + size)

      } break

      case SignaturePartType.Node: {
        const nodeHash = ethers.utils.hexlify(arr.slice(0, 32))

        pointer = append(pointer, { nodeHash })
        arr = arr.slice(32)

      } break

      case SignaturePartType.Branch: {
        const size = arr[0] << 16 | arr[1] << 8 | arr[2]
        const branch = decodeSignatureTree(arr.slice(3, 3 + size))

        pointer = append(pointer, branch)
        arr = arr.slice(3 + size)

      } break

      case SignaturePartType.Subdigest: {
        const subdigest = ethers.utils.hexlify(arr.slice(0, 32))

        pointer = append(pointer, { subdigest })
        arr = arr.slice(32)
  
      } break

      case SignaturePartType.Nested: {
        const weight = arr[0]
        const threshold = arr[1] << 8 | arr[2]
        const size = arr[3] << 16 | arr[4] << 8 | arr[5]

        const tree = decodeSignatureTree(arr.slice(6, 6 + size))

        pointer = append(pointer, {
          weight,
          threshold,
          tree
        })
        arr = arr.slice(6 + size)

      } break

      default:
        throw new Error(`Unknown signature part type: ${type}: ${ethers.utils.hexlify(arr)}`)
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
  provider: ethers.providers.Provider
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
        address: recoverSigner(unrecovered.signature, subdigest),
        signature: unrecovered.signature,
        subdigest
      }
    }
  }

  return unrecovered
}

export const partEncoder = {
  node: (nodeHash: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    return ethers.utils.solidityPack(
      ['uint8', 'bytes32'],
      [SignaturePartType.Node, nodeHash, sufix]
    )
  },
  branch: (tree: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    const arr = ethers.utils.arrayify(tree)
    return ethers.utils.solidityPack(
      ['uint8', 'uint24', 'bytes', 'bytes'],
      [SignaturePartType.Branch, arr.length, arr, sufix]
    )
  },
  nested: (weight: ethers.BigNumberish, threshold: ethers.BigNumberish, tree: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    const arr = ethers.utils.arrayify(tree)
    return ethers.utils.solidityPack(
      ['uint8', 'uint8', 'uint16', 'uint24', 'bytes', 'bytes'],
      [SignaturePartType.Nested, weight, threshold, arr.length, arr, sufix]
    )
  },
  subdigest: (subdigest: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    return ethers.utils.solidityPack(
      ['uint8', 'bytes32', 'bytes'],
      [SignaturePartType.Subdigest, subdigest, sufix]
    )
  },
  signature: (weight: ethers.BigNumberish, signature: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    return ethers.utils.solidityPack(
      ['uint8', 'uint8', 'bytes', 'bytes'],
      [SignaturePartType.Signature, weight, signature, sufix]
    )
  },
  dynamicSignature: (weight: ethers.BigNumberish, address: ethers.BytesLike, signature: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    return ethers.utils.solidityPack(
      ['uint8', 'uint8', 'address', 'uint24', 'bytes', 'bytes'],
      [SignaturePartType.DynamicSignature, weight, address, signature.length, signature, sufix]
    )
  },
  address: (weight: ethers.BigNumberish, address: ethers.BytesLike, sufix: ethers.BytesLike = []): string => {
    return ethers.utils.solidityPack(
      ['uint8', 'uint8', 'address', 'bytes'],
      [SignaturePartType.Address, weight, address, sufix]
    )
  }
}

export type EncodingOptions = {
  forceDynamicEncoding?: boolean,
  signatureType?: SignatureType,
  disableTrim?: boolean
}

export function encodeSigners(
  topology: Topology,
  parts: SignatureLeaf[] | Map<string, SignatureLeaf>,
  subdigests: string[],
  options: EncodingOptions = {}
): { encoded: string, weight: ethers.BigNumber } {
  // If parts is an array, convert it to a map
  if (Array.isArray(parts)) {
    const partOfSigner = new Map<string, SignatureLeaf>()
    parts.forEach((p) => partOfSigner.set(p.address, p))
    return encodeSigners(topology, partOfSigner, subdigests)
  }

  const trim = !options.disableTrim

  if (isNode(topology)) {
    const left = encodeSigners(topology.left, parts, subdigests)
    const right = encodeSigners(topology.right, parts, subdigests)

    if (trim && left.weight.eq(0) && right.weight.eq(0)) {
      return {
        encoded: partEncoder.node(hashNode(topology)),
        weight: ethers.constants.Zero
      }
    }

    if (trim && right.weight.eq(0)) {
      return {
        encoded: partEncoder.node(hashNode(topology.right), left.encoded),
        weight: left.weight
      }
    }

    return {
      encoded: partEncoder.branch(right.encoded, left.encoded),
      weight: left.weight.add(right.weight)
    }
  }

  if (isNestedLeaf(topology)) {
    const tree = encodeSigners(topology.tree, parts, subdigests)

    if (trim && tree.weight.eq(0)) {
      return {
        encoded: partEncoder.node(hashNode(topology)),
        weight: ethers.constants.Zero
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
      weight: ethers.constants.Zero
    }
  }

  if (isSubdigestLeaf(topology)) {
    const include = subdigests.includes(topology.subdigest)
    return {
      encoded: partEncoder.node(hashNode(topology)),
      weight: include ? ethers.constants.MaxUint256 : ethers.constants.Zero
    }
  }

  if (isSignerLeaf(topology)) {
    const include = parts.has(topology.address)

    if (include) {
      const part = parts.get(topology.address)!
      const signature = part.signature

      if (options.forceDynamicEncoding || part.isDynamic) {
        return {
          encoded: partEncoder.dynamicSignature(part.weight, part.address, signature),
          weight: ethers.BigNumber.from(part.weight)
        }
      } else {
        return {
          encoded: partEncoder.signature(part.weight, signature),
          weight: ethers.BigNumber.from(part.weight)
        }
      }

    } else {
      return {
        encoded: partEncoder.address(topology.weight, topology.address),
        weight: ethers.constants.Zero
      }
    }
  }

  throw new Error(`Invalid topology - unknown error: ${JSON.stringify(topology)}`)
}

export type UnrecoveredConfig = {
  tree: UnrecoveredTopology,
  threshold: ethers.BigNumberish,
  checkpoint: ethers.BigNumberish
}

export type UnrecoveredSignature = {
  type: SignatureType,
  decoded: UnrecoveredConfig
}

export type Signature = {
  type: SignatureType,
  config: WalletConfig,
  subdigest: string,
  payload?: SignedPayload
}

export type UnrecoveredChainedSignature = {
  type: SignatureType,
  chain: (UnrecoveredSignature | UnrecoveredChainedSignature)[]
}

export type ChainedSignature = {
  type: SignatureType,
  chain: (Signature | ChainedSignature)[]
}

export type SignedPayload = {
  message?: ethers.BytesLike,
  digest: string,
  chainid: ethers.BigNumber,
  address: string
}

export function deepestConfigOfSignature(signature: Signature | ChainedSignature): WalletConfig {
  return isChainedSignature(signature) ? deepestConfigOfSignature(signature.chain[signature.chain.length - 1]) : signature.config
}

export function subdigestOf(payload: SignedPayload) {
  return ethers.utils.solidityKeccak256(
    ['bytes', 'uint256', 'address', 'bytes32'],
    ['0x1901', payload.chainid, payload.address, payload.digest]
  )
}

export function isUnrecoveredSignature(sig: any): sig is UnrecoveredSignature {
  return sig.type !== undefined && sig.decoded !== undefined
}

export function isUnrecoveredChainedSignature(sig: any): sig is UnrecoveredChainedSignature {
  return sig.chain !== undefined && Array.isArray(sig.chain) && sig.chain.every(isUnrecoveredSignature)
}

export function isSignature(sig: any): sig is Signature {
  return sig.type !== undefined && sig.config !== undefined && sig.digest !== undefined
}

export function isChainedSignature(sig: any): sig is ChainedSignature {
  return sig.chain !== undefined && Array.isArray(sig.chain) && sig.chain.every(isSignature)
}

export function isSignedPayload(payload: any): payload is SignedPayload {
  return payload.digest !== undefined && payload.chainid !== undefined && payload.address !== undefined
}

export function decodeSignature(signature: ethers.BytesLike): UnrecoveredSignature | UnrecoveredChainedSignature {
  const bytes = ethers.utils.arrayify(signature)
  const type = bytes[0]

  switch (type) {
    case SignatureType.Legacy:
      return { type: SignatureType.Legacy, decoded: decodeSignatureBody(bytes) }

    case SignatureType.Dynamic:
      return { type: SignatureType.Dynamic, decoded: decodeSignatureBody(bytes.slice(1)) }

    case SignatureType.NoChaindDynamic:
      return { type: SignatureType.NoChaindDynamic, decoded: decodeSignatureBody(bytes.slice(1)) }

    case SignatureType.Chained:
      return decodeChainedSignature(bytes)

    default:
      throw new Error(`Invalid signature type: ${type}`)
  }
}

export function decodeSignatureBody(signature: ethers.BytesLike): UnrecoveredConfig {
  const bytes = ethers.utils.arrayify(signature)

  const threshold = bytes[0] << 8 | bytes[1]
  const checkpoint = bytes[2] << 24 | bytes[3] << 16 | bytes[4] << 8 | bytes[5]

  const tree = decodeSignatureTree(bytes.slice(6))

  return { threshold, checkpoint, tree }
}

export function decodeChainedSignature(signature: ethers.BytesLike): UnrecoveredChainedSignature {
  const arr = ethers.utils.arrayify(signature)
  const type = arr[0]

  if (type !== SignatureType.Chained) {
    throw new Error(`Expected chained signature type: ${type}`)
  }

  const chain: (UnrecoveredSignature | UnrecoveredChainedSignature)[] = []
  let index = 1

  while (index < arr.length) {
    const size = arr[index] << 16 | arr[index + 1] << 8 | arr[index + 2]
    index += 3

    const sig = decodeSignature(arr.slice(index, index + size))
    chain.push(sig)

    index += size
  }

  return { type: SignatureType.Chained, chain }
}

export function setImagehashStruct(imagehash: string) {
  return ethers.utils.solidityPack(
    ['bytes32', 'bytes32'],
    [ethers.utils.solidityKeccak256(['string'], ['SetImageHash(bytes32 imageHash)']), imagehash]
  )
}

export async function recoverSignature(
  signature: UnrecoveredSignature | UnrecoveredChainedSignature,
  payload: SignedPayload | { subdigest: string },
  provider: ethers.providers.Provider
): Promise<Signature | ChainedSignature> {
  const signedPayload = (payload as { subdigest: string}).subdigest === undefined ? payload as SignedPayload : undefined
  const subdigest = signedPayload ? subdigestOf(signedPayload) : (payload as { subdigest: string }).subdigest

  // if payload chainid is 0 then it must be encoded with "no chainid" encoding
  // and if it is encoded with "no chainid" encoding then it must have chainid 0
  if (signedPayload && signedPayload.chainid.eq(0) !== (signature.type === SignatureType.NoChaindDynamic)) {
    throw new Error(`Invalid signature type-chainid combination: ${signature.type}-${signedPayload.chainid.toString()}`)
  }

  if (isUnrecoveredSignature(signature)) {
    const tree = await recoverTopology(signature.decoded.tree, subdigest, provider)
    return { type: signature.type, subdigest, config: { ...signature.decoded, tree } }
  }

  if (!isSignedPayload(signedPayload)) {
    throw new Error(`Chained signature recovery requires detailed signed payload, subdigest is not enough`)
  }

  const result: (Signature | ChainedSignature)[] = []
  let mutatedPayload = signedPayload

  for (const sig of signature.chain) {
    const recovered = await recoverSignature(sig, mutatedPayload, provider)
    result.unshift(recovered)

    const nextMessage = setImagehashStruct(
      imageHash(deepestConfigOfSignature(recovered))
    )

    mutatedPayload = {
      ...mutatedPayload,
      message: nextMessage,
      digest: ethers.utils.keccak256(nextMessage)
    }
  }

  return { type: signature.type, chain: result }
}
