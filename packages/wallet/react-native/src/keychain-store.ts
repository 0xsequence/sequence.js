import { SecureStoreBackend } from '@0xsequence/waas'

import { getGenericPassword, setGenericPassword, resetGenericPassword } from 'react-native-keychain'

export class KeychainSecureStoreBackend implements SecureStoreBackend {
  constructor() {
    // no-op
  }

  async get(dbName: string, dbStoreName: string, key: string): Promise<any | null> {
    const credentials = await getGenericPassword({ service: dbStoreName })
    if (credentials) {
      return credentials.password
    } else {
      return null
    }
  }

  async set(dbName: string, dbStoreName: string, key: string, value: any): Promise<boolean> {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string')
    }
    await setGenericPassword(key, value, { service: dbStoreName })
    return true
  }

  async delete(dbName: string, dbStoreName: string, key: string): Promise<boolean> {
    return resetGenericPassword({ service: dbStoreName })
  }
}
