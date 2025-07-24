import { Attestation } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { ChainId } from '@0xsequence/network'
import { jsonReplacers, jsonRevivers } from './index.js'
import {
  AddExplicitSessionPayload,
  AddImplicitSessionPayload,
  PreferredLoginMethod,
  RequestActionType,
} from '../types/index.js'

export interface ExplicitSessionData {
  pk: Hex.Hex
  walletAddress: Address.Address
  chainId: ChainId
  loginMethod?: PreferredLoginMethod
  userEmail?: string
}

export interface ImplicitSessionData {
  pk: Hex.Hex
  walletAddress: Address.Address
  attestation: Attestation.Attestation
  identitySignature: Hex.Hex
  chainId: ChainId
  loginMethod?: PreferredLoginMethod
  userEmail?: string
}

export interface SignatureRequestContext {
  action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
}

export interface PendingRequestPayload<T> {
  chainId: ChainId
  payload: T
}

export interface SequenceStorage {
  setPendingRedirectRequest(isPending: boolean): Promise<void>
  isRedirectRequestPending(): Promise<boolean>

  saveTempSessionPk(pk: Hex.Hex): Promise<void>
  getAndClearTempSessionPk(): Promise<Hex.Hex | null>

  savePendingRequestPayload(
    chainId: ChainId,
    payload: AddImplicitSessionPayload | AddExplicitSessionPayload,
  ): Promise<void>
  getAndClearPendingRequestPayload(): Promise<PendingRequestPayload<
    AddImplicitSessionPayload | AddExplicitSessionPayload
  > | null>
  peekPendingRequestPayload(): Promise<PendingRequestPayload<
    AddImplicitSessionPayload | AddExplicitSessionPayload
  > | null>

  saveSignatureRequestContext(context: SignatureRequestContext): Promise<void>
  getAndClearSignatureRequestContext(): Promise<SignatureRequestContext | null>
  peekSignatureRequestContext(): Promise<SignatureRequestContext | null>

  saveExplicitSession(sessionData: ExplicitSessionData): Promise<void>
  getExplicitSessions(): Promise<ExplicitSessionData[]>
  clearExplicitSessions(): Promise<void>

  saveImplicitSession(sessionData: ImplicitSessionData): Promise<void>
  getImplicitSession(): Promise<ImplicitSessionData | null>
  clearImplicitSession(): Promise<void>

  clearAllData(): Promise<void>
}

const DB_NAME = 'SequenceDappStorage'
const DB_VERSION = 1
const STORE_NAME = 'userKeys'
const IMPLICIT_SESSIONS_IDB_KEY = 'SequenceImplicitSession'
const EXPLICIT_SESSIONS_IDB_KEY = 'SequenceExplicitSession'

const PENDING_REDIRECT_REQUEST_KEY = 'SequencePendingRedirect'
const TEMP_SESSION_PK_KEY = 'SequencePendingTempSessionPk'
const PENDING_SIGNATURE_REQUEST_CONTEXT_KEY = 'SequencePendingSignatureContext'
const PENDING_REQUEST_PAYLOAD_KEY = 'SequencePendingRequestPayload'

