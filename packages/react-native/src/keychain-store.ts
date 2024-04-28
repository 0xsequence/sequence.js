import { SecureStoreBackend } from '@0xsequence/waas'

import { getGenericPassword, setGenericPassword, resetGenericPassword } from 'react-native-keychain'

export class KeychainSecureStoreBackend implements SecureStoreBackend {
    constructor() {
        // no-op
    }

    async get(dbName: string, dbStoreName: string, key: string): Promise<string | null> {
        const credentials = await getGenericPassword({ service: dbStoreName })
        if (credentials) {
            return credentials.password
        } else {
            return null
        }
    }

    async set(dbName: string, dbStoreName: string, key: string, value: string): Promise<boolean> {
        await setGenericPassword(key, value, { service: dbStoreName })
        return true
    }

    async delete(dbName: string, dbStoreName: string, key: string): Promise<boolean> {
        return resetGenericPassword({ service: dbStoreName })
    }
}
