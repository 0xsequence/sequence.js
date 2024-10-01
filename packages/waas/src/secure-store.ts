import { openDB, IDBPDatabase } from 'idb'

export interface SecureStoreBackend {
  get(dbName: string, dbStoreName: string, key: string): Promise<any | null>
  set(dbName: string, dbStoreName: string, key: string, value: any): Promise<boolean>
  delete(dbName: string, dbStoreName: string, key: string): Promise<boolean>
}

export const getDefaultSecureStoreBackend = (): SecureStoreBackend | null => {
  if (isIndexedDbAvailable()) {
    return new IndexedDbSecureStoreBackend()
  } else {
    return null
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB === 'object'
}

export class IndexedDbSecureStoreBackend implements SecureStoreBackend {
  private db: IDBPDatabase | null

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

    this.db = await openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore(dbStoreName)
      }
    })

    return this.db
  }

  async get(dbName: string, dbStoreName: string, key: string): Promise<string | null> {
    const db = await this.openDB(dbName, dbStoreName, 1)
    const tx = db.transaction(dbStoreName, 'readonly')
    const value = await db.get(dbStoreName, key)
    await tx.done
    return value
  }

  async set(dbName: string, dbStoreName: string, key: string, value: any): Promise<boolean> {
    const db = await this.openDB(dbName, dbStoreName, 1)
    const tx = db.transaction(dbStoreName, 'readwrite')
    await db.put(dbStoreName, value, key)
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
