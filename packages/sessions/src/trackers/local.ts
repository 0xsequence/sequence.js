
import { commons, v1, v2 } from "@0xsequence/core"
import { ethers } from "ethers"
import { AssumedWalletConfigs, ConfigTracker, PresignedConfigUpdate, PresignedConfigurationPayload } from "../tracker"

export interface KeyValueStore {
  get: (key: string) => Promise<string | undefined>
  set: (key: string, value: string) => Promise<void>
}

export class MemoryStore implements KeyValueStore {
  private store: { [key: string]: string } = {}

  get = async (key: string) => this.store[key]
  set = async (key: string, value: string) => { this.store[key] = value }
}

type PlainNode = {
  left: string,
  right: string
}

type PlainNested = {
  weight: string,
  threshold: string,
  tree: string
}

type PlainV2Config = {
  version: 2,
  threshold: string,
  checkpoint: string,
  tree: string
}

function isPlainNode(node: any): node is PlainNode {
  return node.left !== undefined && node.right !== undefined
}

function isPlainNested(node: any): node is PlainNested {
  return node.weight !== undefined && node.threshold !== undefined && node.tree !== undefined
}

function isPlainV2Config(config: any): config is PlainV2Config {
  return config.version === 2 && config.threshold !== undefined && config.checkpoint !== undefined && config.tree !== undefined
}

export class LocalConfigTracker implements ConfigTracker {
  constructor(private store: KeyValueStore = new MemoryStore()) {}

  private loadTopology = async (hash: string): Promise<v2.config.Topology> => {
    const plain = await this.store.get(hash)
    if (!plain || plain === 'undefined' || plain === '') return { nodeHash: hash }

    const parsed = JSON.parse(plain)

    if (isPlainNode(parsed)) {
      return {
        left: await this.loadTopology(parsed.left),
        right: await this.loadTopology(parsed.right)
      }
    }

    if (isPlainNested(parsed)) {
      return {
        weight: ethers.BigNumber.from(parsed.weight),
        threshold: ethers.BigNumber.from(parsed.threshold),
        tree: await this.loadTopology(parsed.tree)
      }
    }

    return v2.config.topologyFromJSON(parsed)
  }

  private saveTopology = async (node: v2.config.Topology): Promise<void> => {
    if (v2.config.isNodeLeaf(node)) {
      return // Nothing to do, this is a dead-end
    }

    const hash = v2.config.hashNode(node)

    if (v2.config.isNode(node)) {
      const saveLeft = this.saveTopology(node.left)
      const saveRight = this.saveTopology(node.right)

      await Promise.all([saveLeft, saveRight, this.store.set(hash, JSON.stringify({
        left: v2.config.hashNode(node.left),
        right: v2.config.hashNode(node.right)
      } as PlainNode))])

      return
    }

    if (v2.config.isNestedLeaf(node)) {
      const saveTree = this.saveTopology(node.tree)

      await Promise.all([saveTree, this.store.set(hash, JSON.stringify({
        weight: ethers.BigNumber.from(node.weight).toString(),
        threshold: ethers.BigNumber.from(node.threshold).toString(),
        tree: v2.config.hashNode(node.tree)
      } as PlainNested))])

      return
    }

    // If it's a normal leaf, then we just store it
    if (
      v2.config.isSignerLeaf(node) ||
      v2.config.isSubdigestLeaf(node)
    ) {
      return this.store.set(hash, v2.config.topologyToJSON(node))
    }

    throw new Error(`Unknown topology type: ${node}`)
  }

  saveWalletConfig = async (args: {
    config: commons.config.Config
  }): Promise<void> => {
    const { config } = args
    if (v1.config.ConfigCoder.isWalletConfig(config)) {
      // We can store the configuration as-is
      const imageHash = v1.config.ConfigCoder.imageHashOf(config)
      return this.store.set(imageHash, v1.config.ConfigCoder.toJSON(config))
    }

    if (v2.config.ConfigCoder.isWalletConfig(config)) {
      // We split the configuration in a list of nodes, and store them individually
      // then we can reconstruct it. This also means we can combine multiple configurations
      // if they share information
      const storeTree = this.saveTopology(config.tree)
      await Promise.all([storeTree, this.store.set(
        v2.config.ConfigCoder.imageHashOf(config),
        JSON.stringify({
          version: 2,
          threshold: ethers.BigNumber.from(config.threshold).toString(),
          checkpoint: ethers.BigNumber.from(config.checkpoint).toString(),
          tree: v2.config.hashNode(config.tree)
      } as PlainV2Config))])
    }

    return
  }

  configOfImageHash = async (args: {
    imageHash: string
  }): Promise<commons.config.Config | undefined> => {
    const { imageHash } = args

    const protoConfigRes = await this.store.get(imageHash)
    if (!protoConfigRes) return undefined

    const protoConfig = JSON.parse(protoConfigRes) as v1.config.WalletConfig | PlainV2Config

    if (protoConfig.version === 1) {
      return v1.config.ConfigCoder.fromJSON(protoConfigRes)
    }

    if (isPlainV2Config(protoConfig)) {
      return {
        version: 2,
        threshold: ethers.BigNumber.from(protoConfig.threshold),
        checkpoint: ethers.BigNumber.from(protoConfig.checkpoint),
        tree: await this.loadTopology(protoConfig.tree)
      } as v2.config.WalletConfig
    }

    throw new Error(`Unknown config type: ${protoConfig}`)
  }

  loadPresignedConfiguration = (args: {
    wallet: string,
    fromImageHash: string,
    checkpoint: ethers.BigNumberish,
    assumedConfigs?: AssumedWalletConfigs,
    longestPath?: boolean
  }): Promise<PresignedConfigUpdate[]> => {
    throw Error('not implemented')
  }

  savePresignedConfiguration = (
    args: PresignedConfigurationPayload
  ): Promise<void> => {
    throw Error('not implemented')
  }

  saveWitness = ( args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumberish,
    signature: string
  }): Promise<void> => {
    throw Error('not implemented')
  }

  imageHashOfCounterFactualWallet = (args: {
    context: commons.context.WalletContext[],
    wallet: string
  }): Promise<{
    imageHash: string,
    context: commons.context.WalletContext
  } | undefined> => {
    throw Error('not implemented')
  }

  saveCounterFactualWallet = (args: {
    imageHash: string,
    context: commons.context.WalletContext[]
  }): Promise<void> => {
    throw Error('not implemented')
  }

  walletsOfSigner = (args: {
    signer: string
  }): Promise<{
    wallet: string,
    proof: {
      digest: string,
      chainId: ethers.BigNumber,
      signature: commons.signature.SignaturePart
    }
  }[]> => {
    throw Error('not implemented')
  }
}