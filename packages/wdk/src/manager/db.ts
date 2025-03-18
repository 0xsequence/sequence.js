import { Address } from 'ox'

const DB_VERSION = 2
const WALLETS_TABLE = 'wallets'

export interface WalletRow {
  wallet: Address.Address
  status: string
  loginDate: string
  device: Address.Address
  loginType: string
  useGuard: boolean
}

export type WalletUpdateType = 'added' | 'removed' | 'updated'

export type WalletUpdateListener = (
  wallet: Address.Address,
  updateType: WalletUpdateType,
  oldRow?: WalletRow,
  newRow?: WalletRow,
) => void

export class ManagerDb {
  private _db: IDBDatabase | null = null
  private dbName: string
  private listeners: WalletUpdateListener[] = []
  private broadcastChannel?: BroadcastChannel

  constructor(dbName: string = 'sequence-manager') {
    this.dbName = dbName

    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(this.dbName + '-manager')
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type && event.data.wallet) {
          this.listeners.forEach((cb) => cb(event.data.wallet, event.data.type, event.data.oldRow, event.data.newRow))
        }
      }
    }
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this._db) return this._db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(WALLETS_TABLE)) {
          db.createObjectStore(WALLETS_TABLE, { keyPath: 'wallet' })
        }
      }

      request.onsuccess = () => {
        this._db = request.result
        resolve(this._db!)
      }

      request.onerror = () => {
        reject(request.error)
      }

      request.onblocked = () => {
        console.error('db blocked')
      }
    })
  }

  private async getStore(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.openDB()
    const tx = db.transaction(WALLETS_TABLE, mode)
    return tx.objectStore(WALLETS_TABLE)
  }

  private notifyUpdate(
    wallet: Address.Address,
    updateType: WalletUpdateType,
    oldRow?: WalletRow,
    newRow?: WalletRow,
  ): void {
    this.listeners.forEach((cb) => cb(wallet, updateType, oldRow, newRow))
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: updateType,
        wallet,
        oldRow,
        newRow,
      })
    }
  }

  addListener(listener: WalletUpdateListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.removeListener(listener)
    }
  }

  removeListener(listener: WalletUpdateListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  async listWallets(): Promise<WalletRow[]> {
    const store = await this.getStore('readonly')
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        resolve(req.result as WalletRow[])
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getWallet(wallet: Address.Address): Promise<WalletRow | undefined> {
    const store = await this.getStore('readonly')
    return new Promise((resolve, reject) => {
      const req = store.get(wallet.toLowerCase())
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async deleteWallet(wallet: Address.Address): Promise<void> {
    const existing = await this.getWallet(wallet)
    const store = await this.getStore('readwrite')
    return new Promise((resolve, reject) => {
      const req = store.delete(wallet.toLowerCase())
      req.onsuccess = () => {
        resolve()
        if (existing) {
          try {
            this.notifyUpdate(wallet, 'removed', existing, undefined)
          } catch (err) {
            console.error('notifyUpdate failed', err)
          }
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  async saveWallet(row: WalletRow): Promise<void> {
    const old = await this.getWallet(row.wallet)
    const store = await this.getStore('readwrite')
    const normalizedRow = { ...row, wallet: row.wallet.toLowerCase() } as WalletRow

    return new Promise((resolve, reject) => {
      const req = store.put(normalizedRow)

      req.onsuccess = () => {
        resolve()
        let updateType: WalletUpdateType | null = null
        if (!old) {
          updateType = 'added'
        } else if (JSON.stringify(old) !== JSON.stringify(normalizedRow)) {
          updateType = 'updated'
        }
        if (updateType) {
          try {
            this.notifyUpdate(row.wallet, updateType, old, normalizedRow)
          } catch (err) {
            console.error('notifyUpdate failed', err)
          }
        }
      }

      req.onerror = () => reject(req.error)
    })
  }
}
