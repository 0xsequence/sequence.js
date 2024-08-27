import { commons, v1, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'
import { PlainNested, PlainNode, PlainV2Config, TrackerStore } from '.'

export class MemoryTrackerStore implements TrackerStore {
  private configs: { [imageHash: string]: v1.config.WalletConfig | v2.config.WalletConfig | PlainV2Config } = {}
  private v2Nodes: { [nodeHash: string]: PlainNode | PlainNested | v2.config.Topology } = {}
  private counterfactualWallets: { [wallet: string]: { imageHash: string; context: commons.context.WalletContext } } = {}
  private payloads: { [subdigest: string]: commons.signature.SignedPayload } = {}
  private signatures: { [signer: string]: { [subdigest: string]: ethers.BytesLike } } = {}
  private migrations: {
    [wallet: string]: { [fromVersion: number]: { [toVersion: number]: { subdigest: string; toImageHash: string }[] } }
  } = {}

  loadConfig = (imageHash: string): Promise<v1.config.WalletConfig | v2.config.WalletConfig | PlainV2Config | undefined> => {
    return Promise.resolve(this.configs[imageHash])
  }

  saveConfig = (imageHash: string, config: v1.config.WalletConfig | v2.config.WalletConfig | PlainV2Config): Promise<void> => {
    this.configs[imageHash] = config
    return Promise.resolve()
  }

  loadV2Node = (nodeHash: string): Promise<v2.config.Topology | PlainNode | PlainNested | undefined> => {
    return Promise.resolve(this.v2Nodes[nodeHash])
  }

  saveV2Node = (nodeHash: string, node: v2.config.Topology | PlainNode | PlainNested): Promise<void> => {
    this.v2Nodes[nodeHash] = node
    return Promise.resolve()
  }

  loadCounterfactualWallet = (
    wallet: string
  ): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> => {
    return Promise.resolve(this.counterfactualWallets[wallet])
  }

  saveCounterfactualWallet = (wallet: string, imageHash: string, context: commons.context.WalletContext): Promise<void> => {
    this.counterfactualWallets[wallet] = { imageHash, context }
    return Promise.resolve()
  }

  loadPayloadOfSubdigest = (subdigest: string): Promise<commons.signature.SignedPayload | undefined> => {
    return Promise.resolve(this.payloads[subdigest])
  }

  savePayloadOfSubdigest = (subdigest: string, payload: commons.signature.SignedPayload): Promise<void> => {
    this.payloads[subdigest] = payload
    return Promise.resolve()
  }

  loadSubdigestsOfSigner = (signer: string): Promise<string[]> => {
    return Promise.resolve(Object.keys(this.signatures[signer] || {}))
  }

  loadSignatureOfSubdigest = (signer: string, subdigest: string): Promise<ethers.BytesLike | undefined> => {
    return Promise.resolve(this.signatures[signer]?.[subdigest])
  }

  saveSignatureOfSubdigest = (signer: string, subdigest: string, payload: ethers.BytesLike): Promise<void> => {
    if (!this.signatures[signer]) this.signatures[signer] = {}
    this.signatures[signer][subdigest] = payload
    return Promise.resolve()
  }

  loadMigrationsSubdigest = (
    wallet: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{ subdigest: string; toImageHash: string }[]> => {
    return Promise.resolve(this.migrations[wallet]?.[fromVersion]?.[toVersion] || [])
  }

  saveMigrationsSubdigest = (
    wallet: string,
    fromVersion: number,
    toVersion: number,
    subdigest: string,
    toImageHash: string
  ): Promise<void> => {
    if (!this.migrations[wallet]) this.migrations[wallet] = {}
    if (!this.migrations[wallet][fromVersion]) this.migrations[wallet][fromVersion] = {}
    if (!this.migrations[wallet][fromVersion][toVersion]) this.migrations[wallet][fromVersion][toVersion] = []
    this.migrations[wallet][fromVersion][toVersion].push({ subdigest, toImageHash })
    return Promise.resolve()
  }
}
