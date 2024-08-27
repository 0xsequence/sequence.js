import { ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { commons } from '..'
import { encodeSigners } from './signature'
import { SimpleConfig } from '../commons/config'

//
// Tree typings - leaves
//

export type SignerLeaf = {
  address: string
  weight: ethers.BigNumberish
  signature?: string
}

export type SubdigestLeaf = {
  subdigest: string
}

export type NestedLeaf = {
  tree: Topology
  weight: ethers.BigNumberish
  threshold: ethers.BigNumberish
}

// This is an unknown node
// it means the tree has a branch
// but we don't know what the content
export type NodeLeaf = {
  nodeHash: string
}

export type Leaf = SignerLeaf | SubdigestLeaf | NestedLeaf | NodeLeaf

export function isSignerLeaf(leaf: any): leaf is SignerLeaf {
  return (leaf as SignerLeaf).address !== undefined && (leaf as SignerLeaf).weight !== undefined
}

export function isSubdigestLeaf(leaf: any): leaf is SubdigestLeaf {
  return (leaf as SubdigestLeaf).subdigest !== undefined && (leaf as SignerLeaf).address === undefined
}

export function topologyToJSON(tree: Topology): string {
  if (isNode(tree)) {
    return JSON.stringify({
      left: topologyToJSON(tree.left),
      right: topologyToJSON(tree.right)
    })
  }

  if (isNestedLeaf(tree)) {
    return JSON.stringify({
      weight: BigInt(tree.weight).toString(),
      threshold: BigInt(tree.threshold).toString(),
      tree: topologyToJSON(tree.tree)
    })
  }

  if (isSignerLeaf(tree)) {
    return JSON.stringify({
      address: tree.address,
      weight: BigInt(tree.weight).toString()
    })
  }

  return JSON.stringify(tree)
}

export function topologyFromJSON(json: string | object): Topology {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json

  if (parsed.left !== undefined && parsed.right !== undefined) {
    return {
      left: topologyFromJSON(parsed.left),
      right: topologyFromJSON(parsed.right)
    }
  }

  if (parsed.weight !== undefined && parsed.threshold !== undefined && parsed.tree !== undefined) {
    return {
      weight: BigInt(parsed.weight),
      threshold: BigInt(parsed.threshold),
      tree: topologyFromJSON(parsed.tree)
    }
  }

  if (parsed.address !== undefined && parsed.weight !== undefined) {
    return {
      address: parsed.address,
      weight: BigInt(parsed.weight)
    }
  }

  return parsed
}

export function isNestedLeaf(leaf: any): leaf is NestedLeaf {
  return (
    (leaf as NestedLeaf).tree !== undefined &&
    (leaf as NestedLeaf).weight !== undefined &&
    (leaf as NestedLeaf).threshold !== undefined
  )
}

export function isNodeLeaf(leaf: any): leaf is NodeLeaf {
  return (leaf as NodeLeaf).nodeHash !== undefined
}

export function isLeaf(leaf: any): leaf is Leaf {
  return isSignerLeaf(leaf) || isSubdigestLeaf(leaf) || isNestedLeaf(leaf) || isNodeLeaf(leaf)
}

//
// Tree typings - nodes
//

export type Node = {
  left: Node | Leaf
  right: Node | Leaf
}

export type Topology = Node | Leaf

export function isNode(node: any): node is Node {
  return (node as Node).left !== undefined && (node as Node).right !== undefined
}

export function isTopology(topology: any): topology is Topology {
  return isNode(topology) || isLeaf(topology)
}

export function encodeSignerLeaf(leaf: SignerLeaf): string {
  return ethers.solidityPacked(['uint96', 'address'], [leaf.weight, leaf.address])
}

export function decodeSignerLeaf(encoded: string): SignerLeaf {
  const bytes = ethers.getBytes(encoded)

  if (bytes.length !== 32) {
    throw new Error('Invalid encoded string length')
  }

  const weight = BigInt(ethers.hexlify(bytes.slice(0, 12)))
  const address = ethers.getAddress(ethers.hexlify(bytes.slice(12)))

  return { weight, address }
}

export function isEncodedSignerLeaf(encoded: string): boolean {
  const bytes = ethers.getBytes(encoded)

  if (bytes.length !== 32) {
    return false
  }

  const prefix = bytes.slice(0, 11)
  return prefix.every(byte => byte === 0)
}

export function hashNode(node: Node | Leaf): string {
  if (isSignerLeaf(node)) {
    return encodeSignerLeaf(node)
  }

  if (isSubdigestLeaf(node)) {
    return ethers.solidityPackedKeccak256(['string', 'bytes32'], ['Sequence static digest:\n', node.subdigest])
  }

  if (isNestedLeaf(node)) {
    const nested = hashNode(node.tree)
    return ethers.solidityPackedKeccak256(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['Sequence nested config:\n', nested, node.threshold, node.weight]
    )
  }

  if (isNodeLeaf(node)) {
    return node.nodeHash
  }

  return ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [hashNode(node.left), hashNode(node.right)])
}

