import { openDB, IDBPDatabase, IDBPTransaction } from 'idb'

export type DbUpdateType = 'added' | 'updated' | 'removed'

export type DbUpdateListener<T, K extends keyof T> = (
  keyValue: T[K],
  updateType: DbUpdateType,
  oldItem?: T,
  newItem?: T,
) => void

export type Migration = (
  db: IDBPDatabase<unknown>,
  transaction: IDBPTransaction<unknown, string[], 'versionchange'>,
  event: IDBVersionChangeEvent,
) => void

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
  private _db: IDBPDatabase<unknown> | null = null
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

  private async openDB(): Promise<IDBPDatabase<unknown>> {
    if (this._db) return this._db

    const targetDbVersion = this.migrations.length + 1

    this._db = await openDB<unknown>(this.dbName, targetDbVersion, {
      upgrade: (db, oldVersion, newVersion, tx, event) => {
        if (newVersion !== null) {
          for (let targetSchemaToBuild = oldVersion + 1; targetSchemaToBuild <= newVersion; targetSchemaToBuild++) {
            const migrationIndex = targetSchemaToBuild - 2

            if (migrationIndex >= 0 && migrationIndex < this.migrations.length) {
              const migrationFunc = this.migrations[migrationIndex]
              if (migrationFunc) {
                migrationFunc(db, tx, event)
              } else {
                throw new Error(
                  `Migration for schema version ${targetSchemaToBuild} (using migrations[${migrationIndex}]) not found but expected.`,
                )
              }
            }
          }
        }
      },
      blocked: () => {
        console.error(`IndexedDB ${this.dbName} upgrade blocked.`)
      },
      blocking: () => {
        console.warn(`IndexedDB ${this.dbName} upgrade is being blocked by other connections. Closing this connection.`)
        if (this._db) {
          this._db.close()
          this._db = null
        }
      },
      terminated: () => {
        console.warn(`IndexedDB ${this.dbName} connection terminated.`)
        this._db = null
      },
    })

    await this.handleOpenDB()
    return this._db
  }

  protected async handleOpenDB(): Promise<void> {}

  protected async getStore(mode: IDBTransactionMode) {
    const db = await this.openDB()
    const tx = db.transaction(this.storeName, mode)
    return tx.objectStore(this.storeName)
  }

  async get(keyValue: T[K]): Promise<T | undefined> {
    const store = await this.getStore('readonly')
    return store.get(keyValue)
  }

  async list(): Promise<T[]> {
    const store = await this.getStore('readonly')
    return store.getAll()
  }

  async set(item: T): Promise<T[K]> {
    const db = await this.openDB()
    const keyValue = item[this.key]

    const tx = db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)

    const oldItem = (await store.get(keyValue)) as T | undefined
    await store.put(item, keyValue)
    await tx.done

    let updateType: DbUpdateType | null = null
    if (!oldItem) {
      updateType = 'added'
    } else if (!deepEqual(oldItem, item)) {
      updateType = 'updated'
    }

    if (updateType) {
      this.notifyUpdate(keyValue, updateType, oldItem, item)
    }
    return keyValue
  }

  async del(keyValue: T[K]): Promise<void> {
    const oldItem = await this.get(keyValue)

    const db = await this.openDB()
    const tx = db.transaction(this.storeName, 'readwrite')
    const store = tx.objectStore(this.storeName)

    await store.delete(keyValue)
    await tx.done

    if (oldItem) {
      this.notifyUpdate(keyValue, 'removed', oldItem, undefined)
    }
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

  public async close(): Promise<void> {
    if (this._db) {
      this._db.close()
      this._db = null
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = undefined
    }
  }
}
