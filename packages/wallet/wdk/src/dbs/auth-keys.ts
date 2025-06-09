import { Generic, Migration } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'

const TABLE_NAME = 'auth-keys'

export type AuthKey = {
  address: string
  privateKey: CryptoKey
  identitySigner: string
  expiresAt: Date
}

export class AuthKeys extends Generic<AuthKey, 'address'> {
  private expirationTimers = new Map<string, number>()

  constructor(dbName: string = 'sequence-auth-keys') {
    super(dbName, TABLE_NAME, 'address', [
      (
        db: IDBPDatabase<unknown>,
        _tx: IDBPTransaction<unknown, string[], 'versionchange'>,
        _event: IDBVersionChangeEvent,
      ) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          const store = db.createObjectStore(TABLE_NAME)

          store.createIndex('identitySigner', 'identitySigner', { unique: true })
        }
      },
    ])
  }

  async handleOpenDB(): Promise<void> {
    const authKeys = await this.list()
    for (const authKey of authKeys) {
      this.scheduleExpiration(authKey)
    }
  }

  async set(item: AuthKey): Promise<AuthKey['address']> {
    const result = await super.set({
      ...item,
      address: item.address.toLowerCase(),
      identitySigner: item.identitySigner.toLowerCase(),
    })
    this.scheduleExpiration(item)
    return result
  }

  async del(address: AuthKey['address']): Promise<void> {
    const result = await super.del(address.toLowerCase())
    this.clearExpiration(address)
    return result
  }

  async getBySigner(signer: string, attempt: number = 1): Promise<AuthKey | undefined> {
    const normalizedSigner = signer.toLowerCase()
    const store = await this.getStore('readonly')
    const index = store.index('identitySigner')

    // Below code has a workaround where get does not work as expected
    // and we fall back to getAll to find the key by identitySigner.
    try {
      const result = await index.get(normalizedSigner)
      if (result !== undefined) {
        return result
      } else if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return this.getBySigner(signer, attempt + 1)
      } else {
        try {
          const allKeys = await store.getAll()
          if (allKeys && allKeys.length > 0) {
            const foundKey = allKeys.find((key) => key.identitySigner.toLowerCase() === normalizedSigner)
            return foundKey
          }
          return undefined
        } catch (getAllError) {
          console.error(
            `[AuthKeys.getBySigner] Fallback: Error during getAll() for signer ${normalizedSigner}:`,
            getAllError,
          )
          throw getAllError
        }
      }
    } catch (error) {
      console.error(
        `[AuthKeys.getBySigner attempt #${attempt}] Index query error for signer ${normalizedSigner}:`,
        error,
      )

      throw error
    }
  }

  async delBySigner(signer: string): Promise<void> {
    const authKey = await this.getBySigner(signer.toLowerCase())
    if (authKey) {
      await this.del(authKey.address.toLowerCase())
    }
  }

  private async scheduleExpiration(authKey: AuthKey): Promise<void> {
    this.clearExpiration(authKey.address.toLowerCase())

    const now = Date.now()
    const delay = authKey.expiresAt.getTime() - now
    if (delay <= 0) {
      await this.del(authKey.address.toLowerCase())
      return
    }
    const timer = window.setTimeout(() => {
      console.log('removing expired auth key', authKey)
      this.del(authKey.address.toLowerCase())
    }, delay)
    this.expirationTimers.set(authKey.address.toLowerCase(), timer)
  }

  private clearExpiration(address: string): void {
    const timer = this.expirationTimers.get(address.toLowerCase())
    if (timer) {
      window.clearTimeout(timer)
      this.expirationTimers.delete(address.toLowerCase())
    }
  }
}
