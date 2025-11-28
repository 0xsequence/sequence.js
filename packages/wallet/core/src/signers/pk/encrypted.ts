import { Hex, Address, PublicKey, Secp256k1, Bytes } from 'ox'
import { PkStore } from './index.js'

export interface EncryptedData {
  iv: BufferSource
  data: BufferSource
  keyPointer: string
  address: Address.Address
  publicKey: PublicKey.PublicKey
}

export class EncryptedPksDb {
  private tableName: string
  private dbName: string = 'pk-db'
  private dbVersion: number = 1

  constructor(
    private readonly localStorageKeyPrefix: string = 'e_pk_key_',
    tableName: string = 'e_pk',
  ) {
    this.tableName = tableName
  }

  private computeDbKey(address: Address.Address): string {
    return `pk_${address.toLowerCase()}`
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.tableName)) {
          db.createObjectStore(this.tableName)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async putData(key: string, value: any): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, 'readwrite')
      const store = tx.objectStore(this.tableName)
      const request = store.put(value, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async getData<T>(key: string): Promise<T | undefined> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, 'readonly')
      const store = tx.objectStore(this.tableName)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async getAllData<T>(): Promise<T[]> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, 'readonly')
      const store = tx.objectStore(this.tableName)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async generateAndStore(): Promise<EncryptedData> {
    const encryptionKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ])

    const privateKey = Hex.random(32)

    const publicKey = Secp256k1.getPublicKey({ privateKey })
    const address = Address.fromPublicKey(publicKey)
    const keyPointer = this.localStorageKeyPrefix + address

    const exportedKey = await window.crypto.subtle.exportKey('jwk', encryptionKey)
    window.localStorage.setItem(keyPointer, JSON.stringify(exportedKey))

    const encoder = new TextEncoder()
    const encodedPk = encoder.encode(privateKey)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encryptedBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, encodedPk)

    const encrypted: EncryptedData = {
      iv,
      data: encryptedBuffer,
      keyPointer,
      address,
      publicKey,
    }

    const dbKey = this.computeDbKey(address)
    await this.putData(dbKey, encrypted)
    return encrypted
  }

  async getEncryptedEntry(address: Address.Address): Promise<EncryptedData | undefined> {
    const dbKey = this.computeDbKey(address)
    return this.getData<EncryptedData>(dbKey)
  }

  async getEncryptedPkStore(address: Address.Address): Promise<EncryptedPkStore | undefined> {
    const entry = await this.getEncryptedEntry(address)
    if (!entry) return
    return new EncryptedPkStore(entry)
  }

  async listAddresses(): Promise<Address.Address[]> {
    const allEntries = await this.getAllData<EncryptedData>()
    return allEntries.map((entry) => entry.address)
  }

  async remove(address: Address.Address) {
    const dbKey = this.computeDbKey(address)
    await this.putData(dbKey, undefined)
    const keyPointer = this.localStorageKeyPrefix + address
    window.localStorage.removeItem(keyPointer)
  }
}

export class EncryptedPkStore implements PkStore {
  constructor(private readonly encrypted: EncryptedData) {}

  address(): Address.Address {
    return this.encrypted.address
  }

  publicKey(): PublicKey.PublicKey {
    return this.encrypted.publicKey
  }

  async signDigest(digest: Bytes.Bytes): Promise<{ r: bigint; s: bigint; yParity: number }> {
    const keyJson = window.localStorage.getItem(this.encrypted.keyPointer)
    if (!keyJson) throw new Error('Encryption key not found in localStorage')
    const jwk = JSON.parse(keyJson)
    const encryptionKey = await window.crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['decrypt'])
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.encrypted.iv },
      encryptionKey,
      this.encrypted.data,
    )
    const decoder = new TextDecoder()
    const privateKey = decoder.decode(decryptedBuffer) as Hex.Hex
    return Secp256k1.sign({ payload: digest, privateKey })
  }
}
