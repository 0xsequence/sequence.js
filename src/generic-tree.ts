import { Bytes, Hash, Hex } from 'ox'

// An encoded configuration tree is a generic configuration tree that has been encoded into a bytes sequence.
// It can be used to represent a configuration tree in a compact form.
// Implementations are free to use any encoding they want, as long as the encoding is consistent and can be decoded.

export type Leaf = {
  type: 'leaf'
  value: Bytes.Bytes
}

// Hashed leaf
export type Node = Hex.Hex

export type Branch = [Tree, Tree, ...Tree[]]
export type Tree = Branch | Leaf | Node

export function isBranch(tree: Tree): tree is Branch {
  return Array.isArray(tree) && tree.length >= 2 && tree.every((child) => isTree(child))
}

export function isLeaf(tree: any): tree is Leaf {
  return tree.type === 'leaf' && Bytes.validate(tree.value)
}

export function isTree(tree: any): tree is Tree {
  return isBranch(tree) || isLeaf(tree) || isNode(tree)
}

export function isNode(node: any): node is Node {
  return Hex.validate(node) && Hex.size(node) === 32
}

export function hash(tree: Tree): Hex.Hex {
  if (isBranch(tree)) {
    // Sequentially hash the children
    const hashedChildren = tree.map(hash)
    if (hashedChildren.length === 0) {
      throw new Error('Empty branch')
    }
    let chashBytes = Hex.toBytes(hashedChildren[0]!)
    for (let i = 1; i < hashedChildren.length; i++) {
      chashBytes = Hash.keccak256(Bytes.concat(chashBytes, Hex.toBytes(hashedChildren[i]!)))
    }
    return Hex.fromBytes(chashBytes)
  }

  // Nodes are already hashed
  if (isNode(tree)) {
    return tree
  }

  // Hash the leaf
  return Hash.keccak256(tree.value, { as: 'Hex' })
}
