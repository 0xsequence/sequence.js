
import { commons, v1, v2 } from "@0xsequence/core"
import { tryRecoverSigner } from "@0xsequence/core/src/commons/signer"
import { ethers } from "ethers"
import { runByEIP5719 } from "../../../replacer/src"
import { ConfigTracker, PresignedConfigUpdate, PresignedConfigurationPayload } from "../tracker"

export interface KeyValueStore {
  get: (key: string) => Promise<string | undefined>
  set: (key: string, value: string) => Promise<void>

  setMany: (key: string, value: string) => Promise<void>
  getMany: (key: string) => Promise<string[]>
}

export class MemoryStore implements KeyValueStore {
  private store: { [key: string]: string } = {}
  private manyStore: { [key: string]: string[] } = {}

  get = async (key: string) => this.store[key]
  set = async (key: string, value: string) => { this.store[key] = value }

  setMany = async (key: string, value: string) => {
    if (!this.manyStore[key]) this.manyStore[key] = []
    this.manyStore[key].push(value)
  }

  getMany = async (key: string) => this.manyStore[key] || []
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
  constructor(
    private store: KeyValueStore = new MemoryStore(),
    public provider: ethers.providers.Provider
  ) {}

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

  saveCounterFactualWallet = async (args: {
    imageHash: string,
    context: commons.context.WalletContext[]
  }): Promise<void> => {
    const { imageHash, context } = args
    for (const ctx of context) {
      const address = commons.context.addressOf(ctx, imageHash)

      await this.store.set(address, JSON.stringify({
        imageHash,
        context: ctx
      }))
    }
  }

  imageHashOfCounterFactualWallet = async (args: {
    wallet: string
  }): Promise<{
    imageHash: string,
    context: commons.context.WalletContext
  } | undefined> => {
    const { wallet } = args
    const result = await this.store.get(wallet)

    if (!result) return undefined
    const parsed = JSON.parse(result)

    return {
      imageHash: parsed.imageHash,
      context: parsed.context
    }
  }

  savePayload = async (args: {
    payload: commons.signature.SignedPayload
  }): Promise<void> => {
    const { payload } = args

    const subdigest = commons.signature.subdigestOf(payload)
    return this.store.set(subdigest, JSON.stringify({
      ...payload,
      chainid: ethers.BigNumber.from(payload.chainid).toString()
    }))
  }

  payloadOfSubdigest = async (args: {
    subdigest: string
  }): Promise<commons.signature.SignedPayload | undefined> => {
    const { subdigest } = args

    const result = await this.store.get(subdigest)
    if (!result) return undefined

    const parsed = JSON.parse(result)
    return {
      ...parsed,
      chainid: ethers.BigNumber.from(parsed.chainid)
    }
  }

  savePresignedConfiguration = async (
    args: PresignedConfigurationPayload
  ): Promise<void> => {
    // Presigned configurations only work with v2 (for now)
    // so we can assume that the signature is for a v2 configuration
    const decoded = v2.signature.SignatureCoder.decode(args.signature)
    const message = v2.chained.messageSetImageHash(args.nextImageHash)
    const digest = ethers.utils.keccak256(message)
    const payload = {
      message,
      address: args.wallet,
      chainid: 0,
      digest
    }

    await this.savePayload({ payload })
    const recovered = await v2.signature.SignatureCoder.recover(decoded, payload, this.provider)

    // Save all signature parts
    const signatures = v2.signature.signaturesOf(recovered.config.tree)
    await Promise.all(signatures.map(async (sig) => {
      // digest:address -> signature
      const key = `${recovered.subdigest}:${sig.address}`
      await this.store.set(key, sig.signature)

      // address -> subdigest[]
      return this.store.setMany(sig.address, recovered.subdigest)
    }))

    // Save the recovered configuration
    await this.saveWalletConfig({ config: recovered.config })
  }

