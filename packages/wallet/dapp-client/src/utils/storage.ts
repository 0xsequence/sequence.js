import { Address, Hex } from 'ox'
import { jsonReplacers, jsonRevivers } from './index.js'
import {
  LoginMethod,
  SignMessagePayload,
  SignTypedDataPayload,
  GuardConfig,
  ETHAuthProof,
  SendWalletTransactionPayload,
  ModifyExplicitSessionPayload,
  CreateNewSessionPayload,
  AddExplicitSessionPayload,
} from '../types/index.js'

import { Attestation } from '../index.js'

const isBrowser = typeof window !== 'undefined'
const hasSessionStorage = isBrowser && typeof sessionStorage !== 'undefined'
const hasIndexedDb = typeof indexedDB !== 'undefined'

export interface ExplicitSessionData {
  pk: Hex.Hex
  walletAddress: Address.Address
  chainId: number
  loginMethod?: LoginMethod
  userEmail?: string
  guard?: GuardConfig
}

export interface ImplicitSessionData {
  pk: Hex.Hex
  walletAddress: Address.Address
  attestation: Attestation.Attestation
  identitySignature: Hex.Hex
  chainId: number
  loginMethod?: LoginMethod
  userEmail?: string
  guard?: GuardConfig
}

export interface SessionlessConnectionData {
  walletAddress: Address.Address
  loginMethod?: LoginMethod
  userEmail?: string
  guard?: GuardConfig
}

export type PendingPayload =
  | CreateNewSessionPayload
  | AddExplicitSessionPayload
  | ModifyExplicitSessionPayload
  | SignMessagePayload
  | SignTypedDataPayload
  | SendWalletTransactionPayload

export interface PendingRequestContext {
  chainId: number
  action: string
  payload: PendingPayload
}

export interface SequenceStorage {
  setPendingRedirectRequest(isPending: boolean): Promise<void>
  isRedirectRequestPending(): Promise<boolean>

  saveTempSessionPk(pk: Hex.Hex): Promise<void>
  getAndClearTempSessionPk(): Promise<Hex.Hex | null>

  savePendingRequest(context: PendingRequestContext): Promise<void>
  getAndClearPendingRequest(): Promise<PendingRequestContext | null>
  peekPendingRequest(): Promise<PendingRequestContext | null>

  saveExplicitSession(sessionData: ExplicitSessionData): Promise<void>
  getExplicitSessions(): Promise<ExplicitSessionData[]>
  clearExplicitSessions(): Promise<void>

  saveImplicitSession(sessionData: ImplicitSessionData): Promise<void>
  getImplicitSession(): Promise<ImplicitSessionData | null>
  clearImplicitSession(): Promise<void>

  saveSessionlessConnection(sessionData: SessionlessConnectionData): Promise<void>
  getSessionlessConnection(): Promise<SessionlessConnectionData | null>
  clearSessionlessConnection(): Promise<void>

  saveEthAuthProof(proof: ETHAuthProof): Promise<void>
  getEthAuthProof(): Promise<ETHAuthProof | null>
  clearEthAuthProof(): Promise<void>

  saveSessionlessConnectionSnapshot?(sessionData: SessionlessConnectionData): Promise<void>
  getSessionlessConnectionSnapshot?(): Promise<SessionlessConnectionData | null>
  clearSessionlessConnectionSnapshot?(): Promise<void>

  clearAllData(): Promise<void>
}

const DB_NAME = 'SequenceDappStorage'
const DB_VERSION = 1
const STORE_NAME = 'userKeys'
const IMPLICIT_SESSIONS_IDB_KEY = 'SequenceImplicitSession'
const EXPLICIT_SESSIONS_IDB_KEY = 'SequenceExplicitSession'
const SESSIONLESS_CONNECTION_IDB_KEY = 'SequenceSessionlessConnection'
const ETH_AUTH_PROOF_IDB_KEY = 'SequenceEthAuthProof'
const SESSIONLESS_CONNECTION_SNAPSHOT_IDB_KEY = 'SequenceSessionlessConnectionSnapshot'

const PENDING_REDIRECT_REQUEST_KEY = 'SequencePendingRedirect'
const TEMP_SESSION_PK_KEY = 'SequencePendingTempSessionPk'
const PENDING_REQUEST_CONTEXT_KEY = 'SequencePendingRequestContext'

export class WebStorage implements SequenceStorage {
  private inMemoryDb = new Map<IDBValidKey, unknown>()

