
import { BigNumberish, ethers } from "ethers"
import { recoverSigner } from "../signer"
import { Leaf, SignerLeaf, Topology } from "./config"

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

export function recoverTopology(unrecovered: UnrecoveredTopology, subdigest: string): Topology {
  if (isUnrecoveredNode(unrecovered)) {
    return {
      left: recoverTopology(unrecovered.left, subdigest),
      right: recoverTopology(unrecovered.right, subdigest)
    }
  }

  if (isUnrecoveredNestedLeaf(unrecovered)) {
    return {
      weight: unrecovered.weight,
      threshold: unrecovered.threshold,
      tree: recoverTopology(unrecovered.tree, subdigest)
    }
  }

  if (isUnrecoveredSignatureLeaf(unrecovered)) {
    if (unrecovered.isDynamic) {
      console.warn('RECOVERING DYNAMIC SIGNATURES IS NOT IMPLEMENTED')
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
