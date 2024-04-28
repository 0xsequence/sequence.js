import { openDB } from 'idb'
import * as Keychain from 'react-native-keychain'

export interface SecureStoreBackend {
    get(dbName: string, dbStoreName: string, key: string): Promise<string | null>
    set(dbName: string, dbStoreName: string, key: string, value: string): Promise<boolean>
    delete(dbName: string, dbStoreName: string, key: string): Promise<boolean>
}

export const getDefaultSecureStoreBackend = (): SecureStoreBackend | null => {
    if (isIndexedDbAvailable()) {
        return new IndexedDbSecureStoreBackend()
    } else if (isKeychainAvailable()) {
        return new KeychainSecureStoreBackend()
    } else {
        return null
    }
}

export function isIndexedDbAvailable(): boolean {
    return typeof window === 'object' && typeof window.indexedDB === 'object'
}

export function isKeychainAvailable(): boolean {
    return typeof Keychain === 'object'
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

export class KeychainSecureStoreBackend implements SecureStoreBackend {
    constructor() {
        if (!isKeychainAvailable()) {
            throw new Error('Keychain is not available')
        }
    }

    async get(dbName: string, dbStoreName: string, key: string): Promise<string | null> {
        const credentials = await Keychain.getGenericPassword({ service: dbStoreName })
        if (credentials) {
            return credentials.password
        } else {
            return null
        }
    }

    async set(dbName: string, dbStoreName: string, key: string, value: string): Promise<boolean> {
        await Keychain.setGenericPassword(key, value, { service: dbStoreName })
        return true
    }

    async delete(dbName: string, dbStoreName: string, key: string): Promise<boolean> {
        return Keychain.resetGenericPassword({ service: dbStoreName })
    }
}
