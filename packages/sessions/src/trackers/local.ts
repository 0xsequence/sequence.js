import { commons, universal, v1, v2 } from '@0xsequence/core'
import { migration, migrator } from '@0xsequence/migration'
import { ethers } from 'ethers'
import { runByEIP5719 } from '@0xsequence/replacer'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'
import { isPlainNested, isPlainNode, isPlainV2Config, MemoryTrackerStore, PlainNested, PlainNode, TrackerStore } from './stores'

export class LocalConfigTracker implements ConfigTracker, migrator.PresignedMigrationTracker {
  constructor(
    // TODO: The provider is only used to determine that EIP1271 signatures have *some* validity
    // but when reconstructing a presigned transaction we should do the replacement once per chain.
    // For now, it's recommended to use Mainnet as the provider.
    public provider: ethers.providers.Provider,
    private store: TrackerStore = new MemoryTrackerStore()
  ) {}

  private loadTopology = async (hash: string): Promise<v2.config.Topology> => {
    const node = await this.store.loadV2Node(hash)
    if (!node) return { nodeHash: hash }

    if (isPlainNode(node)) {
      return {
        left: await this.loadTopology(node.left),
        right: await this.loadTopology(node.right)
      }
    }

    if (isPlainNested(node)) {
      return {
        weight: ethers.BigNumber.from(node.weight),
        threshold: ethers.BigNumber.from(node.threshold),
        tree: await this.loadTopology(node.tree)
      }
    }

    return node
  }

  private saveTopology = async (node: v2.config.Topology): Promise<void> => {
    if (v2.config.isNodeLeaf(node)) {
      return // Nothing to do, this is a dead-end
    }

    const hash = v2.config.hashNode(node)

    if (v2.config.isNode(node)) {
      const saveLeft = this.saveTopology(node.left)
      const saveRight = this.saveTopology(node.right)
      const saveThis = this.store.saveV2Node(hash, {
        left: v2.config.hashNode(node.left),
        right: v2.config.hashNode(node.right)
      } as PlainNode)

      await Promise.all([saveLeft, saveRight, saveThis])

      return
    }

    if (v2.config.isNestedLeaf(node)) {
      const saveTree = this.saveTopology(node.tree)
      const saveThis = this.store.saveV2Node(hash, {
        weight: ethers.BigNumber.from(node.weight).toString(),
        threshold: ethers.BigNumber.from(node.threshold).toString(),
        tree: v2.config.hashNode(node.tree)
      } as PlainNested)

      await Promise.all([saveTree, saveThis])

      return
    }

    // If it's a normal leaf, then we just store it
    if (v2.config.isSignerLeaf(node)) {
      return this.store.saveV2Node(hash, {
        address: node.address,
        weight: node.weight
      })
    }

    if (v2.config.isSubdigestLeaf(node)) {
      return this.store.saveV2Node(hash, {
        subdigest: node.subdigest
      })
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
      return this.store.saveConfig(imageHash, config)
    }

    if (v2.config.ConfigCoder.isWalletConfig(config)) {
      // We split the configuration in a list of nodes, and store them individually
      // then we can reconstruct it. This also means we can combine multiple configurations
      // if they share information
      const storeTree = this.saveTopology(config.tree)
      const storeConfig = this.store.saveConfig(v2.config.ConfigCoder.imageHashOf(config), {
        version: 2,
        threshold: ethers.BigNumber.from(config.threshold).toString(),
        checkpoint: ethers.BigNumber.from(config.checkpoint).toString(),
        tree: v2.config.hashNode(config.tree)
      })

      await Promise.all([storeTree, storeConfig])
    }

    return
  }

  configOfImageHash = async (args: {
    imageHash: string
  }): Promise<commons.config.Config | undefined> => {
    const { imageHash } = args

    const config = await this.store.loadConfig(imageHash)
    if (!config) return undefined

    if (config.version === 1) {
      return config
    }

    if (isPlainV2Config(config)) {
      return {
        version: 2,
        threshold: ethers.BigNumber.from(config.threshold),
        checkpoint: ethers.BigNumber.from(config.checkpoint),
        tree: await this.loadTopology(config.tree)
      } as v2.config.WalletConfig
    }

    throw new Error(`Unknown config type: ${config}`)
  }

  saveCounterfactualWallet = async (args: {
    config: commons.config.Config
    context: commons.context.WalletContext[]
  }): Promise<void> => {
    const { config, context } = args
    const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
    await Promise.all([
      this.saveWalletConfig({ config }),
      ...context.map(ctx => {
        const address = commons.context.addressOf(ctx, imageHash)
        return this.store.saveCounterfactualWallet(address, imageHash, ctx)
      })
    ])
  }

  imageHashOfCounterfactualWallet = async (args: {
    wallet: string
  }): Promise<{
    imageHash: string,
    context: commons.context.WalletContext
  } | undefined> => {
    const { wallet } = args
    const result = await this.store.loadCounterfactualWallet(wallet)

    if (!result) return undefined

    return {
      imageHash: result.imageHash,
      context: result.context
    }
  }

