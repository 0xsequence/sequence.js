
import { commons, universal, v1, v2 } from "@0xsequence/core"
import { migration, context } from "@0xsequence/migration"
import { PresignedMigrationTracker, SignedMigration } from "@0xsequence/migration/src/migrator"
import { ethers } from "ethers"
import { runByEIP5719 } from "@0xsequence/replacer"
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

export class LocalConfigTracker implements ConfigTracker, PresignedMigrationTracker {
  constructor(
    // TODO: The provider is only used to determine that EIP1271 signatures have *some* validity
    // but when reconstructing a presigned transaction we should do the replacement once per chain.
    // For now, it's recommended to use Mainnet as the provider.
    public provider: ethers.providers.Provider,
    private store: KeyValueStore = new MemoryStore()
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
      chainId: ethers.BigNumber.from(payload.chainId).toString()
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
      chainId: ethers.BigNumber.from(parsed.chainId)
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
      chainId: 0,
      digest
    }

    await this.savePayload({ payload })
    const recovered = await v2.signature.SignatureCoder.recover(decoded, payload, this.provider)

    // Save all signature parts
    const signatures = v2.signature.signaturesOf(recovered.config.tree)
    await Promise.all(signatures.map((sig) => this.saveSubdigest({
      wallet: args.wallet,
      subdigest: recovered.subdigest,
      signer: sig.address,
      signature: sig.signature
    })))

