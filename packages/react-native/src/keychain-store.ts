import { SecureStoreBackend } from '@0xsequence/waas'

import * as Keychain from 'react-native-keychain'

export class KeychainSecureStoreBackend implements SecureStoreBackend {
    constructor() {
        if (typeof Keychain !== 'object') {
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
