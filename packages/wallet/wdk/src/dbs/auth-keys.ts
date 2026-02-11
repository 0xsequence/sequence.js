import { Generic, Migration } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'
import type { WdkEnv } from '../env.js'

const TABLE_NAME = 'auth-keys'

export type AuthKey = {
  address: string
  privateKey: CryptoKey
  identitySigner: string
  expiresAt: Date
}

export class AuthKeys extends Generic<AuthKey, 'address'> {
  private expirationTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    dbName: string = 'sequence-auth-keys',
    private readonly env?: WdkEnv,
  ) {
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
      await this.scheduleExpiration(authKey)
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
        const setTimeoutFn = this.env?.timers?.setTimeout ?? (globalThis as any).setTimeout
        if (setTimeoutFn) {
          await new Promise((resolve) => setTimeoutFn(resolve, 50))
        }
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
    const setTimeoutFn = this.env?.timers?.setTimeout ?? (globalThis as any).setTimeout
    if (!setTimeoutFn) {
      return
    }
    const timer = setTimeoutFn(() => {
      console.log('removing expired auth key', authKey)
      this.del(authKey.address.toLowerCase())
    }, delay)
    this.expirationTimers.set(authKey.address.toLowerCase(), timer)
  }

  private clearExpiration(address: string): void {
    const timer = this.expirationTimers.get(address.toLowerCase())
    if (timer) {
      const clearTimeoutFn = this.env?.timers?.clearTimeout ?? (globalThis as any).clearTimeout
      if (clearTimeoutFn) {
        clearTimeoutFn(timer)
      }
      this.expirationTimers.delete(address.toLowerCase())
    }
  }
}