  loadPresignedConfiguration = async (args: {
    wallet: string,
    fromImageHash: string,
    checkpoint: ethers.BigNumberish,
    longestPath?: boolean
  }): Promise<PresignedConfigUpdate[]> => {
    const { wallet, fromImageHash, checkpoint, longestPath } = args

    const fromConfig = await this.configOfImageHash({ imageHash: fromImageHash })
    if (!fromConfig || !v2.config.ConfigCoder.isWalletConfig(fromConfig)) {
      console.warn(`loadPresignedConfiguration: no config / not v2 for imageHash ${fromImageHash}`)
      return []
    }

    // Get all subdigests for the config members
    const signers = [...new Set(v2.config.signersOf(fromConfig.tree))]
    const subdigestsOfSigner = await Promise.all(signers.map((s) => this.store.getMany(s)))
    const subdigests = subdigestsOfSigner.flat()

    // Get all unique payloads
    const payloads = await Promise.all([...new Set(subdigests)]
      .map(async (s) => ({ ...(await this.payloadOfSubdigest({ subdigest: s })), subdigest: s })))

    // Get all possible next imageHashes based on the payloads
    const nextImageHashes = payloads
      .filter((p) => p?.message)
      .map((p) => ({ payload: p, nextImageHash: v2.chained.decodeMessageSetImageHash(p!.message!) }))
      .filter((p) => p?.nextImageHash) as { payload: commons.signature.SignedPayload & { subdigest: string }, nextImageHash: string }[]

    // Build a signature for each next imageHash
    // and filter out the ones that don't have enough weight
    let bestCandidate: {
      nextImageHash: string,
      checkpoint: ethers.BigNumber,
      signature: string,
    } | undefined

    for (const { payload, nextImageHash } of nextImageHashes) {
      // Get config of next imageHash
      const nextConfig = await this.configOfImageHash({ imageHash: nextImageHash })
      if (!nextConfig || !v2.config.isWalletConfig(nextConfig)) continue
      const nextCheckpoint = ethers.BigNumber.from(nextConfig.checkpoint)

      // If next config doesn't have a higher checkpoint, skip
      const bestCheckpoint = bestCandidate?.checkpoint ?? checkpoint
      if (!nextCheckpoint.gt(bestCheckpoint)) continue

      if (longestPath) {
        if (bestCandidate && bestCandidate.checkpoint.gt(nextConfig.checkpoint)) continue
      } else {
        if (bestCandidate && bestCandidate.checkpoint.lt(nextConfig.checkpoint)) continue
      }

      // Get all signatures (for all signers) for this subdigest
      const signatures = await Promise.all(signers.map(async (s) => {
        const res = await this.store.get(`${payload.subdigest}:${s}`)
        return { signer: s, signature: res, subdigest: payload.subdigest }
      }))

      const mappedSignatures: Map<string, commons.signature.SignaturePart> = new Map()
      for (const sig of signatures) {
        if (!sig.signature) continue

        // TODO: Use Promise.all for EIP-5719
        const replacedSignature = await runByEIP5719(sig.signer, this.provider, sig.subdigest, sig.signature)
          .then((s) => ethers.utils.hexlify(s))

        const isDynamic = tryRecoverSigner(sig.subdigest, sig.signature) !== sig.signer
        mappedSignatures.set(sig.signer, { isDynamic, signature: replacedSignature })
      }

      // Encode the full signature
      const encoded = v2.signature.SignatureCoder.encodeSigners(fromConfig, mappedSignatures, [], 0)
      if (encoded.weight.lt(fromConfig.threshold)) continue

      // Save the new best candidate
      bestCandidate = {
        nextImageHash,
        checkpoint: ethers.BigNumber.from(nextConfig.checkpoint),
        signature: encoded.encoded
      }
    }

    if (!bestCandidate) return []

    // Get the next step
    const nextStep = await this.loadPresignedConfiguration({
      wallet,
      fromImageHash: bestCandidate.nextImageHash,
      checkpoint: bestCandidate.checkpoint,
      longestPath
    })

    return [{
      wallet,
      nextImageHash: bestCandidate.nextImageHash,
      signature: bestCandidate.signature
    }, ...nextStep]
  }

  saveWitness = (args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumberish,
    signature: string
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