export class WebStorage implements SequenceStorage {
  private openDB(): Promise<IDBDatabase> {
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
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
      request.onerror = (event) => reject(`Failed to retrieve item: ${(event.target as IDBRequest).error}`)
      request.onsuccess = (event) => resolve((event.target as IDBRequest).result as T | undefined)
    })
  }

  private async setIDBItem(key: IDBValidKey, value: unknown): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
      request.onerror = (event) => reject(`Failed to save item: ${(event.target as IDBRequest).error}`)
      request.onsuccess = () => resolve()
    })
  }

  private async deleteIDBItem(key: IDBValidKey): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
      request.onerror = (event) => reject(`Failed to delete item: ${(event.target as IDBRequest).error}`)
      request.onsuccess = () => resolve()
    })
  }

  async setPendingRedirectRequest(isPending: boolean): Promise<void> {
    try {
      if (isPending) {
        sessionStorage.setItem(PENDING_REDIRECT_REQUEST_KEY, 'true')
      } else {
        sessionStorage.removeItem(PENDING_REDIRECT_REQUEST_KEY)
      }
    } catch (error) {
      console.error('Failed to set pending redirect flag:', error)
    }
  }

  async isRedirectRequestPending(): Promise<boolean> {
    try {
      return sessionStorage.getItem(PENDING_REDIRECT_REQUEST_KEY) === 'true'
    } catch (error) {
      console.error('Failed to check pending redirect flag:', error)
      return false
    }
  }

  async saveTempSessionPk(pk: Hex.Hex): Promise<void> {
    try {
      sessionStorage.setItem(TEMP_SESSION_PK_KEY, pk)
    } catch (error) {
      console.error('Failed to save temp session PK:', error)
    }
  }

  async getAndClearTempSessionPk(): Promise<Hex.Hex | null> {
    try {
      const pk = sessionStorage.getItem(TEMP_SESSION_PK_KEY)
      sessionStorage.removeItem(TEMP_SESSION_PK_KEY)
      return pk as Hex.Hex | null
    } catch (error) {
      console.error('Failed to retrieve temp session PK:', error)
      return null
    }
  }

  async savePendingRequestPayload(
    chainId: ChainId,
    payload: AddImplicitSessionPayload | AddExplicitSessionPayload,
  ): Promise<void> {
    try {
      const data: PendingRequestPayload<typeof payload> = { chainId, payload }
      sessionStorage.setItem(PENDING_REQUEST_PAYLOAD_KEY, JSON.stringify(data, jsonReplacers))
    } catch (error) {
      console.error('Failed to save pending request payload:', error)
    }
  }

  async getAndClearPendingRequestPayload(): Promise<PendingRequestPayload<
    AddImplicitSessionPayload | AddExplicitSessionPayload
  > | null> {
    try {
      const payload = sessionStorage.getItem(PENDING_REQUEST_PAYLOAD_KEY)
      if (!payload) return null
      sessionStorage.removeItem(PENDING_REQUEST_PAYLOAD_KEY)
      return JSON.parse(payload, jsonRevivers)
    } catch (error) {
      console.error('Failed to retrieve pending request payload:', error)
      return null
    }
  }

  async peekPendingRequestPayload(): Promise<PendingRequestPayload<
    AddImplicitSessionPayload | AddExplicitSessionPayload
  > | null> {
    try {
      const payload = sessionStorage.getItem(PENDING_REQUEST_PAYLOAD_KEY)
      if (!payload) return null
      return JSON.parse(payload, jsonRevivers)
    } catch (error) {
      console.error('Failed to peek at pending request payload:', error)
      return null
    }
  }

  async saveSignatureRequestContext(context: SignatureRequestContext): Promise<void> {
    try {
      sessionStorage.setItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY, JSON.stringify(context, jsonReplacers))
    } catch (error) {
      console.error('Failed to save signature request context:', error)
    }
  }

  async getAndClearSignatureRequestContext(): Promise<SignatureRequestContext | null> {
    try {
      const context = sessionStorage.getItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY)
      if (!context) return null
      sessionStorage.removeItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY)
      return JSON.parse(context, jsonRevivers)
    } catch (error) {
      console.error('Failed to retrieve signature request context:', error)
      return null
    }
  }

  async peekSignatureRequestContext(): Promise<SignatureRequestContext | null> {
    try {
      const context = sessionStorage.getItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY)
      if (!context) return null
      return JSON.parse(context, jsonRevivers)
    } catch (error) {
      console.error('Failed to peek at signature request context:', error)
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

  async clearAllData(): Promise<void> {
    try {
      // Clear all session storage items
      sessionStorage.removeItem(PENDING_REDIRECT_REQUEST_KEY)
      sessionStorage.removeItem(TEMP_SESSION_PK_KEY)
      sessionStorage.removeItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY)
      sessionStorage.removeItem(PENDING_REQUEST_PAYLOAD_KEY)

      // Clear all IndexedDB items
      await this.clearExplicitSessions()
      await this.clearImplicitSession()
    } catch (error) {
      console.error('Failed to clear all data:', error)
      throw error
    }
  }
}