export function leftFace(topology: Topology): Topology[] {
  const stack: Topology[] = []

  let prev = topology
  while (!isLeaf(prev)) {
    stack.unshift(prev.right)
    prev = prev.left
  }

  stack.unshift(prev)

  return stack
}

//
// Wallet config types
//

export type WalletConfig = commons.config.Config & {
  threshold: ethers.BigNumberish
  checkpoint: ethers.BigNumberish
  tree: Topology
}

export function isWalletConfig(config: any): config is WalletConfig {
  return (
    (config as WalletConfig).threshold !== undefined &&
    (config as WalletConfig).checkpoint !== undefined &&
    (config as WalletConfig).tree !== undefined &&
    (config as WalletConfig).version !== undefined &&
    (config as WalletConfig).version === 2
  )
}

export function imageHash(config: WalletConfig): string {
  return ethers.solidityPackedKeccak256(
    ['bytes32', 'uint256'],
    [ethers.solidityPackedKeccak256(['bytes32', 'uint256'], [hashNode(config.tree), config.threshold]), config.checkpoint]
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
  threshold: ethers.BigNumberish
  weight: ethers.BigNumberish
  members: SimpleConfigMember[]
}

export type SimpleConfigMember = SubdigestLeaf | SignerLeaf | SimpleNestedMember

export type SimpleWalletConfig = {
  threshold: ethers.BigNumberish
  checkpoint: ethers.BigNumberish
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
    return [
      {
        threshold: tree.threshold,
        weight: tree.weight,
        members: topologyToMembers(tree.tree)
      }
    ]
  }

  if (isNodeLeaf(tree)) {
    // we don't know the content of this node
    // so we omit it
    return []
  }

  return [...topologyToMembers(tree.left), ...topologyToMembers(tree.right)]
}

export function hasUnknownNodes(tree: Topology): boolean {
  if (isNodeLeaf(tree)) {
    return true
  }

  if (isNode(tree)) {
    return hasUnknownNodes(tree.left) || hasUnknownNodes(tree.right)
  }

  return false
}

export function toSimpleWalletConfig(config: WalletConfig): SimpleWalletConfig {
  return {
    threshold: config.threshold,
    checkpoint: config.checkpoint,
    members: topologyToMembers(config.tree)
  }
}

export type TopologyBuilder = (members: SimpleConfigMember[]) => Topology

