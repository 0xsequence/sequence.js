import { Address, Context, Payload, Signature, Config, GenericTree } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'
import { Store } from './index.js'

export class MemoryStore implements Store {
  private configs = new Map<Hex.Hex, Config.Config>()
  private counterfactualWallets = new Map<Address.Checksummed, { imageHash: Hex.Hex; context: Context.Context }>()
  private payloads = new Map<Hex.Hex, { content: Payload.Parented; chainId: bigint; wallet: Address.Checksummed }>()
  private signerSubdigests = new Map<Address.Checksummed, Set<Hex.Hex>>()
  private signatures = new Map<`${Address.Checksummed}-${Hex.Hex}`, Signature.SignatureOfSignerLeaf>()

  private sapientSignerSubdigests = new Map<`${Address.Checksummed}-${Hex.Hex}`, Set<Hex.Hex>>()
  private sapientSignatures = new Map<
    `${Address.Checksummed}-${Hex.Hex}-${Hex.Hex}`,
    Signature.SignatureOfSapientSignerLeaf
  >()

  private trees = new Map<Hex.Hex, GenericTree.Tree>()

  private deepCopy<T>(value: T): T {
    // modern runtime → fast native path
    if (typeof structuredClone === 'function') {
      return structuredClone(value)
    }

    // very small poly-fill for old environments
    if (value === null || typeof value !== 'object') return value
    if (value instanceof Date) return new Date(value.getTime()) as unknown as T
    if (Array.isArray(value)) return value.map((v) => this.deepCopy(v)) as unknown as T
    if (value instanceof Map) {
      return new Map(Array.from(value, ([k, v]) => [this.deepCopy(k), this.deepCopy(v)])) as unknown as T
    }
    if (value instanceof Set) {
      return new Set(Array.from(value, (v) => this.deepCopy(v))) as unknown as T
    }

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = this.deepCopy(v)
    }
    return out as T
  }

  private getSignatureKey(signer: Address.Checksummed, subdigest: Hex.Hex): `${Address.Checksummed}-${Hex.Hex}` {
    return `${signer}-${subdigest}`
  }

  private getSapientSignatureKey(
    signer: Address.Checksummed,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
  ): `${Address.Checksummed}-${Hex.Hex}-${Hex.Hex}` {
    return `${signer}-${imageHash}-${subdigest}`
  }

  async loadConfig(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    const config = this.configs.get(imageHash)
    return config ? this.deepCopy(config) : undefined
  }

  async saveConfig(imageHash: Hex.Hex, config: Config.Config): Promise<void> {
    this.configs.set(imageHash, this.deepCopy(config))
  }

  async loadCounterfactualWallet(
    wallet: Address.Checksummed,
  ): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    const counterfactualWallet = this.counterfactualWallets.get(wallet)
    return counterfactualWallet ? this.deepCopy(counterfactualWallet) : undefined
  }

  async saveCounterfactualWallet(
    wallet: Address.Checksummed,
    imageHash: Hex.Hex,
    context: Context.Context,
  ): Promise<void> {
    this.counterfactualWallets.set(wallet, this.deepCopy({ imageHash, context }))
  }

  async loadPayloadOfSubdigest(
    subdigest: Hex.Hex,
  ): Promise<{ content: Payload.Parented; chainId: bigint; wallet: Address.Checksummed } | undefined> {
    const payload = this.payloads.get(subdigest)
    return payload ? this.deepCopy(payload) : undefined
  }

  async savePayloadOfSubdigest(
    subdigest: Hex.Hex,
    payload: { content: Payload.Parented; chainId: bigint; wallet: Address.Checksummed },
  ): Promise<void> {
    this.payloads.set(subdigest, this.deepCopy(payload))
  }

  async loadSubdigestsOfSigner(signer: Address.Checksummed): Promise<Hex.Hex[]> {
    const subdigests = this.signerSubdigests.get(signer)
    return subdigests ? Array.from(subdigests) : []
  }

  async loadSignatureOfSubdigest(
    signer: Address.Checksummed,
    subdigest: Hex.Hex,
  ): Promise<Signature.SignatureOfSignerLeaf | undefined> {
    const key = this.getSignatureKey(signer, subdigest)
    const signature = this.signatures.get(key)
    return signature ? this.deepCopy(signature) : undefined
  }

  async saveSignatureOfSubdigest(
    signer: Address.Checksummed,
    subdigest: Hex.Hex,
    signature: Signature.SignatureOfSignerLeaf,
  ): Promise<void> {
    const key = this.getSignatureKey(signer, subdigest)
    this.signatures.set(key, this.deepCopy(signature))

    if (!this.signerSubdigests.has(signer)) {
      this.signerSubdigests.set(signer, new Set())
    }
    this.signerSubdigests.get(signer)!.add(subdigest)
  }

  async loadSubdigestsOfSapientSigner(signer: Address.Checksummed, imageHash: Hex.Hex): Promise<Hex.Hex[]> {
    const key = `${signer}-${imageHash}` as const
    const subdigests = this.sapientSignerSubdigests.get(key)
    return subdigests ? Array.from(subdigests) : []
  }

  async loadSapientSignatureOfSubdigest(
    signer: Address.Checksummed,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
  ): Promise<Signature.SignatureOfSapientSignerLeaf | undefined> {
    const key = this.getSapientSignatureKey(signer, subdigest, imageHash)
    const signature = this.sapientSignatures.get(key)
    return signature ? this.deepCopy(signature) : undefined
  }

  async saveSapientSignatureOfSubdigest(
    signer: Address.Checksummed,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
    signature: Signature.SignatureOfSapientSignerLeaf,
  ): Promise<void> {
    const key = this.getSapientSignatureKey(signer, subdigest, imageHash)
    this.sapientSignatures.set(key, this.deepCopy(signature))

    const signerKey = `${signer}-${imageHash}` as const

    if (!this.sapientSignerSubdigests.has(signerKey)) {
      this.sapientSignerSubdigests.set(signerKey, new Set())
    }
    this.sapientSignerSubdigests.get(signerKey)!.add(subdigest)
  }

  async loadTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    const tree = this.trees.get(rootHash)
    return tree ? this.deepCopy(tree) : undefined
  }

  async saveTree(rootHash: Hex.Hex, tree: GenericTree.Tree): Promise<void> {
    this.trees.set(rootHash, this.deepCopy(tree))
  }
}
