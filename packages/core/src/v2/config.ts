
import { BigNumberish, ethers } from "ethers"

//
// Tree typings - leaves
//

export type SignerLeaf = {
  address: string,
  weight: BigNumberish
}

export type SubdigestLeaf = {
  subdigest: string
}

export type NestedLeaf = {
  tree: Topology,
  weight: BigNumberish,
  threshold: BigNumberish
}

export type Leaf = SignerLeaf | SubdigestLeaf | NestedLeaf

export function isSignerLeaf(leaf: any): leaf is SignerLeaf {
  return (
    (leaf as SignerLeaf).address !== undefined &&
    (leaf as SignerLeaf).weight !== undefined
  )
}

export function isSubdigestLeaf(leaf: any): leaf is SubdigestLeaf {
  return (leaf as SubdigestLeaf).subdigest !== undefined
}

export function isNestedLeaf(leaf: any): leaf is NestedLeaf {
  return (
    (leaf as NestedLeaf).tree !== undefined &&
    (leaf as NestedLeaf).weight !== undefined &&
    (leaf as NestedLeaf).threshold !== undefined
  )
}

export function isLeaf(leaf: any): leaf is Leaf {
  return isSignerLeaf(leaf) || isSubdigestLeaf(leaf) || isNestedLeaf(leaf)
}

//
// Tree typings - nodes
//

export type Node = {
  left: Node | Leaf,
  right: Node | Leaf
}

export type Topology = Node | Leaf

export function isNode(node: any): node is Node {
  return (
    (node as Node).left !== undefined &&
    (node as Node).right !== undefined
  )
}

export function isTopology(topology: any): topology is Topology {
  return isNode(topology) || isLeaf(topology)
}

export function hashNode(node: Node | Leaf): string {
  if (isSignerLeaf(node)) {
    return ethers.utils.solidityPack(
      ['uint96', 'address'],
      [node.weight, node.address]
    )
  }

  if (isSubdigestLeaf(node)) {
    return ethers.utils.solidityKeccak256(
      ['string', 'bytes32'],
      ['Sequence static digest:\n', node.subdigest]
    )
  }

  if (isNestedLeaf(node)) {
    const nested = hashNode(node.tree)
    return ethers.utils.solidityKeccak256(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['Sequence nested config:\n', nested, node.threshold, node.weight]
    )
  }

  return ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [hashNode(node.left), hashNode(node.right)]
  )
}

export function rightSlice(topology: Topology): Topology[] {
  const stack: Topology[] = []

  let prev = topology
  while (!isLeaf(prev)) {
    stack.unshift(prev.right)
    prev = prev.left
  }

  return stack
}

//
// Wallet config types
//

export type WalletConfig = {
  threshold: BigNumberish,
  checkpoint: BigNumberish,
  tree: Topology
}

export function isWalletConfig(config: any): config is WalletConfig {
  return (
    (config as WalletConfig).threshold !== undefined &&
    (config as WalletConfig).checkpoint !== undefined &&
    (config as WalletConfig).tree !== undefined
  )
}

export function imageHash(config: WalletConfig): string {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256'],
    [
      ethers.utils.solidityKeccak256(
        ['bytes32', 'uint256'],
        [
          hashNode(config.tree),
          config.threshold
        ]
      ),
      config.checkpoint
    ]
  )
}

//
// Simple wallet config types
// (used for building and reading merkle configs)
//
// dev: `members` is a flat representation of the tree
//      it keeps relevant structure like 'nested trees' but
//      it ignores the tree structure
//
//

export type SimpleNestedMember = {
  threshold: BigNumberish,
  weight: BigNumberish,
  members: SimpleConfigMember[]
}

export type SimpleConfigMember = SubdigestLeaf | SignerLeaf | SimpleNestedMember

export type SimpleWalletConfig = {
  threshold: BigNumberish,
  checkpoint: BigNumberish,
  members: SimpleConfigMember[]
}

export function isSimpleNestedMember(member: any): member is SimpleNestedMember {
  return (
    (member as SimpleNestedMember).threshold !== undefined &&
    (member as SimpleNestedMember).weight !== undefined &&
    (member as SimpleNestedMember).members !== undefined
  )
}

export function topologyToMembers(tree: Topology): SimpleConfigMember[] {
  if (isSignerLeaf(tree) || isSubdigestLeaf(tree)) {
    return [tree]
  }

  if (isNestedLeaf(tree)) {
    return [{
      threshold: tree.threshold,
      weight: tree.weight,
      members: topologyToMembers(tree.tree)
    }]
  }

  return [
    ...topologyToMembers(tree.left),
    ...topologyToMembers(tree.right)
  ]
}

function toSimpleWalletConfig(config: WalletConfig): SimpleWalletConfig {
  return {
    threshold: config.threshold,
    checkpoint: config.checkpoint,
    members: topologyToMembers(config.tree)
  }
}

export type TopologyBuilder = (members: SimpleConfigMember[]) => Topology

const membersAsTopologies = (members: SimpleConfigMember[], builder: TopologyBuilder): Topology[] => {
  return members.map((member) => {
    if (isSimpleNestedMember(member)) {
      return {
        tree: builder(member.members),
        threshold: member.threshold,
        weight: member.weight
      }
    }

    return member
  })
}

export function legacyTopologyBuilder(members: SimpleConfigMember[]): Topology {
  if (members.length === 0) {
    throw new Error('Empty members array')
  }

  const asTopologies = membersAsTopologies(members, legacyTopologyBuilder)
  return asTopologies.reduce((acc, member) => {
    return {
      left: acc,
      right: member
    }
  })
}

export function merkleTopologyBuilder(members: SimpleConfigMember[]): Topology {
  if (members.length === 0) {
    throw new Error('Empty members array')
  }

  const leaves = membersAsTopologies(members, merkleTopologyBuilder)
  for (let s = leaves.length; s > 1; s = s / 2) {
    for (let i = 0; i < s / 2; i++) {
      const j1 = i * 2
      const j2 = j1 + 1

      if (j2 >= s) {
        leaves[i] = leaves[j1]
      } else {
        leaves[i] = {
          left: leaves[j1],
          right: leaves[j2]
        }
      }
    }
  }

  return leaves[0]
}

export function optimized2SignersTopologyBuilder(members: SimpleConfigMember[]): Topology {
  if (members.length > 8) {
    return merkleTopologyBuilder(members)
  }

  return legacyTopologyBuilder(members)
}

export function toWalletConfig(
  simpleWalletConfig: SimpleWalletConfig,
  builder: TopologyBuilder = optimized2SignersTopologyBuilder
): WalletConfig {
  return {
    threshold: simpleWalletConfig.threshold,
    checkpoint: simpleWalletConfig.checkpoint,
    tree: builder(simpleWalletConfig.members)
  }
}