  savePayload = async (args: {
    payload: commons.signature.SignedPayload
  }): Promise<void> => {
    const { payload } = args

    const subdigest = commons.signature.subdigestOf(payload)
    await this.store.savePayloadOfSubdigest(subdigest, payload)
  }

  payloadOfSubdigest = async (args: {
    subdigest: string
  }): Promise<commons.signature.SignedPayload | undefined> => {
    const { subdigest } = args
    return this.store.loadPayloadOfSubdigest(subdigest)
  }

  savePresignedConfiguration = async (args: PresignedConfig): Promise<void> => {
    // Presigned configurations only work with v2 (for now)
    // so we can assume that the signature is for a v2 configuration
    const decoded = v2.signature.SignatureCoder.decode(args.signature)
    const nextImageHash = universal.genericCoderFor(args.nextConfig.version).config.imageHashOf(args.nextConfig)
    const message = v2.chained.messageSetImageHash(nextImageHash)
    const digest = ethers.utils.keccak256(message)
    const payload = {
      message,
      address: args.wallet,
      chainId: 0,
      digest
    }

    const savePayload = this.savePayload({ payload })
    const saveNextConfig = this.saveWalletConfig({ config: args.nextConfig })

    const recovered = await v2.signature.SignatureCoder.recover(decoded, payload, this.provider)

    // Save the recovered configuration and all signature parts
    const signatures = v2.signature.signaturesOf(recovered.config.tree)
    await Promise.all([
      savePayload,
      saveNextConfig,
      this.saveWalletConfig({ config: recovered.config }),
      ...signatures.map(sig => this.store.saveSignatureOfSubdigest(sig.address, recovered.subdigest, sig.signature))
    ])
  }

  loadPresignedConfiguration = async (args: {
    wallet: string,
    fromImageHash: string,
    longestPath?: boolean
  }): Promise<PresignedConfigLink[]> => {
    const { wallet, fromImageHash, longestPath } = args

    const fromConfig = await this.configOfImageHash({ imageHash: fromImageHash })
    if (!fromConfig || !v2.config.ConfigCoder.isWalletConfig(fromConfig)) {
      return []
    }

    // Get all subdigests for the config members
    const signers = v2.config.signersOf(fromConfig.tree).map((s) => s.address)
    const subdigestsOfSigner = await Promise.all(signers.map((s) => this.store.loadSubdigestsOfSigner(s)))
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
        const res = await this.store.loadSignatureOfSubdigest(s, payload.subdigest)
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
      this.store.saveSignatureOfSubdigest(signer, subdigest, args.signature)
    ])
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
    const subdigests = await this.store.loadSubdigestsOfSigner(args.signer)
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
      const signature = await this.store.loadSignatureOfSubdigest(args.signer, subdigest)
      if (!signature) continue

      result.push({
        wallet,
        proof: {
          digest: payload.digest,
          chainId: ethers.BigNumber.from(payload.chainId),
          signature: ethers.utils.hexlify(signature)
        }
      })
    }

    return result
  }

  async saveMigration(
    address: string,
    signed: migrator.SignedMigration,
    contexts: commons.context.VersionedContext
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
    const subdigest = commons.signature.subdigestOf(payload)

    const savePayload = this.savePayload({ payload })
    const saveToConfig = this.saveWalletConfig({ config: signed.toConfig })

    const decoded = v1.signature.SignatureCoder.decode(signed.tx.signature)
    const recovered = await v1.signature.SignatureCoder.recover(decoded, payload, this.provider)

    // Save the recovered config, the migrate transaction, and all signature parts
    const signatures = v1.signature.SignatureCoder.signaturesOf(recovered.config)

    await Promise.all([
      savePayload,
      saveToConfig,
      this.saveWalletConfig({ config: recovered.config }),
      this.store.saveMigrationsSubdigest(address, fromVersion, fromVersion + 1, subdigest),
      ...signatures.map(sig => this.store.saveSignatureOfSubdigest(sig.address, recovered.subdigest, sig.signature))
    ])
  }

  async getMigration(
    address: string,
    fromImageHash: string,
    fromVersion: number,
    chainId: ethers.BigNumberish
  ): Promise<migrator.SignedMigration | undefined> {
    // Get the current config and all possible migration payloads
    const [currentConfig, subdigests] = await Promise.all([
      this.configOfImageHash({ imageHash: fromImageHash }),
      this.store.loadMigrationsSubdigest(address, fromVersion, fromVersion + 1)
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

      const signers = coder.config.signersOf(currentConfig as any).map((s) => s.address)

      // Get all signatures (for all signers) for this subdigest
      const signatures = await Promise.all(signers.map(async (s) => {
        const res = await this.store.loadSignatureOfSubdigest(s, subdigest)
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
      } as migrator.SignedMigration
    })).then((c) => c.filter((c) => c !== undefined))

    // Return the first valid candidate
    return candidates[0]
  }
}