  private openDB(): Promise<IDBDatabase> {
    if (!hasIndexedDb) {
      return Promise.reject(new Error('IndexedDB is not available in this environment.'))
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = (event) => reject(`IndexedDB error: ${(event.target as IDBRequest).error}`)
      request.onsuccess = (event) => resolve((event.target as IDBRequest).result as IDBDatabase)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest).result as IDBDatabase
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })
  }

  private async getIDBItem<T>(key: IDBValidKey): Promise<T | undefined> {
    if (!hasIndexedDb) {
      return this.inMemoryDb.get(key) as T | undefined
    }
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
      request.onerror = (event) => reject(`Failed to retrieve item: ${(event.target as IDBRequest).error}`)
      request.onsuccess = (event) => resolve((event.target as IDBRequest).result as T | undefined)
    })
  }

  private async setIDBItem(key: IDBValidKey, value: unknown): Promise<void> {
    if (!hasIndexedDb) {
      this.inMemoryDb.set(key, value)
      return
    }
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
      request.onerror = (event) => reject(`Failed to save item: ${(event.target as IDBRequest).error}`)
      request.onsuccess = () => resolve()
    })
  }

  private async deleteIDBItem(key: IDBValidKey): Promise<void> {
    if (!hasIndexedDb) {
      this.inMemoryDb.delete(key)
      return
    }
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
      request.onerror = (event) => reject(`Failed to delete item: ${(event.target as IDBRequest).error}`)
      request.onsuccess = () => resolve()
    })
  }

  async setPendingRedirectRequest(isPending: boolean): Promise<void> {
    try {
      if (!hasSessionStorage) return
      if (isPending) sessionStorage.setItem(PENDING_REDIRECT_REQUEST_KEY, 'true')
      else sessionStorage.removeItem(PENDING_REDIRECT_REQUEST_KEY)
    } catch (error) {
      console.error('Failed to set pending redirect flag:', error)
    }
  }

  async isRedirectRequestPending(): Promise<boolean> {
    try {
      if (!hasSessionStorage) return false
      return sessionStorage.getItem(PENDING_REDIRECT_REQUEST_KEY) === 'true'
    } catch (error) {
      console.error('Failed to check pending redirect flag:', error)
      return false
    }
  }

  async saveTempSessionPk(pk: Hex.Hex): Promise<void> {
    try {
      if (!hasSessionStorage) return
      sessionStorage.setItem(TEMP_SESSION_PK_KEY, pk)
    } catch (error) {
      console.error('Failed to save temp session PK:', error)
    }
  }

  async getAndClearTempSessionPk(): Promise<Hex.Hex | null> {
    try {
      if (!hasSessionStorage) return null
      const pk = sessionStorage.getItem(TEMP_SESSION_PK_KEY)
      sessionStorage.removeItem(TEMP_SESSION_PK_KEY)
      return pk as Hex.Hex | null
    } catch (error) {
      console.error('Failed to retrieve temp session PK:', error)
      return null
    }
  }

  async savePendingRequest(context: PendingRequestContext): Promise<void> {
    try {
      if (!hasSessionStorage) return
      sessionStorage.setItem(PENDING_REQUEST_CONTEXT_KEY, JSON.stringify(context, jsonReplacers))
    } catch (error) {
      console.error('Failed to save pending request context:', error)
    }
  }

  async getAndClearPendingRequest(): Promise<PendingRequestContext | null> {
    try {
      if (!hasSessionStorage) return null
      const context = sessionStorage.getItem(PENDING_REQUEST_CONTEXT_KEY)
      if (!context) return null
      sessionStorage.removeItem(PENDING_REQUEST_CONTEXT_KEY)
      return JSON.parse(context, jsonRevivers)
    } catch (error) {
      console.error('Failed to retrieve pending request context:', error)
      return null
    }
  }

  async peekPendingRequest(): Promise<PendingRequestContext | null> {
    try {
      if (!hasSessionStorage) return null
      const context = sessionStorage.getItem(PENDING_REQUEST_CONTEXT_KEY)
      if (!context) return null
      return JSON.parse(context, jsonRevivers)
    } catch (error) {
      console.error('Failed to peek at pending request context:', error)
      return null
    }
  }

  async saveExplicitSession(sessionData: ExplicitSessionData): Promise<void> {
    try {
      const existingSessions = (await this.getExplicitSessions()).filter(
        (s) =>
          !(
            Address.isEqual(s.walletAddress, sessionData.walletAddress) &&
            s.pk === sessionData.pk &&
            s.chainId === sessionData.chainId
          ),
      )
      await this.setIDBItem(EXPLICIT_SESSIONS_IDB_KEY, [...existingSessions, sessionData])
    } catch (error) {
      console.error('Failed to save explicit session:', error)
      throw error
    }
  }

  async getExplicitSessions(): Promise<ExplicitSessionData[]> {
    try {
      const sessions = await this.getIDBItem<ExplicitSessionData[]>(EXPLICIT_SESSIONS_IDB_KEY)
      return sessions && Array.isArray(sessions) ? sessions : []
    } catch (error) {
      console.error('Failed to retrieve explicit sessions:', error)
      return []
    }
  }

  async clearExplicitSessions(): Promise<void> {
    try {
      await this.deleteIDBItem(EXPLICIT_SESSIONS_IDB_KEY)
    } catch (error) {
      console.error('Failed to clear explicit sessions:', error)
      throw error
    }
  }

  async saveImplicitSession(sessionData: ImplicitSessionData): Promise<void> {
    try {
      await this.setIDBItem(IMPLICIT_SESSIONS_IDB_KEY, sessionData)
    } catch (error) {
      console.error('Failed to save implicit session:', error)
      throw error
    }
  }

  async getImplicitSession(): Promise<ImplicitSessionData | null> {
    try {
      return (await this.getIDBItem<ImplicitSessionData>(IMPLICIT_SESSIONS_IDB_KEY)) ?? null
    } catch (error) {
      console.error('Failed to retrieve implicit session:', error)
      return null
    }
  }

  async clearImplicitSession(): Promise<void> {
    try {
      await this.deleteIDBItem(IMPLICIT_SESSIONS_IDB_KEY)
    } catch (error) {
      console.error('Failed to clear implicit session:', error)
      throw error
    }
  }

  async saveSessionlessConnection(sessionData: SessionlessConnectionData): Promise<void> {
    try {
      await this.setIDBItem(SESSIONLESS_CONNECTION_IDB_KEY, sessionData)
    } catch (error) {
      console.error('Failed to save sessionless connection:', error)
      throw error
    }
  }

  async saveEthAuthProof(proof: ETHAuthProof): Promise<void> {
    try {
      await this.setIDBItem(ETH_AUTH_PROOF_IDB_KEY, proof)
    } catch (error) {
      console.error('Failed to save ETHAuth proof:', error)
      throw error
    }
  }

  async getSessionlessConnection(): Promise<SessionlessConnectionData | null> {
    try {
      return (await this.getIDBItem<SessionlessConnectionData>(SESSIONLESS_CONNECTION_IDB_KEY)) ?? null
    } catch (error) {
      console.error('Failed to retrieve sessionless connection:', error)
      return null
    }
  }

  async getEthAuthProof(): Promise<ETHAuthProof | null> {
    try {
      return (await this.getIDBItem<ETHAuthProof>(ETH_AUTH_PROOF_IDB_KEY)) ?? null
    } catch (error) {
      console.error('Failed to retrieve ETHAuth proof:', error)
      return null
    }
  }

  async clearSessionlessConnection(): Promise<void> {
    try {
      await this.deleteIDBItem(SESSIONLESS_CONNECTION_IDB_KEY)
    } catch (error) {
      console.error('Failed to clear sessionless connection:', error)
      throw error
    }
  }

  async clearEthAuthProof(): Promise<void> {
    try {
      await this.deleteIDBItem(ETH_AUTH_PROOF_IDB_KEY)
    } catch (error) {
      console.error('Failed to clear ETHAuth proof:', error)
      throw error
    }
  }

  async saveSessionlessConnectionSnapshot(sessionData: SessionlessConnectionData): Promise<void> {
    try {
      await this.setIDBItem(SESSIONLESS_CONNECTION_SNAPSHOT_IDB_KEY, sessionData)
    } catch (error) {
      console.error('Failed to save sessionless connection snapshot:', error)
      throw error
    }
  }

  async getSessionlessConnectionSnapshot(): Promise<SessionlessConnectionData | null> {
    try {
      return (await this.getIDBItem<SessionlessConnectionData>(SESSIONLESS_CONNECTION_SNAPSHOT_IDB_KEY)) ?? null
    } catch (error) {
      console.error('Failed to retrieve sessionless connection snapshot:', error)
      return null
    }
  }

  async clearSessionlessConnectionSnapshot(): Promise<void> {
    try {
      await this.deleteIDBItem(SESSIONLESS_CONNECTION_SNAPSHOT_IDB_KEY)
    } catch (error) {
      console.error('Failed to clear sessionless connection snapshot:', error)
      throw error
    }
  }

  async clearAllData(): Promise<void> {
    try {
      // Clear all session storage items
      if (hasSessionStorage) {
        sessionStorage.removeItem(PENDING_REDIRECT_REQUEST_KEY)
        sessionStorage.removeItem(TEMP_SESSION_PK_KEY)
        sessionStorage.removeItem(PENDING_REQUEST_CONTEXT_KEY)
      }

      // Clear all IndexedDB items
      await this.clearExplicitSessions()
      await this.clearImplicitSession()
      await this.clearSessionlessConnection()
      await this.clearEthAuthProof()
      await this.clearSessionlessConnectionSnapshot()
    } catch (error) {
      console.error('Failed to clear all data:', error)
      throw error
    }
  }
}
