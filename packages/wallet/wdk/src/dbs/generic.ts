export type DbUpdateType = 'added' | 'updated' | 'removed'

export type DbUpdateListener<T, K extends keyof T> = (
  keyValue: T[K],
  updateType: DbUpdateType,
  oldItem?: T,
  newItem?: T,
) => void

export type Migration = (db: IDBDatabase, transaction: IDBTransaction, event: IDBVersionChangeEvent) => void

function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true
  }

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }

  return true
}

export class Generic<T extends { [P in K]: IDBValidKey }, K extends keyof T> {
  private _db: IDBDatabase | null = null
  private listeners: DbUpdateListener<T, K>[] = []
  private broadcastChannel?: BroadcastChannel

  /**
   * @param dbName The name of the IndexedDB database.
   * @param storeName The name of the object store.
   * @param key The property key in T to be used as the primary key.
   * @param migrations An array of migration functions; the database version is migrations.length + 1.
   */
  constructor(
    private dbName: string,
    private storeName: string,
    private key: K,
    private migrations: Migration[] = [],
  ) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(this.dbName + '-observer')
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.keyValue !== undefined && event.data.updateType) {
          this.listeners.forEach((cb) =>
            cb(event.data.keyValue, event.data.updateType, event.data.oldItem, event.data.newItem),
          )
        }
      }
    }
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this._db) return this._db

    return new Promise((resolve, reject) => {
      const version = this.migrations.length + 1
      const request = indexedDB.open(this.dbName, version)

      request.onupgradeneeded = (event) => {
        const db = request.result
        const tx = request.transaction!
        const oldVersion = (event.oldVersion as number) || 0
        for (let i = oldVersion; i < this.migrations.length; i++) {
          const migration = this.migrations[i]
          if (!migration) throw new Error(`Migration ${i} not found`)
          migration(db, tx, event)
        }
      }

      request.onsuccess = () => {
        this._db = request.result
        this.handleOpenDB().then(() => resolve(this._db!))
      }

      request.onerror = () => reject(request.error)
      request.onblocked = () => console.error('Database upgrade blocked')
    })
  }

  protected async handleOpenDB(): Promise<void> {}

  protected async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB()
    const tx = db.transaction(this.storeName, mode)
    return tx.objectStore(this.storeName)
  }

  async get(keyValue: T[K]): Promise<T | undefined> {
    const store = await this.getStore('readonly')
    return new Promise((resolve, reject) => {
      const req = store.get(keyValue)
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  }

  async list(): Promise<T[]> {
    const store = await this.getStore('readonly')
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as T[])
      req.onerror = () => reject(req.error)
    })
  }

  async set(item: T): Promise<T[K]> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const keyValue = item[this.key]

      const getReq = store.get(keyValue)
      getReq.onsuccess = () => {
        const oldItem = getReq.result
        const putReq = store.put(item, keyValue)
        putReq.onsuccess = () => {
          let updateType: DbUpdateType | null = null
          if (!oldItem) {
            updateType = 'added'
          } else if (!deepEqual(oldItem, item)) {
            updateType = 'updated'
          }
          if (updateType) {
            try {
              this.notifyUpdate(keyValue, updateType, oldItem, item)
            } catch (err) {
              console.error('notifyUpdate failed', err)
            }
          }
          resolve(keyValue)
        }
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  }

  async del(keyValue: T[K]): Promise<void> {
    const oldItem = await this.get(keyValue)
    const store = await this.getStore('readwrite')
    return new Promise((resolve, reject) => {
      const req = store.delete(keyValue)
      req.onsuccess = () => {
        if (oldItem) {
          try {
            this.notifyUpdate(keyValue, 'removed', oldItem, undefined)
          } catch (err) {
            console.error('notifyUpdate failed', err)
          }
        }
        resolve()
      }
      req.onerror = () => reject(req.error)
    })
  }

  private notifyUpdate(keyValue: T[K], updateType: DbUpdateType, oldItem?: T, newItem?: T): void {
    this.listeners.forEach((listener) => listener(keyValue, updateType, oldItem, newItem))
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ keyValue, updateType, oldItem, newItem })
    }
  }

  addListener(listener: DbUpdateListener<T, K>): () => void {
    this.listeners.push(listener)
    return () => this.removeListener(listener)
  }

  removeListener(listener: DbUpdateListener<T, K>): void {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }
}
