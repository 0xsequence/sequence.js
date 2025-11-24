import { Context, Payload, Signature, Config, GenericTree } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Store } from './index.js'

const DB_VERSION = 1
const STORE_CONFIGS = 'configs'
const STORE_WALLETS = 'counterfactualWallets'
const STORE_PAYLOADS = 'payloads'
const STORE_SIGNER_SUBDIGESTS = 'signerSubdigests'
const STORE_SIGNATURES = 'signatures'
const STORE_SAPIENT_SIGNER_SUBDIGESTS = 'sapientSignerSubdigests'
const STORE_SAPIENT_SIGNATURES = 'sapientSignatures'
const STORE_TREES = 'trees'

export class IndexedDbStore implements Store {
  private _db: IDBDatabase | null = null
  private dbName: string

  constructor(dbName: string = 'sequence-indexeddb') {
    this.dbName = dbName
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this._db) return this._db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_CONFIGS)) {
          db.createObjectStore(STORE_CONFIGS)
        }
        if (!db.objectStoreNames.contains(STORE_WALLETS)) {
          db.createObjectStore(STORE_WALLETS)
        }
        if (!db.objectStoreNames.contains(STORE_PAYLOADS)) {
          db.createObjectStore(STORE_PAYLOADS)
        }
        if (!db.objectStoreNames.contains(STORE_SIGNER_SUBDIGESTS)) {
          db.createObjectStore(STORE_SIGNER_SUBDIGESTS)
        }
        if (!db.objectStoreNames.contains(STORE_SIGNATURES)) {
          db.createObjectStore(STORE_SIGNATURES)
        }
        if (!db.objectStoreNames.contains(STORE_SAPIENT_SIGNER_SUBDIGESTS)) {
          db.createObjectStore(STORE_SAPIENT_SIGNER_SUBDIGESTS)
        }
        if (!db.objectStoreNames.contains(STORE_SAPIENT_SIGNATURES)) {
          db.createObjectStore(STORE_SAPIENT_SIGNATURES)
        }
        if (!db.objectStoreNames.contains(STORE_TREES)) {
          db.createObjectStore(STORE_TREES)
        }
      }

      request.onsuccess = () => {
        this._db = request.result
        resolve(this._db!)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  private async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private async put<T>(storeName: string, key: string, value: T): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  private async getSet(storeName: string, key: string): Promise<Set<string>> {
    const data = (await this.get<Set<string>>(storeName, key)) || new Set<string>()
    return Array.isArray(data) ? new Set(data) : data
  }

  private async putSet(storeName: string, key: string, setData: Set<string>): Promise<void> {
    await this.put(storeName, key, Array.from(setData))
  }

  private getSignatureKey(signer: Address.Address, subdigest: Hex.Hex): string {
    return `${signer.toLowerCase()}-${subdigest.toLowerCase()}`
  }

  private getSapientSignatureKey(signer: Address.Address, subdigest: Hex.Hex, imageHash: Hex.Hex): string {
    return `${signer.toLowerCase()}-${imageHash.toLowerCase()}-${subdigest.toLowerCase()}`
  }

  async loadConfig(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    return this.get<Config.Config>(STORE_CONFIGS, imageHash.toLowerCase())
  }

  async saveConfig(imageHash: Hex.Hex, config: Config.Config): Promise<void> {
    await this.put(STORE_CONFIGS, imageHash.toLowerCase(), config)
  }

  async loadCounterfactualWallet(
    wallet: Address.Address,
  ): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    return this.get(STORE_WALLETS, wallet.toLowerCase())
  }

  async saveCounterfactualWallet(wallet: Address.Address, imageHash: Hex.Hex, context: Context.Context): Promise<void> {
    await this.put(STORE_WALLETS, wallet.toLowerCase(), { imageHash, context })
  }

  async loadPayloadOfSubdigest(
    subdigest: Hex.Hex,
  ): Promise<{ content: Payload.Parented; chainId: number; wallet: Address.Address } | undefined> {
    return this.get(STORE_PAYLOADS, subdigest.toLowerCase())
  }

  async savePayloadOfSubdigest(
    subdigest: Hex.Hex,
    payload: { content: Payload.Parented; chainId: number; wallet: Address.Address },
  ): Promise<void> {
    await this.put(STORE_PAYLOADS, subdigest.toLowerCase(), payload)
  }

  async loadSubdigestsOfSigner(signer: Address.Address): Promise<Hex.Hex[]> {
    const dataSet = await this.getSet(STORE_SIGNER_SUBDIGESTS, signer.toLowerCase())
    return Array.from(dataSet) as Hex.Hex[]
  }

  async loadSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
  ): Promise<Signature.SignatureOfSignerLeaf | undefined> {
    const key = this.getSignatureKey(signer, subdigest)
    return this.get(STORE_SIGNATURES, key.toLowerCase())
  }

  async saveSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    signature: Signature.SignatureOfSignerLeaf,
  ): Promise<void> {
    const key = this.getSignatureKey(signer, subdigest)
    await this.put(STORE_SIGNATURES, key.toLowerCase(), signature)

    const signerKey = signer.toLowerCase()
    const subdigestKey = subdigest.toLowerCase()
    const dataSet = await this.getSet(STORE_SIGNER_SUBDIGESTS, signerKey)
    dataSet.add(subdigestKey)
    await this.putSet(STORE_SIGNER_SUBDIGESTS, signerKey, dataSet)
  }

  async loadSubdigestsOfSapientSigner(signer: Address.Address, imageHash: Hex.Hex): Promise<Hex.Hex[]> {
    const key = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`
    const dataSet = await this.getSet(STORE_SAPIENT_SIGNER_SUBDIGESTS, key)
    return Array.from(dataSet) as Hex.Hex[]
  }

  async loadSapientSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
  ): Promise<Signature.SignatureOfSapientSignerLeaf | undefined> {
    const key = this.getSapientSignatureKey(signer, subdigest, imageHash)
    return this.get(STORE_SAPIENT_SIGNATURES, key.toLowerCase())
  }

  async saveSapientSignatureOfSubdigest(
    signer: Address.Address,
    subdigest: Hex.Hex,
    imageHash: Hex.Hex,
    signature: Signature.SignatureOfSapientSignerLeaf,
  ): Promise<void> {
    const fullKey = this.getSapientSignatureKey(signer, subdigest, imageHash).toLowerCase()
    await this.put(STORE_SAPIENT_SIGNATURES, fullKey, signature)

    const signerKey = `${signer.toLowerCase()}-${imageHash.toLowerCase()}`
    const subdigestKey = subdigest.toLowerCase()
    const dataSet = await this.getSet(STORE_SAPIENT_SIGNER_SUBDIGESTS, signerKey)
    dataSet.add(subdigestKey)
    await this.putSet(STORE_SAPIENT_SIGNER_SUBDIGESTS, signerKey, dataSet)
  }

  async loadTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    return this.get(STORE_TREES, rootHash.toLowerCase())
  }

  async saveTree(rootHash: Hex.Hex, tree: GenericTree.Tree): Promise<void> {
    await this.put(STORE_TREES, rootHash.toLowerCase(), tree)
  }
}
