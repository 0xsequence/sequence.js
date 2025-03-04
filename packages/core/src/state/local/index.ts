import {
  Context,
  Payload,
  Signature,
  WalletConfig,
  Address as SequenceAddress,
  Extensions,
} from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex, PersonalMessage, Secp256k1 } from 'ox'
import { Provider as ProviderInterface } from '..'
import { MemoryStore } from './memory'

export interface Store {
  // top level configurations store
  loadConfig: (imageHash: Hex.Hex) => Promise<WalletConfig.Configuration | undefined>
  saveConfig: (imageHash: Hex.Hex, config: WalletConfig.Configuration) => Promise<void>

  // counterfactual wallets
  loadCounterfactualWallet: (
    wallet: Address.Address,
  ) => Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined>
  saveCounterfactualWallet: (wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context) => Promise<void>

  // payloads
  loadPayloadOfSubdigest: (
    subdigest: Hex.Hex,
  ) => Promise<{ content: Payload.Parented; chainId: bigint; wallet: Address.Address } | undefined>
  savePayloadOfSubdigest: (
    subdigest: Hex.Hex,
    payload: { content: Payload.Parented; chainId: bigint; wallet: Address.Address },
  ) => Promise<void>

  // signatures
  loadSubdigestsOfSigner: (signer: Address.Address) => Promise<Hex.Hex[]>
  loadSignatureOfSubdigest: (
    signer: Address.Address,
    subdigest: Hex.Hex,
  ) => Promise<Signature.SignatureOfSignerLeaf | undefined>
  saveSignatureOfSubdigest: (
    signer: Address.Address,
    subdigest: Hex.Hex,
    signature: Signature.SignatureOfSignerLeaf,
  ) => Promise<void>
}

export class Provider implements ProviderInterface {
  constructor(
    private readonly store: Store = new MemoryStore(),
    public readonly extensions: Extensions.Extensions = Extensions.Dev1,
  ) {}

  getConfiguration(imageHash: Hex.Hex): Promise<WalletConfig.Configuration | undefined> {
    return this.store.loadConfig(imageHash)
  }

  async saveWallet(deployConfiguration: WalletConfig.Configuration, context: Context.Context): Promise<void> {
    // Save both the configuration and the deploy hash
    await this.saveConfig(deployConfiguration)
    const imageHash = WalletConfig.hashConfiguration(deployConfiguration)
    await this.saveCounterfactualWallet(SequenceAddress.from(imageHash, context), Hex.fromBytes(imageHash), context)
  }

  async saveConfig(config: WalletConfig.Configuration): Promise<void> {
    const imageHash = Bytes.toHex(WalletConfig.hashConfiguration(config))
    const previous = await this.store.loadConfig(imageHash)
    if (previous) {
      const combined = WalletConfig.mergeTopology(previous.topology, config.topology)
      return this.store.saveConfig(imageHash, { ...previous, topology: combined })
    } else {
      return this.store.saveConfig(imageHash, config)
    }
  }

  saveCounterfactualWallet(
    wallet: Address.Address,
    imageHash: Hex.Hex,
    context: Context.Context,
  ): void | Promise<void> {
    this.store.saveCounterfactualWallet(wallet, imageHash, context)
  }

