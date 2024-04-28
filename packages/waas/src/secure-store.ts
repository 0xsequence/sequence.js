import { openDB } from 'idb'

export interface SecureStoreBackend {
    get(dbName: string, dbStoreName: string, key: string): Promise<string | null>
    set(dbName: string, dbStoreName: string, key: string, value: string): Promise<boolean>
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
    return typeof window === 'object' && typeof window.indexedDB === 'object'
}

export class IndexedDbSecureStoreBackend implements SecureStoreBackend {
    constructor() {
        if (!isIndexedDbAvailable()) {
            throw new Error('IndexedDB is not available')
        }
    }

    async get(dbName: string, dbStoreName: string, key: string): Promise<string | null> {
        const db = await openDB(dbName)
        const tx = db.transaction(dbStoreName, 'readonly')
        const value = await db.get(dbStoreName, key)
        await tx.done
        db.close()
        return value
    }

    async set(dbName: string, dbStoreName: string, key: string, value: string): Promise<boolean> {
        const db = await openDB(dbName, 1, {
            upgrade(db) {
                db.createObjectStore(dbStoreName)
            }
        })

        const tx = db.transaction(dbStoreName, 'readwrite')
        await db.put(dbName, value, key)
        await tx.done
        db.close()
        return true
    }

    async delete(dbName: string, dbStoreName: string, key: string): Promise<boolean> {
        const db = await openDB(dbName)
        const tx = db.transaction(dbStoreName, 'readwrite')
        await db.delete(dbStoreName, key)
        await tx.done
        db.close()
        return true
    }
}
