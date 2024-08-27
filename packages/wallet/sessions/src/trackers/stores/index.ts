import { commons, v1, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'

export type PlainNode = {
  left: string
  right: string
}

export type PlainNested = {
  weight: string
  threshold: string
  tree: string
}

export type PlainV2Config = {
  version: 2
  threshold: string
  checkpoint: string
  tree: string
}

export function isPlainNode(node: any): node is PlainNode {
  return node.left !== undefined && node.right !== undefined
}

export function isPlainNested(node: any): node is PlainNested {
  return node.weight !== undefined && node.threshold !== undefined && node.tree !== undefined
}

export function isPlainV2Config(config: any): config is PlainV2Config {
  return (
    config.version === 2 &&
    config.threshold !== undefined &&
    config.checkpoint !== undefined &&
    config.tree !== undefined &&
    typeof config.tree === 'string'
  )
}

export interface TrackerStore {
  // top level configurations store
  loadConfig: (imageHash: string) => Promise<v1.config.WalletConfig | PlainV2Config | v2.config.WalletConfig | undefined>
  saveConfig: (imageHash: string, config: v1.config.WalletConfig | PlainV2Config | v2.config.WalletConfig) => Promise<void>

  // v2 configurations store
  loadV2Node: (nodeHash: string) => Promise<PlainNode | PlainNested | v2.config.Topology | undefined>
  saveV2Node: (nodeHash: string, node: PlainNode | PlainNested | v2.config.Topology) => Promise<void>

  // counterfactual wallets
  loadCounterfactualWallet: (wallet: string) => Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined>
  saveCounterfactualWallet: (wallet: string, imageHash: string, context: commons.context.WalletContext) => Promise<void>

  // payloads
  loadPayloadOfSubdigest: (subdigest: string) => Promise<commons.signature.SignedPayload | undefined>
  savePayloadOfSubdigest: (subdigest: string, payload: commons.signature.SignedPayload) => Promise<void>

  // signatures
  loadSubdigestsOfSigner: (signer: string) => Promise<string[]>
  loadSignatureOfSubdigest: (signer: string, subdigest: string) => Promise<ethers.BytesLike | undefined>
  saveSignatureOfSubdigest: (signer: string, subdigest: string, payload: ethers.BytesLike) => Promise<void>

  // migrations
  loadMigrationsSubdigest: (
    wallet: string,
    fromVersion: number,
    toVersion: number
  ) => Promise<{ subdigest: string; toImageHash: string }[]>
  saveMigrationsSubdigest: (
    wallet: string,
    fromVersion: number,
    toVersion: number,
    subdigest: string,
    toImageHash: string
  ) => Promise<void>
}

export * from './memoryStore'
export * from './indexedDBStore'