const membersAsTopologies = (members: SimpleConfigMember[], builder: TopologyBuilder): Topology[] => {
  return members.map(member => {
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
    version: 2,
    threshold: simpleWalletConfig.threshold,
    checkpoint: simpleWalletConfig.checkpoint,
    tree: builder(simpleWalletConfig.members)
  }
}

export function hasSubdigest(tree: Topology, subdigest: string): boolean {
  if (isSubdigestLeaf(tree)) {
    return tree.subdigest === subdigest
  }

  if (isNode(tree)) {
    return hasSubdigest(tree.left, subdigest) || hasSubdigest(tree.right, subdigest)
  }

  return false
}

export function signersOf(tree: Topology): { address: string; weight: number }[] {
  const stack: Topology[] = [tree]
  const signers = new Set<{ address: string; weight: number }>()

  while (stack.length > 0) {
    const node = stack.pop()

    if (isNestedLeaf(node)) {
      stack.push(node.tree)
    } else if (isNode(node)) {
      stack.push(node.left)
      stack.push(node.right)
    } else if (isSignerLeaf(node)) {
      signers.add({ address: node.address, weight: Number(node.weight) })
    }
  }

  return Array.from(signers)
}

export function isComplete(tree: Topology): boolean {
  if (isNode(tree)) {
    return isComplete(tree.left) && isComplete(tree.right)
  }

  return !isNodeLeaf(tree)
}

export const ConfigCoder: commons.config.ConfigCoder<WalletConfig> = {
  isWalletConfig: (config: commons.config.Config): config is WalletConfig => {
    return config.version === 2 && (config as WalletConfig).threshold !== undefined && (config as WalletConfig).tree !== undefined
  },

  imageHashOf: (config: WalletConfig): string => {
    return imageHash(config)
  },

  hasSubdigest: (config: WalletConfig, subdigest: string): boolean => {
    return hasSubdigest(config.tree, subdigest)
  },

  checkpointOf: (config: WalletConfig): bigint => {
    return BigInt(config.checkpoint)
  },

  signersOf: (config: WalletConfig): { address: string; weight: number }[] => {
    return signersOf(config.tree)
  },

  fromSimple: (config: SimpleConfig): WalletConfig => {
    return toWalletConfig({
      ...config,
      members: [...config.signers, ...(config.subdigests ?? []).map(subdigest => ({ subdigest }))]
    })
  },

  isComplete: (config: WalletConfig): boolean => {
    return isComplete(config.tree)
  },

  // isValid = (config: WalletConfig): boolean {}
  /**
   *
   * Notice: context and kind are ignored because v2
   * doesn't need to manually update the implementation before
   * a configuration update, it's automatically done by the contract.
   *
   */
  update: {
    isKindUsed: true,

    buildTransaction: (
      wallet: string,
      config: WalletConfig,
      _context: commons.context.WalletContext,
      _kind?: 'first' | 'later' | undefined
    ): commons.transaction.TransactionBundle => {
      const module = new ethers.Interface(walletContracts.mainModuleUpgradable.abi)

      return {
        entrypoint: wallet,
        transactions: [
          {
            to: wallet,
            data: module.encodeFunctionData(module.getFunction('updateImageHash')!, [ConfigCoder.imageHashOf(config)]),
            gasLimit: 0,
            delegateCall: false,
            revertOnError: true,
            value: 0
          }
        ]
      }
    },
    decodeTransaction: function (tx: commons.transaction.TransactionBundle): {
      address: string
      newImageHash: string
      kind: 'first' | 'later' | undefined
    } {
      const module = new ethers.Interface(walletContracts.mainModuleUpgradable.abi)

      if (tx.transactions.length !== 1) {
        throw new Error('Invalid transaction bundle, expected 1 transaction')
      }

      const data = tx.transactions[0].data
      if (!data) {
        throw new Error('Invalid transaction bundle, expected data')
      }

      const decoded = module.decodeFunctionData(module.getFunction('updateImageHash')!, data)
      if (!decoded) {
        throw new Error('Invalid transaction bundle, expected valid data')
      }

      if (tx.transactions[0].to !== tx.entrypoint) {
        throw new Error('Invalid transaction bundle, expected to be sent to entrypoint')
      }

      if (tx.transactions[0].delegateCall) {
        throw new Error('Invalid transaction bundle, expected not to be a delegateCall')
      }

      if (!tx.transactions[0].revertOnError) {
        throw new Error('Invalid transaction bundle, expected revertOnError')
      }

      if (BigInt(tx.transactions[0]?.value ?? 0) !== 0n) {
        throw new Error('Invalid transaction bundle, expected value to be 0')
      }

      if (BigInt(tx.transactions[0]?.gasLimit ?? 0) !== 0n) {
        throw new Error('Invalid transaction bundle, expected value to be 0')
      }

      return {
        address: tx.entrypoint,
        newImageHash: decoded[0],
        kind: undefined
      }
    }
  },

  toJSON: function (config: WalletConfig): string {
    return JSON.stringify({
      version: config.version,
      threshold: BigInt(config.threshold).toString(),
      checkpoint: BigInt(config.checkpoint).toString(),
      tree: topologyToJSON(config.tree)
    })
  },

  fromJSON: function (json: string): WalletConfig {
    const config = JSON.parse(json)
    return {
      version: config.version,
      threshold: BigInt(config.threshold),
      checkpoint: BigInt(config.checkpoint),
      tree: topologyFromJSON(config.tree)
    }
  },

  editConfig: function (
    config: WalletConfig,
    action: {
      add?: commons.config.SimpleSigner[]
      remove?: string[]
      threshold?: ethers.BigNumberish
      checkpoint?: ethers.BigNumberish
    }
  ): WalletConfig {
    const members = topologyToMembers(config.tree)

    if (action.add) {
      for (const signer of action.add) {
        if (members.find(s => isSignerLeaf(s) && s.address === signer.address)) {
          continue
        }

        members.push({
          address: signer.address,
          weight: signer.weight
        })
      }
    }

    if (action.remove) {
      for (const address of action.remove) {
        const index = members.findIndex(s => isSignerLeaf(s) && s.address === address)
        if (index >= 0) {
          members.splice(index, 1)
        }
      }
    }

    return {
      version: config.version,
      threshold: action.threshold ?? config.threshold,
      checkpoint: action.checkpoint ?? config.checkpoint,
      tree: optimized2SignersTopologyBuilder(members)
    }
  },

  buildStubSignature: function (config: WalletConfig, overrides: Map<string, string>) {
    const parts = new Map<string, commons.signature.SignaturePart>()

    for (const [signer, signature] of overrides.entries()) {
      parts.set(signer, { signature, isDynamic: true })

      const { encoded, weight } = encodeSigners(config, parts, [], 0)

      if (weight >= BigInt(config.threshold)) {
        return encoded
      }
    }

    const signers = signersOf(config.tree)

    for (const { address } of signers.sort(({ weight: a }, { weight: b }) => a - b)) {
      const signature =
        '0x4e82f02f388a12b5f9d29eaf2452dd040c0ee5804b4e504b4dd64e396c6c781f2c7624195acba242dd825bfd25a290912e3c230841fd55c9a734c4de8d9899451b02'
      parts.set(address, { signature, isDynamic: false })

      const { encoded, weight } = encodeSigners(config, parts, [], 0)

      if (weight >= BigInt(config.threshold)) {
        return encoded
      }
    }

    return encodeSigners(config, parts, [], 0).encoded
  }
}
