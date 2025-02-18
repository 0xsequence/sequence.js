import { Bytes, Hash, Hex } from 'ox'

// An encoded configuration tree is a generic configuration tree that has been encoded into a bytes sequence.
// It can be used to represent a configuration tree in a compact form.
// Implementations are free to use any encoding they want, as long as the encoding is consistent and can be decoded.

export type EncodedConfigurationLeaf = Bytes.Bytes
export type EncodedConfigurationBranch = [
  EncodedConfigurationTree,
  EncodedConfigurationTree,
  ...EncodedConfigurationTree[],
]
export type EncodedConfigurationTree = EncodedConfigurationBranch | EncodedConfigurationLeaf

export function isEncodedConfigurationBranch(tree: EncodedConfigurationTree): tree is EncodedConfigurationBranch {
  return Array.isArray(tree) && tree.length >= 2 && tree.every((child) => isEncodedConfigurationTree(child))
}

export function isEncodedConfigurationLeaf(tree: EncodedConfigurationTree): tree is EncodedConfigurationLeaf {
  return Bytes.validate(tree)
}

export function isEncodedConfigurationTree(tree: EncodedConfigurationTree): tree is EncodedConfigurationTree {
  return isEncodedConfigurationBranch(tree) || isEncodedConfigurationLeaf(tree)
}

export function hashConfigurationTree(tree: EncodedConfigurationTree): Bytes.Bytes {
  if (isEncodedConfigurationBranch(tree)) {
    // Sequentially hash the children
    const hashedChildren = tree.map(hashConfigurationTree)
    if (hashedChildren.length === 0) {
      throw new Error('Empty branch')
    }
    let hash = hashedChildren[0]!
    for (let i = 1; i < hashedChildren.length; i++) {
      hash = Hash.keccak256(Bytes.concat(hash, hashedChildren[i]!))
    }
    return hash
  }

  // Hash the leaf
  return Hash.keccak256(tree)
}
