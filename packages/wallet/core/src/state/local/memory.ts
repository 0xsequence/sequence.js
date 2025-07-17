import { Context, Payload, Signature, Config, GenericTree } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Store } from './index.js'

export class MemoryStore implements Store {
  private configs = new Map<Hex.Hex, Config.Config>()
  private counterfactualWallets = new Map<Address.Address, { imageHash: Hex.Hex; context: Context.Context }>()
  private payloads = new Map<Hex.Hex, { content: Payload.Parented; chainId: bigint; wallet: Address.Address }>()
  private signerSubdigests = new Map<Address.Address, Set<Hex.Hex>>()
  private signatures = new Map<`${Address.Address}-${Hex.Hex}`, Signature.SignatureOfSignerLeaf>()

  private sapientSignerSubdigests = new Map<`${Address.Address}-${Hex.Hex}`, Set<Hex.Hex>>()
  private sapientSignatures = new Map<
    `${Address.Address}-${Hex.Hex}-${Hex.Hex}`,
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

  private getSignatureKey(signer: Address.Address, subdigest: Hex.Hex): `${Address.Address}-${Hex.Hex}` {
    return `${signer}-${subdigest}`
  }

  private getSapientSignatureKey(
    signer: Address.Address,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
  ): `${Address.Address}-${Hex.Hex}-${Hex.Hex}` {
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
    wallet: Address.Address,
  ): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    const counterfactualWallet = this.counterfactualWallets.get(wallet)
    return counterfactualWallet ? this.deepCopy(counterfactualWallet) : undefined
  }

  async saveCounterfactualWallet(wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context): Promise<void> {
    this.counterfactualWallets.set(wallet, this.deepCopy({ imageHash, context }))
  }

  async loadPayloadOfSubdigest(
    subdigest: Hex.Hex,
  ): Promise<{ content: Payload.Parented; chainId: bigint; wallet: Address.Address } | undefined> {
    const payload = this.payloads.get(subdigest)
    return payload ? this.deepCopy(payload) : undefined
  }

  async savePayloadOfSubdigest(
    subdigest: Hex.Hex,
    payload: { content: Payload.Parented; chainId: bigint; wallet: Address.Address },
  ): Promise<void> {
    this.payloads.set(subdigest, this.deepCopy(payload))
  }

  async loadSubdigestsOfSigner(signer: Address.Address): Promise<Hex.Hex[]> {
    const subdigests = this.signerSubdigests.get(signer)
    return subdigests ? Array.from(subdigests).map((s) => s as Hex.Hex) : []
  }

  async loadSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
  ): Promise<Signature.SignatureOfSignerLeaf | undefined> {
    const key = this.getSignatureKey(signer, subdigest)
    const signature = this.signatures.get(key)
    return signature ? this.deepCopy(signature) : undefined
  }

  async saveSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    signature: Signature.SignatureOfSignerLeaf,
  ): Promise<void> {
    const key = this.getSignatureKey(signer, subdigest)
    this.signatures.set(key, this.deepCopy(signature))

    const signerKey = signer
    const subdigestKey = subdigest

    if (!this.signerSubdigests.has(signerKey)) {
      this.signerSubdigests.set(signerKey, new Set())
    }
    this.signerSubdigests.get(signerKey)!.add(subdigestKey)
  }

  async loadSubdigestsOfSapientSigner(signer: Address.Address, imageHash: Hex.Hex): Promise<Hex.Hex[]> {
    const key: `${Address.Address}-${Hex.Hex}` = `${signer}-${imageHash}`
    const subdigests = this.sapientSignerSubdigests.get(key)
    return subdigests ? Array.from(subdigests).map((s) => s as Hex.Hex) : []
  }

  async loadSapientSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
  ): Promise<Signature.SignatureOfSapientSignerLeaf | undefined> {
    const key = this.getSapientSignatureKey(signer, subdigest, imageHash)
    const signature = this.sapientSignatures.get(key)
    return signature ? this.deepCopy(signature) : undefined
  }

  async saveSapientSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
    signature: Signature.SignatureOfSapientSignerLeaf,
  ): Promise<void> {
    const key = this.getSapientSignatureKey(signer, subdigest, imageHash)
    this.sapientSignatures.set(key, this.deepCopy(signature))

    const signerKey: `${Address.Address}-${Hex.Hex}` = `${signer}-${imageHash}`
    const subdigestKey = subdigest

    if (!this.sapientSignerSubdigests.has(signerKey)) {
      this.sapientSignerSubdigests.set(signerKey, new Set())
    }
    this.sapientSignerSubdigests.get(signerKey)!.add(subdigestKey)
  }

  async loadTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    const tree = this.trees.get(rootHash)
    return tree ? this.deepCopy(tree) : undefined
  }

  async saveTree(rootHash: Hex.Hex, tree: GenericTree.Tree): Promise<void> {
    this.trees.set(rootHash, this.deepCopy(tree))
  }
}
