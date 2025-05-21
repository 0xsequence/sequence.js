'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.LocalStorageSecureStoreBackend = exports.getDefaultSecureStoreBackend = void 0
exports.isIndexedDbAvailable = isIndexedDbAvailable
const getDefaultSecureStoreBackend = () => {
  return new LocalStorageSecureStoreBackend()
}
exports.getDefaultSecureStoreBackend = getDefaultSecureStoreBackend
function isIndexedDbAvailable() {
  return typeof indexedDB === 'object'
}
class LocalStorageSecureStoreBackend {
  storage
  constructor() {
    this.storage = localStorage
  }
  async get(dbName, dbStoreName, key) {
    const value = this.storage.getItem(`${dbName}-${dbStoreName}-${key}`)
    if (!value) {
      return null
    }
    const { value: storedValue, validUntil } = JSON.parse(value)
    if (validUntil && validUntil < new Date()) {
      await this.delete(dbName, dbStoreName, key)
      return null
    }
    return storedValue
  }
  async set(dbName, dbStoreName, key, value, validUntil) {
    this.storage.setItem(`${dbName}-${dbStoreName}-${key}`, JSON.stringify({ value, validUntil }))
    return true
  }
  async delete(dbName, dbStoreName, key) {
    this.storage.removeItem(`${dbName}-${dbStoreName}-${key}`)
    return true
  }
}
exports.LocalStorageSecureStoreBackend = LocalStorageSecureStoreBackend
/*
export class IndexedDbSecureStoreBackend implements SecureStoreBackend {
  private db: IDBPDatabase | null
  private idb: typeof import('idb') | null = null

  constructor() {
    if (!isIndexedDbAvailable()) {
      throw new Error('IndexedDB is not available')
    }
    this.db = null
  }

  private async openDB(dbName: string, dbStoreName: string, version: number): Promise<IDBPDatabase> {
    if (this.db) {
      return this.db
    }

    if (!this.idb) {
      this.idb = await import('idb')
    }

    this.db = await this.idb.openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore(dbStoreName)
      }
    })

    return this.db
  }

  async get(dbName: string, dbStoreName: string, key: string): Promise<string | null> {
    const db = await this.openDB(dbName, dbStoreName, 1)
    const tx = db.transaction(dbStoreName, 'readonly')
    const { value, validUntil } = await db.get(dbStoreName, key)
    await tx.done
    if (validUntil && validUntil < new Date()) {
      await this.delete(dbName, dbStoreName, key)
      return null
    }
    return value
  }

  async set(dbName: string, dbStoreName: string, key: string, value: any, validUntil: Date): Promise<boolean> {
    const db = await this.openDB(dbName, dbStoreName, 1)
    const tx = db.transaction(dbStoreName, 'readwrite')
    await db.put(dbStoreName, { value, validUntil }, key)
    await tx.done
    return true
  }

  async delete(dbName: string, dbStoreName: string, key: string): Promise<boolean> {
    const db = await this.openDB(dbName, dbStoreName, 1)
    const tx = db.transaction(dbStoreName, 'readwrite')
    await db.delete(dbStoreName, key)
    await tx.done
    return true
  }
}
*/