    // Save the recovered configuration
    await this.saveWalletConfig({ config: recovered.config })
  }

  loadPresignedConfiguration = async (args: {
    wallet: string,
    fromImageHash: string,
    longestPath?: boolean
  }): Promise<PresignedConfigUpdate[]> => {
    const { wallet, fromImageHash, longestPath } = args

    const fromConfig = await this.configOfImageHash({ imageHash: fromImageHash })
    if (!fromConfig || !v2.config.ConfigCoder.isWalletConfig(fromConfig)) {
      return []
    }

    // Get all subdigests for the config members
    const signers = v2.config.signersOf(fromConfig.tree)
    const subdigestsOfSigner = await Promise.all(signers.map((s) => this.store.getMany(s)))
    const subdigests = [...new Set(subdigestsOfSigner.flat())]

    // Get all unique payloads
    const payloads = await Promise.all([...new Set(subdigests)]
      .map(async (s) => ({ ...(await this.payloadOfSubdigest({ subdigest: s })), subdigest: s })))

    // Get all possible next imageHashes based on the payloads
    const nextImageHashes = payloads
      .filter((p) => p?.message && p?.address && p.address === wallet)
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

      // Only consider candidates later than the starting checkpoint
      if (nextCheckpoint.lte(fromConfig.checkpoint)) continue

      if (bestCandidate) {
        const bestCheckpoint = bestCandidate.checkpoint
        if (longestPath) {
          // Only consider candidates earlier than our current best
          if (nextCheckpoint.gte(bestCheckpoint)) continue
        } else {
          // Only consider candidates later than our current best
          if (nextCheckpoint.lte(bestCheckpoint)) continue
        }
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

        const isDynamic = commons.signer.tryRecoverSigner(sig.subdigest, sig.signature) !== sig.signer
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
      longestPath
    })

    return [{
      wallet,
      nextImageHash: bestCandidate.nextImageHash,
      signature: bestCandidate.signature
    }, ...nextStep]
  }

  saveWitness = async (args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumberish,
    signature: string
  }): Promise<void> => {
    const payload = {
      digest: args.digest,
      address: args.wallet,
      chainId: args.chainId,
    }

    const subdigest = commons.signature.subdigestOf(payload)
    const signer = commons.signer.recoverSigner(subdigest, args.signature)

    await Promise.all([
      this.savePayload({ payload }),
      this.saveSubdigest({ wallet: args.wallet, signer, subdigest, signature: args.signature }),
    ])
  }

  private saveSubdigest = async (args: {
    wallet: string,
    signer: string,
    subdigest: string,
    signature: string
  }) => {
    // subdigest:address -> signature
    const key = `${args.subdigest}:${args.signer}`
    const saveSignature = this.store.set(key, args.signature)

    // address -> subdigest[]
    const saveSubdigests = this.store.setMany(args.signer, args.subdigest)

    await Promise.all([saveSignature, saveSubdigests])
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{
    wallet: string,
    proof: {
      digest: string,
      chainId: ethers.BigNumber,
      signature: string
    }
  }[]> => {
    const subdigests = await this.store.getMany(args.signer)
    const payloads = await Promise.all(subdigests.map((s) => this.payloadOfSubdigest({ subdigest: s })))
      .then((p) => p.filter((p) => p !== undefined) as commons.signature.SignedPayload[])

    // filter unique wallets, and provide a proof for each wallet
    const result: {
      wallet: string,
      proof: {
        digest: string,
        chainId: ethers.BigNumber,
        signature: string
      }
    }[] = []

    for (const payload of payloads) {
      const wallet = payload.address
      if (result.find((r) => r.wallet === wallet)) continue

      const subdigest = commons.signature.subdigestOf(payload)
      const signature = await this.store.get(`${subdigest}:${args.signer}`)
      if (!signature) continue

      result.push({
        wallet,
        proof: {
          digest: payload.digest,
          chainId: ethers.BigNumber.from(payload.chainId),
          signature
        }
      })
    }

    return result
  }

  async saveMigration(
    address: string,
    signed: SignedMigration,
    contexts: context.VersionedContext
  ): Promise<void> {
    const fromVersion = signed.fromVersion
    if (fromVersion !== 1) throw new Error("Migration not supported")
    if (!v2.config.isWalletConfig(signed.toConfig)) throw new Error("Invalid to config")

    // Validate migration transaction
    const { newImageHash, address: decodedAddress } = migration.v1v2.decodeTransaction(signed.tx, contexts)
    if (decodedAddress !== address) throw new Error("Invalid migration transaction - address")
    if (
      v2.config.ConfigCoder.imageHashOf(signed.toConfig) !=
      newImageHash
    ) throw new Error("Invalid migration transaction - config")

    // Split signature and save each part
    const message = commons.transaction.packMetaTransactionsData(signed.tx.nonce, signed.tx.transactions)
    const digest = ethers.utils.keccak256(message)
    const payload = { chainId: signed.tx.chainId, message, address, digest }

    await this.savePayload({ payload })

    const decoded = v1.signature.SignatureCoder.decode(signed.tx.signature)
    const recovered = await v1.signature.SignatureCoder.recover(decoded, payload, this.provider)

    // Save all signature parts
    const signatures = v1.signature.SignatureCoder.signaturesOf(recovered.config)
    await Promise.all(signatures.map((sig) => this.saveSubdigest({
      wallet: address,
      subdigest: recovered.subdigest,
      signer: sig.address,
      signature: sig.signature
    })))

    // Save the recovered config
    await this.saveWalletConfig({
      config: recovered.config
    })

    // Save the migrate transaction
    const subdigest = commons.signature.subdigestOf(payload)
    await this.store.setMany(`migrate:${address}:${fromVersion}:${fromVersion + 1}`, subdigest)
  }

  async getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<SignedMigration | undefined> {
    // Get the current config and all possible migration payloads
    const [currentConfig, subdigests] = await Promise.all([
      this.configOfImageHash({ imageHash: fromImageHash }),
      this.store.getMany(`migrate:${address}:${fromVersion}:${fromVersion + 1}`)
    ])

    const coder = universal.coderFor(fromVersion)
    if (!currentConfig) throw new Error("Invalid from config")
    if (!coder.config.isWalletConfig(currentConfig)) throw new Error("Invalid from config - version")

    // We need to process every migration candidate individually
    // and see which one has enough signers to be valid (for the current config)
    const candidates = await Promise.all(subdigests.map(async (subdigest) => {
      const payload = await this.payloadOfSubdigest({ subdigest })
      if (!payload || !payload.message) return undefined
      if (!ethers.BigNumber.from(chainId).eq(payload.chainId)) return undefined

      const signers = coder.config.signersOf(currentConfig as any)

      // Get all signatures (for all signers) for this subdigest
      const signatures = await Promise.all(signers.map(async (s) => {
        const res = await this.store.get(`${subdigest}:${s}`)
        return { signer: s, signature: res, subdigest }
      }))

      const mappedSignatures: Map<string, commons.signature.SignaturePart> = new Map()
      for (const sig of signatures) {
        if (!sig.signature) continue

        // TODO: Use Promise.all for EIP-5719
        const replacedSignature = await runByEIP5719(sig.signer, this.provider, sig.subdigest, sig.signature)
          .then((s) => ethers.utils.hexlify(s))

        const isDynamic = commons.signer.tryRecoverSigner(sig.subdigest, sig.signature) !== sig.signer
        mappedSignatures.set(sig.signer, { isDynamic, signature: replacedSignature })
      }

      // Encode signature parts into a single signature
      const encoded = coder.signature.encodeSigners(currentConfig as any, mappedSignatures, [], chainId)
      if (!encoded || encoded.weight < currentConfig.threshold) return undefined

      // Unpack payload (it should have transactions)
      const [nonce, transactions] = commons.transaction.unpackMetaTransactionsData(payload.message)

      return {
        tx: {
          entrypoint: address,
          transactions: commons.transaction.fromTxAbiEncode(transactions),
          chainId: chainId,
          nonce: nonce,
          signature: encoded.encoded,
          intent: {
            id: ethers.utils.keccak256(payload.message),
            wallet: address,
          }
        },
        toImageHash: coder.config.imageHashOf(currentConfig as any),
        toConfig: currentConfig,
        fromVersion,
        toVersion: fromVersion + 1
      } as SignedMigration
    })).then((c) => c.filter((c) => c !== undefined))

    // Return the first valid candidate
    return candidates[0]
  }
}
