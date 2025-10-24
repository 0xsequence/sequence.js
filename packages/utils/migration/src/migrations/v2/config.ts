import { v2 } from '@0xsequence/v2core'
import { Config as V3Config } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export const convertTreeToTopology = (tree: v2.config.Topology): V3Config.Topology => {
  if (v2.config.isSignerLeaf(tree)) {
    return {
      type: 'signer',
      address: Address.from(tree.address),
      weight: BigInt(tree.weight),
    }
  }
  if (v2.config.isSubdigestLeaf(tree)) {
    Hex.assert(tree.subdigest)
    return {
      type: 'subdigest',
      digest: tree.subdigest,
    }
  }
  if (v2.config.isNestedLeaf(tree)) {
    return {
      type: 'nested',
      weight: BigInt(tree.weight),
      threshold: BigInt(tree.threshold),
      tree: convertTreeToTopology(tree.tree),
    }
  }
  if (v2.config.isNode(tree)) {
    return [convertTreeToTopology(tree.left), convertTreeToTopology(tree.right)]
  }
  throw new Error('Invalid tree')
}
