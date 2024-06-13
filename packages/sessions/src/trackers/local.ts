import { commons, universal, v1, v2 } from '@0xsequence/core'
import { migration, migrator } from '@0xsequence/migration'
import { ethers } from 'ethers'
import { CachedEIP5719 } from '@0xsequence/replacer'
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from '../tracker'
import { isPlainNested, isPlainNode, isPlainV2Config, MemoryTrackerStore, PlainNested, PlainNode, TrackerStore } from './stores'

export class LocalConfigTracker implements ConfigTracker, migrator.PresignedMigrationTracker {
  private cachedEIP5719: CachedEIP5719

  constructor(
    // TODO: The provider is only used to determine that EIP1271 signatures have *some* validity
    // but when reconstructing a presigned transaction we should do the replacement once per chain.
    // For now, it's recommended to use Mainnet as the provider.
    public provider: ethers.Provider,
    private store: TrackerStore = new MemoryTrackerStore(),
    public useEIP5719: boolean = false
  ) {
    this.cachedEIP5719 = new CachedEIP5719(provider)
  }

  private loadTopology = async (hash: string): Promise<v2.config.Topology> => {
    const node = await this.store.loadV2Node(hash)
    if (!node) return { nodeHash: hash }

    if (isPlainNode(node)) {
      const [left, right] = await Promise.all([this.loadTopology(node.left), this.loadTopology(node.right)])
      return { left, right }
    }

    if (isPlainNested(node)) {
      return {
        weight: BigInt(node.weight),
        threshold: BigInt(node.threshold),
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
        weight: BigInt(node.weight).toString(),
        threshold: BigInt(node.threshold).toString(),
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

  saveWalletConfig = async (args: { config: commons.config.Config }): Promise<void> => {
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
      const imageHash = v2.config.ConfigCoder.imageHashOf(config)

      // This is an optimization, it allows us to avoid splitting the tree if it's already complete
      if (v2.config.isComplete(config.tree)) {
        return this.store.saveConfig(imageHash, config)
      }

      // TODO: Re-enable storing partial v2 configs once
      // we have more performant code to reconstructing them
      // in the meantime, rely on the remote tracker

      // const storeTree = this.saveTopology(config.tree)
      // const storeConfig = this.store.saveConfig(imageHash, {
      //   version: 2,
      //   threshold: BigInt(config.threshold).toString(),
      //   checkpoint: BigInt(config.checkpoint).toString(),
      //   tree: v2.config.hashNode(config.tree)
      // })

      // await Promise.all([storeTree, storeConfig])
    }

    return
  }

  private configOfImageHashCache = {} as { [key: string]: commons.config.Config }

  configOfImageHash = async (args: { imageHash: string }): Promise<commons.config.Config | undefined> => {
    const { imageHash } = args

    if (this.configOfImageHashCache[args.imageHash]) {
      return this.configOfImageHashCache[args.imageHash]
    }

    const config = await this.store.loadConfig(imageHash)
    if (!config) {
      return undefined
    }

    if (config.version === 1 || (config.version === 2 && !isPlainV2Config(config))) {
      this.configOfImageHashCache[args.imageHash] = config
      return config
    }

    if (isPlainV2Config(config)) {
      const fullConfig = {
        version: 2,
        threshold: BigInt(config.threshold),
        checkpoint: BigInt(config.checkpoint),
        tree: await this.loadTopology(config.tree)
      } as v2.config.WalletConfig
      this.configOfImageHashCache[args.imageHash] = fullConfig
      return fullConfig
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
  }): Promise<
    | {
        imageHash: string
        context: commons.context.WalletContext
      }
    | undefined
  > => {
    const { wallet } = args
    const result = await this.store.loadCounterfactualWallet(wallet)

    if (!result) return undefined

    return {
      imageHash: result.imageHash,
      context: result.context
    }
  }

  savePayload = async (args: { payload: commons.signature.SignedPayload }): Promise<void> => {
    const { payload } = args

    const subdigest = commons.signature.subdigestOf(payload)
    await this.store.savePayloadOfSubdigest(subdigest, payload)
  }

  private payloadOfSubdigestCache = {} as { [key: string]: commons.signature.SignedPayload }

  payloadOfSubdigest = async (args: { subdigest: string }): Promise<commons.signature.SignedPayload | undefined> => {
    if (this.payloadOfSubdigestCache[args.subdigest]) {
      return this.payloadOfSubdigestCache[args.subdigest]
    }

    const { subdigest } = args
    const res = await this.store.loadPayloadOfSubdigest(subdigest)

    if (res) {
      this.payloadOfSubdigestCache[subdigest] = res
    }

    return res
  }

  savePresignedConfiguration = async (args: PresignedConfig): Promise<void> => {
    // Presigned configurations only work with v2 (for now)
    // so we can assume that the signature is for a v2 configuration
    const decoded = v2.signature.SignatureCoder.decode(args.signature)
    const nextImageHash = universal.genericCoderFor(args.nextConfig.version).config.imageHashOf(args.nextConfig)
    const message = v2.chained.messageSetImageHash(nextImageHash)
    const digest = ethers.keccak256(message)
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
    wallet: string
    fromImageHash: string
    longestPath?: boolean
  }): Promise<PresignedConfigLink[]> => {
    const { wallet, fromImageHash, longestPath } = args

    const fromConfig = await this.configOfImageHash({ imageHash: fromImageHash })
    if (!fromConfig || !v2.config.ConfigCoder.isWalletConfig(fromConfig)) {
      return []
    }

    // Get all subdigests for the config members
    const signers = v2.config.signersOf(fromConfig.tree).map(s => s.address)
    const subdigestsOfSigner = await Promise.all(signers.map(s => this.store.loadSubdigestsOfSigner(s)))
    const subdigests = [...new Set(subdigestsOfSigner.flat())]

    // Get all unique payloads
    const payloads = await Promise.all(
      [...new Set(subdigests)].map(async s => ({ ...(await this.payloadOfSubdigest({ subdigest: s })), subdigest: s }))
    )

    // Get all possible next imageHashes based on the payloads
    const nextImageHashes = payloads
      .filter(p => p?.message && p?.address && p.address === wallet)
      .map(p => ({ payload: p, nextImageHash: v2.chained.decodeMessageSetImageHash(p!.message!) }))
      .filter(p => p?.nextImageHash) as {
      payload: commons.signature.SignedPayload & { subdigest: string }
      nextImageHash: string
    }[]

    // Build a signature for each next imageHash
    // and filter out the ones that don't have enough weight
    let bestCandidate:
      | {
          nextImageHash: string
          checkpoint: bigint
          signature: string
        }
      | undefined

    const nextConfigsAndCheckpoints = await Promise.all(
      nextImageHashes.map(async ({ nextImageHash, payload }) => {
        const nextConfig = await this.configOfImageHash({ imageHash: nextImageHash })
        if (!nextConfig || !v2.config.isWalletConfig(nextConfig)) return undefined
        const nextCheckpoint = BigInt(nextConfig.checkpoint)
        return { nextConfig, nextCheckpoint, nextImageHash, payload }
      })
    )

    const sortedNextConfigsAndCheckpoints = nextConfigsAndCheckpoints
      .filter(c => c !== undefined)
      .filter(c => c!.nextCheckpoint > BigInt(fromConfig.checkpoint))
      .sort((a, b) =>
        // If we are looking for the longest path, sort by ascending checkpoint
        // because we want to find the smalles jump, and we should start with the
        // closest one. If we are not looking for the longest path, sort by
        // descending checkpoint, because we want to find the largest jump.
        //
        // We don't have a guarantee that all "next configs" will be valid
        // so worst case scenario we will need to try all of them.
        // But we can try to optimize for the most common case.
        a!.nextCheckpoint > b!.nextCheckpoint ? (longestPath ? 1 : -1) : longestPath ? -1 : 1
      )

    for (const entry of sortedNextConfigsAndCheckpoints) {
      const { nextConfig, nextCheckpoint, nextImageHash, payload } = entry!

      if (bestCandidate) {
        const bestCheckpoint = bestCandidate.checkpoint
        if (longestPath) {
          // Only consider candidates earlier than our current best
          if (nextCheckpoint >= bestCheckpoint) continue
        } else {
          // Only consider candidates later than our current best
          if (nextCheckpoint <= bestCheckpoint) continue
        }
      }

      // Get all signatures (for all signers) for this subdigest
      const signatures = new Map(
        (
          await Promise.all(
            signers.map(async signer => {
              const signature = await this.store.loadSignatureOfSubdigest(signer, payload.subdigest)
              if (!signature) {
                return [signer, undefined]
              }

              const replacedSignature = ethers.hexlify(
                this.useEIP5719 ? await this.cachedEIP5719.runByEIP5719(signer, payload.subdigest, signature) : signature
              )

              const isDynamic = commons.signer.tryRecoverSigner(payload.subdigest, replacedSignature) !== signer

              return [signer, { isDynamic, signature: replacedSignature }]
            })
          )
        ).filter((signature): signature is [string, commons.signature.SignaturePart] => Boolean(signature[1]))
      )

      // Skip if we don't have ANY signatures (it can never reach the threshold)
      if (signatures.size === 0) continue

      // Encode the full signature (to see if it has enough weight)
      const encoded = v2.signature.SignatureCoder.encodeSigners(fromConfig, signatures, [], 0)
      if (encoded.weight < BigInt(fromConfig.threshold)) continue

      // Save the new best candidate
      bestCandidate = {
        nextImageHash,
        checkpoint: BigInt(nextConfig.checkpoint),
        signature: encoded.encoded
      }
    }

    if (!bestCandidate) {
      return []
    }

    // Get the next step
    const nextStep = await this.loadPresignedConfiguration({
      wallet,
      fromImageHash: bestCandidate.nextImageHash,
      longestPath
    })

    return [
      {
        wallet,
        nextImageHash: bestCandidate.nextImageHash,
        signature: bestCandidate.signature
      },
      ...nextStep
    ]
  }

  saveWitnesses = async (args: {
    wallet: string
    digest: string
    chainId: ethers.BigNumberish
    signatures: string[]
  }): Promise<void> => {
    const payload = {
      digest: args.digest,
      address: args.wallet,
      chainId: args.chainId
    }

    const subdigest = commons.signature.subdigestOf(payload)

    await Promise.all([
      this.savePayload({ payload }),
      ...args.signatures
        .filter(signature => {
          // We don't support saving witnesses for non-recoverable signatures
          // we could change this eventually, but the issue is that the witness may become invalid
          return commons.signer.canRecover(signature)
        })
        .map(signature => {
          const signer = commons.signer.recoverSigner(subdigest, signature)
          return this.store.saveSignatureOfSubdigest(signer, subdigest, signature)
        })
    ])
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<
    {
      wallet: string
      proof: {
        digest: string
        chainId: bigint
        signature: string
      }
    }[]
  > => {
    const subdigests = await this.store.loadSubdigestsOfSigner(args.signer)
    const payloads = await Promise.all(subdigests.map(s => this.payloadOfSubdigest({ subdigest: s }))).then(
      p => p.filter(p => p !== undefined) as commons.signature.SignedPayload[]
    )

    // filter unique wallets, and provide a proof for each wallet
    const result: {
      wallet: string
      proof: {
        digest: string
        chainId: bigint
        signature: string
      }
    }[] = []

    for (const payload of payloads) {
      const wallet = payload.address
      if (result.find(r => r.wallet === wallet)) continue

      const subdigest = commons.signature.subdigestOf(payload)
      const signature = await this.store.loadSignatureOfSubdigest(args.signer, subdigest)
      if (!signature) continue

      result.push({
        wallet,
        proof: {
          digest: payload.digest,
          chainId: BigInt(payload.chainId),
          signature: ethers.hexlify(signature)
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
    if (fromVersion !== 1) throw new Error('Migration not supported')
    if (!v2.config.isWalletConfig(signed.toConfig)) throw new Error('Invalid to config')

    // Validate migration transaction
    const { newImageHash, address: decodedAddress } = migration.v1v2.decodeTransaction(signed.tx, contexts)
    if (decodedAddress !== address) throw new Error('Invalid migration transaction - address')
    if (v2.config.ConfigCoder.imageHashOf(signed.toConfig) != newImageHash)
      throw new Error('Invalid migration transaction - config')

    // Split signature and save each part
    const message = commons.transaction.packMetaTransactionsData(signed.tx.nonce, signed.tx.transactions)
    const digest = ethers.keccak256(message)
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
      this.store.saveMigrationsSubdigest(address, fromVersion, fromVersion + 1, subdigest, newImageHash),
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
    const [currentConfig, txs] = await Promise.all([
      this.configOfImageHash({ imageHash: fromImageHash }),
      this.store.loadMigrationsSubdigest(address, fromVersion, fromVersion + 1)
    ])

    const coder = universal.coderFor(fromVersion)
    if (!currentConfig) {
      // We may not be able to find the config, because the migration is still not copied locally
      // in that case we consider as we don't have any migration
      return undefined
    }

    if (!coder.config.isWalletConfig(currentConfig)) {
      // throw new Error("Invalid from config - version")
      // better to not fail here, some other tracker may be able to handle this migration
      return undefined
    }

    // We need to process every migration candidate individually
    // and see which one has enough signers to be valid (for the current config)
    const candidates = await Promise.all(
      txs.map(async tx => {
        const { subdigest, toImageHash } = tx
        const payload = await this.payloadOfSubdigest({ subdigest })
        if (!payload || !payload.message) return undefined
        if (BigInt(chainId) !== BigInt(payload.chainId)) return undefined

        const signers = coder.config.signersOf(currentConfig as any).map(s => s.address)

        // Get all signatures (for all signers) for this subdigest
        const signatures = new Map(
          (
            await Promise.all(
              signers.map(async signer => {
                const signature = await this.store.loadSignatureOfSubdigest(signer, subdigest)
                if (!signature) {
                  return [signer, undefined]
                }

                const replacedSignature = ethers.hexlify(
                  this.useEIP5719 ? await this.cachedEIP5719.runByEIP5719(signer, subdigest, signature) : signature
                )

                const isDynamic = commons.signer.tryRecoverSigner(subdigest, replacedSignature) !== signer

                return [signer, { isDynamic, signature: replacedSignature }]
              })
            )
          ).filter((signature): signature is [string, commons.signature.SignaturePart] => Boolean(signature[1]))
        )

        // Encode signature parts into a single signature
        const encoded = coder.signature.encodeSigners(currentConfig as any, signatures, [], chainId)
        if (!encoded || encoded.weight < BigInt(currentConfig.threshold)) return undefined

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
              id: subdigest,
              wallet: address
            }
          },
          toConfig: await this.configOfImageHash({ imageHash: toImageHash }),
          fromVersion,
          toVersion: fromVersion + 1
        } as migrator.SignedMigration
      })
    ).then(c => c.filter(c => c !== undefined))

    // Return the first valid candidate
    return candidates[0]
  }

  updateProvider(provider: ethers.Provider) {
    this.provider = provider
  }
}
