import { Context, Payload, Signature, WalletConfig } from '@0xsequence/sequence-primitives'
import { Address, Hex } from 'ox'
import { Store } from './index'

export class MemoryStore implements Store {
  private configs = new Map<`0x${string}`, WalletConfig.Configuration>()
  private counterfactualWallets = new Map<`0x${string}`, { imageHash: Hex.Hex; context: Context.Context }>()
  private payloads = new Map<`0x${string}`, { content: Payload.Parented; chainId: bigint; wallet: Address.Address }>()
  private signerSubdigests = new Map<string, Set<string>>()
  private signatures = new Map<`0x${string}`, Signature.SignatureOfSignerLeaf>()

  private getSignatureKey(signer: Address.Address, subdigest: Hex.Hex): string {
    return `${signer.toLowerCase()}-${subdigest.toLowerCase()}`
  }

  async loadConfig(imageHash: Hex.Hex): Promise<WalletConfig.Configuration | undefined> {
    return this.configs.get(imageHash.toLowerCase() as `0x${string}`)
  }

  async saveConfig(imageHash: Hex.Hex, config: WalletConfig.Configuration): Promise<void> {
    this.configs.set(imageHash.toLowerCase() as `0x${string}`, config)
  }

  async loadCounterfactualWallet(
    wallet: Address.Address,
  ): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    return this.counterfactualWallets.get(wallet.toLowerCase() as `0x${string}`)
  }

  async saveCounterfactualWallet(wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context): Promise<void> {
    this.counterfactualWallets.set(wallet.toLowerCase() as `0x${string}`, { imageHash, context })
  }

  async loadPayloadOfSubdigest(
    subdigest: Hex.Hex,
  ): Promise<{ content: Payload.Parented; chainId: bigint; wallet: Address.Address } | undefined> {
    return this.payloads.get(subdigest.toLowerCase() as `0x${string}`)
  }

  async savePayloadOfSubdigest(
    subdigest: Hex.Hex,
    payload: { content: Payload.Parented; chainId: bigint; wallet: Address.Address },
  ): Promise<void> {
    this.payloads.set(subdigest.toLowerCase() as `0x${string}`, payload)
  }

  async loadSubdigestsOfSigner(signer: Address.Address): Promise<Hex.Hex[]> {
    const subdigests = this.signerSubdigests.get(signer.toLowerCase() as `0x${string}`)
    return subdigests ? Array.from(subdigests).map((s) => s as Hex.Hex) : []
  }

  async loadSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
  ): Promise<Signature.SignatureOfSignerLeaf | undefined> {
    const key = this.getSignatureKey(signer, subdigest)
    return this.signatures.get(key as `0x${string}`)
  }

  async saveSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    signature: Signature.SignatureOfSignerLeaf,
  ): Promise<void> {
    const key = this.getSignatureKey(signer, subdigest)
    this.signatures.set(key as `0x${string}`, signature)

    // Also track this subdigest for the signer
    const signerKey = signer.toLowerCase()
    const subdigestKey = subdigest.toLowerCase()

    if (!this.signerSubdigests.has(signerKey)) {
      this.signerSubdigests.set(signerKey, new Set())
    }

    this.signerSubdigests.get(signerKey)!.add(subdigestKey)
  }
}