  getDeploy(wallet: Address.Address): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    return this.store.loadCounterfactualWallet(wallet)
  }

  async getWallets(signer: Address.Address): Promise<{
    [wallet: `0x${string}`]: { chainId: bigint; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf }
  }> {
    const subdigests = await this.store.loadSubdigestsOfSigner(signer)
    const payloads = await Promise.all(subdigests.map((subdigest) => this.store.loadPayloadOfSubdigest(subdigest)))

    let response: {
      [wallet: `0x${string}`]: {
        chainId: bigint
        payload: Payload.Parented
        signature: Signature.SignatureOfSignerLeaf
      }
    } = {}

    for (const payload of payloads) {
      if (!payload || response[payload.wallet]) {
        continue
      }

      const signature = await this.store.loadSignatureOfSubdigest(
        signer,
        Hex.fromBytes(Payload.hash(payload.wallet, payload.chainId, payload.content)),
      )
      if (!signature) {
        continue
      }

      response[payload.wallet] = {
        chainId: payload.chainId,
        payload: payload.content,
        signature: signature,
      }
    }

    return response
  }

  saveWitnesses(
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.SignatureOfSignerLeaf[],
  ): void | Promise<void> {
    const subdigest = Hex.fromBytes(Payload.hash(wallet, chainId, payload))
    for (const signature of signatures) {
      this.store.saveSignatureOfSubdigest(wallet, subdigest, signature)
    }
  }

  async getConfigurationUpdates(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<{ imageHash: Hex.Hex; signature: Signature.RawSignature }[]> {
    let fromConfig = await this.store.loadConfig(fromImageHash)
    if (!fromConfig) {
      return []
    }

    const { signers } = WalletConfig.getSigners(fromConfig)
    const subdigestsOfSigner = await Promise.all(signers.map((s) => this.store.loadSubdigestsOfSigner(s)))
    const subdigests = [...new Set(subdigestsOfSigner.flat())]

    const payloads = await Promise.all(subdigests.map((subdigest) => this.store.loadPayloadOfSubdigest(subdigest)))

    const nextCandidates = await Promise.all(
      payloads
        .filter((p) => p?.content && Payload.isConfigUpdate(p.content))
        .map(async (p) => ({
          payload: p!,
          nextImageHash: (p!.content as Payload.ConfigUpdate).imageHash,
          config: await this.store.loadConfig((p!.content as Payload.ConfigUpdate).imageHash),
        })),
    )

    let best:
      | {
          nextImageHash: Hex.Hex
          checkpoint: bigint
          signature: Signature.RawSignature
        }
      | undefined

    const nextCandidatesSorted = nextCandidates
      .filter((c) => c!.config && c!.config.checkpoint > fromConfig.checkpoint)
      .sort((a, b) =>
        // If we are looking for the longest path, sort by ascending checkpoint
        // because we want to find the smalles jump, and we should start with the
        // closest one. If we are not looking for the longest path, sort by
        // descending checkpoint, because we want to find the largest jump.
        //
        // We don't have a guarantee that all "next configs" will be valid
        // so worst case scenario we will need to try all of them.
        // But we can try to optimize for the most common case.
        a.config!.checkpoint > b.config!.checkpoint ? (options?.allUpdates ? 1 : -1) : options?.allUpdates ? -1 : 1,
      )

    for (const candidate of nextCandidatesSorted) {
      if (best) {
        if (options?.allUpdates) {
          // Only consider candidates earlier than our current best
          if (candidate.config!.checkpoint <= best.checkpoint) {
            continue
          }
        } else {
          // Only consider candidates later than our current best
          if (candidate.config!.checkpoint <= best.checkpoint) {
            continue
          }
        }
      }

      // Get all signatures (for all signers) for this subdigest
      const expectedSubdigest = Hex.fromBytes(
        Payload.hash(wallet, candidate.payload.chainId, candidate.payload.content),
      )
      const signaturesOfSigners = await Promise.all(
        signers.map(async (signer) => {
          return { signer, signature: await this.store.loadSignatureOfSubdigest(signer, expectedSubdigest) }
        }),
      )

      let totalWeight = 0n
      const encoded = Signature.fillLeaves(fromConfig.topology, (leaf) => {
        if (WalletConfig.isSapientSignerLeaf(leaf)) {
          return undefined
        }

        const signature = signaturesOfSigners.find(({ signer }) => signer === leaf.address)?.signature
        if (!signature) {
          return undefined
        }

        totalWeight += leaf.weight
        return signature
      })

      if (totalWeight < fromConfig.threshold) {
        continue
      }

      best = {
        nextImageHash: candidate.nextImageHash,
        checkpoint: candidate.config!.checkpoint,
        signature: {
          noChainId: true,
          configuration: {
            threshold: fromConfig.threshold,
            checkpoint: fromConfig.checkpoint,
            topology: encoded,
          },
        },
      }
    }

    if (!best) {
      return []
    }

    const nextStep = await this.getConfigurationUpdates(wallet, best.nextImageHash, { allUpdates: true })

    return [
      {
        imageHash: best.nextImageHash,
        signature: best.signature,
      },
      ...nextStep,
    ]
  }

  async saveUpdate(
    wallet: Address.Address,
    configuration: WalletConfig.Configuration,
    signature: Signature.RawSignature,
  ): Promise<void> {
    const nextImageHash = Bytes.toHex(WalletConfig.hashConfiguration(configuration))
    const payload: Payload.ConfigUpdate = {
      type: 'config-update',
      imageHash: nextImageHash,
    }

    const subdigest = Payload.hash(wallet, 0n, payload)

    await this.store.savePayloadOfSubdigest(Hex.fromBytes(subdigest), { content: payload, chainId: 0n, wallet })
    await this.saveConfig(configuration)

    const walk = async (topology: Signature.RawTopology): Promise<void> => {
      if (Signature.isRawNode(topology)) {
        await Promise.all([walk(topology[0]), walk(topology[1])])
        return
      }

      if (Signature.isRawNestedLeaf(topology)) {
        return walk(topology.tree)
      }

      if (Signature.isRawSignerLeaf(topology)) {
        const type = topology.signature.type
        if (type === 'eth_sign' || type === 'hash') {
          const address = Secp256k1.recoverAddress({
            payload: type === 'eth_sign' ? PersonalMessage.getSignPayload(subdigest) : subdigest,
            signature: topology.signature,
          })

          return this.store.saveSignatureOfSubdigest(address, Hex.fromBytes(subdigest), topology.signature)
        }
      }

      if (Signature.isSignedSapientSignerLeaf(topology)) {
        switch (topology.address.toLowerCase()) {
          case this.extensions.passkeys.toLowerCase():

          default:
            throw new Error(`Unsupported sapient signer: ${topology.address}`)
        }
      }
    }

    await walk(signature.configuration.topology)
  }
}

type Unpromise<T> = T extends Promise<infer S> ? S : T
