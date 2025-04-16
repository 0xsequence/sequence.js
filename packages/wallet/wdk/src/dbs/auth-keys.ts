import { Generic } from './generic'

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
      (db: IDBDatabase) => {
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
    const result = await super.set(item)
    this.scheduleExpiration(item)
    return result
  }

  async del(address: AuthKey['address']): Promise<void> {
    const result = await super.del(address)
    this.clearExpiration(address)
    return result
  }

  async getBySigner(signer: string): Promise<AuthKey | undefined> {
    const store = await this.getStore('readonly')
    const index = store.index('identitySigner')
    return new Promise((resolve, reject) => {
      const req = index.get(signer)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async delBySigner(signer: string): Promise<void> {
    const authKey = await this.getBySigner(signer)
    if (authKey) {
      await this.del(authKey.address)
    }
  }

  private async scheduleExpiration(authKey: AuthKey): Promise<void> {
    this.clearExpiration(authKey.address)

    const now = Date.now()
    const delay = authKey.expiresAt.getTime() - now
    if (delay <= 0) {
      await this.del(authKey.address)
      return
    }
    const timer = window.setTimeout(() => {
      console.log('removing expired auth key', authKey)
      this.del(authKey.address)
    }, delay)
    this.expirationTimers.set(authKey.address, timer)
  }

  private clearExpiration(address: string): void {
    const timer = this.expirationTimers.get(address)
    if (timer) {
      window.clearTimeout(timer)
      this.expirationTimers.delete(address)
    }
  }
}
