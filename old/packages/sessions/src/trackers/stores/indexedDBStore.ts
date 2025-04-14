import { commons, v1, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'
import { PlainNested, PlainNode, PlainV2Config, TrackerStore } from '.'

import { DBSchema, IDBPDatabase, openDB } from 'idb'

export interface LocalTrackerDBSchema extends DBSchema {
  configs: {
    key: string
    value: v1.config.WalletConfig | v2.config.WalletConfig | PlainV2Config
  }
  v2Nodes: {
    key: string
    value: v2.config.Topology | PlainNode | PlainNested
  }
  counterfactualWallets: {
    key: string
    value: {
      imageHash: string
      context: commons.context.WalletContext
    }
  }
  payloads: {
    key: string
    value: commons.signature.SignedPayload
  }
  signatures: {
    key: string // `${signer}-${subdigest}`
    value: {
      signature: ethers.BytesLike
      signer: string
    }
    indexes: {
      signer: string
    }
  }
  migrations: {
    key: string
    value: {
      wallet: string
      fromVersion: number
      toVersion: number
      subdigest: string
      toImageHash: string
    }
    indexes: {
      jump: string // '${wallet}-${fromVersion}-${toVersion}
    }
  }
}

export function recreateBigNumbers<T extends object | undefined>(object: T): T | undefined {
  if (object === undefined) return undefined

  const result = {} as any

  for (const key of Object.keys(object)) {
    const val = (object as any)[key as string]

    if (val._isBigNumber === true && val._hex !== undefined && typeof val._hex === 'string' && val._hex.length !== '') {
      // Entry is a big number
      result[key] = BigInt(val._hex)
    } else if (Array.isArray(val)) {
      // Entry is an array, recurse
      result[key] = val.map(v => recreateBigNumbers(v))
    } else if (typeof val === 'object' && val !== null) {
      // Entry is another object, recurse
      result[key] = recreateBigNumbers(val)
    } else {
      // Entry is a primitive, just copy
      result[key] = val
    }
  }

  return result
}

export class IndexedDBStore implements TrackerStore {
  private _lazyDb: IDBPDatabase<LocalTrackerDBSchema> | undefined

  constructor(public dbName: string) {}

  async getDb() {
    if (this._lazyDb) return this._lazyDb

    const dbName = this.dbName
    this._lazyDb = await openDB<LocalTrackerDBSchema>(dbName, 1, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`upgrading ${dbName} from ${oldVersion} to ${newVersion} - ${transaction}`)
        if (oldVersion === 0) {
          db.createObjectStore('configs')
          db.createObjectStore('v2Nodes')
          db.createObjectStore('counterfactualWallets')
          db.createObjectStore('payloads')

          const signatures = db.createObjectStore('signatures')
          signatures.createIndex('signer', 'signer', { unique: false })

          const migrations = db.createObjectStore('migrations')
          migrations.createIndex('jump', ['wallet', 'fromVersion', 'toVersion'])
        }
      }
    })
    return this._lazyDb
  }

  loadConfig = async (
    imageHash: string
  ): Promise<v1.config.WalletConfig | v2.config.WalletConfig | PlainV2Config | undefined> => {
    const db = await this.getDb()
    return db.get('configs', imageHash).then(c => recreateBigNumbers(c))
  }

  saveConfig = async (
    imageHash: string,
    config: v1.config.WalletConfig | v2.config.WalletConfig | PlainV2Config
  ): Promise<void> => {
    const db = await this.getDb()
    await db.put('configs', config, imageHash)
  }

  loadV2Node = async (nodeHash: string): Promise<v2.config.Topology | PlainNode | PlainNested | undefined> => {
    const db = await this.getDb()
    return db.get('v2Nodes', nodeHash).then(c => recreateBigNumbers(c))
  }

  saveV2Node = async (nodeHash: string, node: v2.config.Topology | PlainNode | PlainNested): Promise<void> => {
    const db = await this.getDb()
    await db.put('v2Nodes', node, nodeHash)
  }

  loadCounterfactualWallet = async (
    wallet: string
  ): Promise<{ imageHash: string; context: commons.context.WalletContext } | undefined> => {
    const db = await this.getDb()
    return db.get('counterfactualWallets', wallet)
  }

  saveCounterfactualWallet = async (wallet: string, imageHash: string, context: commons.context.WalletContext): Promise<void> => {
    const db = await this.getDb()
    await db.put('counterfactualWallets', { imageHash, context }, wallet)
  }

  loadPayloadOfSubdigest = async (subdigest: string): Promise<commons.signature.SignedPayload | undefined> => {
    const db = await this.getDb()
    return db.get('payloads', subdigest).then(c => recreateBigNumbers(c))
  }

  savePayloadOfSubdigest = async (subdigest: string, payload: commons.signature.SignedPayload): Promise<void> => {
    const db = await this.getDb()
    await db.put('payloads', payload, subdigest)
  }

  loadSubdigestsOfSigner = async (signer: string): Promise<string[]> => {
    const db = await this.getDb()
    const index = await db.getAllKeysFromIndex('signatures', 'signer', IDBKeyRange.only(signer))
    return index.map(key => key.split('-')[0])
  }

  loadSignatureOfSubdigest = async (signer: string, subdigest: string): Promise<ethers.BytesLike | undefined> => {
    const db = await this.getDb()
    const signature = await db.get('signatures', [subdigest, signer].join('-'))
    return signature?.signature
  }

  saveSignatureOfSubdigest = async (signer: string, subdigest: string, payload: ethers.BytesLike): Promise<void> => {
    const db = await this.getDb()
    await db.put('signatures', { signature: payload, signer }, [subdigest, signer].join('-'))
  }

  loadMigrationsSubdigest = async (
    wallet: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{ subdigest: string; toImageHash: string }[]> => {
    const db = await this.getDb()
    const index = await db.getAllFromIndex('migrations', 'jump', IDBKeyRange.only([wallet, fromVersion, toVersion]))
    return index.map(key => ({ subdigest: key.subdigest, toImageHash: key.toImageHash }))
  }

  saveMigrationsSubdigest = async (
    wallet: string,
    fromVersion: number,
    toVersion: number,
    subdigest: string,
    toImageHash: string
  ): Promise<void> => {
    const db = await this.getDb()
    await db.put('migrations', { wallet, fromVersion, toVersion, subdigest, toImageHash }, subdigest)
  }
}
