import { Attestation } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import type {
  AddImplicitSessionPayload,
  PreferredLoginMethod,
  RequestActionType,
  AddExplicitSessionPayload,
} from '../types/index.js'
import { ChainId } from '@0xsequence/network'
import { jsonReplacers, jsonRevivers } from './index.js'

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

const DB_NAME = 'SequenceDappStorage'
const DB_VERSION = 1
const STORE_NAME = 'userKeys'
const IMPLICIT_SESSIONS_IDB_KEY = 'SequenceImplicitSession'
const EXPLICIT_SESSIONS_IDB_KEY = 'SequenceExplicitSession'

const PENDING_REDIRECT_REQUEST_KEY = 'SequencePendingRedirect'
const TEMP_SESSION_PK_KEY = 'SequencePendingTempSessionPk'
const PENDING_SIGNATURE_REQUEST_CONTEXT_KEY = 'SequencePendingSignatureContext'
const PENDING_REQUEST_PAYLOAD_KEY = 'SequencePendingRequestPayload'

// --- DB Functions ---
const openDB = (): Promise<IDBDatabase> => {
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

const getIDBItem = async <T>(key: IDBValidKey): Promise<T | undefined> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    request.onerror = (event) => reject(`Failed to retrieve item: ${(event.target as IDBRequest).error}`)
    request.onsuccess = (event) => resolve((event.target as IDBRequest).result as T | undefined)
  })
}

const setIDBItem = async (key: IDBValidKey, value: unknown): Promise<void> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
    request.onerror = (event) => reject(`Failed to save item: ${(event.target as IDBRequest).error}`)
    request.onsuccess = () => resolve()
  })
}

const deleteIDBItem = async (key: IDBValidKey): Promise<void> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
    request.onerror = (event) => reject(`Failed to delete item: ${(event.target as IDBRequest).error}`)
    request.onsuccess = () => resolve()
  })
}

// --- Session Storage Functions ---

export const setPendingRedirectRequest = (isPending: boolean): void => {
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

export const isRedirectRequestPending = (): boolean => {
  try {
    return sessionStorage.getItem(PENDING_REDIRECT_REQUEST_KEY) === 'true'
  } catch (error) {
    console.error('Failed to check pending redirect flag:', error)
    return false
  }
}

export const saveTempSessionPk = (pk: Hex.Hex): void => {
  try {
    sessionStorage.setItem(TEMP_SESSION_PK_KEY, pk)
  } catch (error) {
    console.error('Failed to save temp session PK:', error)
  }
}

export const getAndClearTempSessionPk = (): Hex.Hex | null => {
  try {
    const pk = sessionStorage.getItem(TEMP_SESSION_PK_KEY)
    sessionStorage.removeItem(TEMP_SESSION_PK_KEY)
    return pk as Hex.Hex | null
  } catch (error) {
    console.error('Failed to retrieve temp session PK:', error)
    return null
  }
}

export const savePendingRequestPayload = (
  chainId: ChainId,
  payload: AddImplicitSessionPayload | AddExplicitSessionPayload,
): void => {
  try {
    const data: PendingRequestPayload<typeof payload> = { chainId, payload }
    sessionStorage.setItem(PENDING_REQUEST_PAYLOAD_KEY, JSON.stringify(data, jsonReplacers))
  } catch (error) {
    console.error('Failed to save pending request payload:', error)
  }
}

export const getAndClearPendingRequestPayload = (): PendingRequestPayload<
  AddImplicitSessionPayload | AddExplicitSessionPayload
> | null => {
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
// --- END NEW FUNCTIONS ---

export const peekPendingRequestPayload = (): PendingRequestPayload<
  AddImplicitSessionPayload | AddExplicitSessionPayload
> | null => {
  try {
    const payload = sessionStorage.getItem(PENDING_REQUEST_PAYLOAD_KEY)
    if (!payload) return null
    return JSON.parse(payload, jsonRevivers)
  } catch (error) {
    console.error('Failed to peek at pending request payload:', error)
    return null
  }
}

export const saveSignatureRequestContext = (context: SignatureRequestContext): void => {
  try {
    sessionStorage.setItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY, JSON.stringify(context, jsonReplacers))
  } catch (error) {
    console.error('Failed to save signature request context:', error)
  }
}

export const getAndClearSignatureRequestContext = (): SignatureRequestContext | null => {
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

export const peekSignatureRequestContext = (): SignatureRequestContext | null => {
  try {
    const context = sessionStorage.getItem(PENDING_SIGNATURE_REQUEST_CONTEXT_KEY)
    if (!context) return null
    return JSON.parse(context, jsonRevivers)
  } catch (error) {
    console.error('Failed to peek at signature request context:', error)
    return null
  }
}

// --- IndexedDB Session Functions (unchanged) ---

export const saveExplicitSession = async (sessionData: ExplicitSessionData): Promise<void> => {
  try {
    // Filter out any potential duplicates before adding
    const existingSessions = (await getExplicitSessions()).filter(
      (s) =>
        !(
          Address.isEqual(s.walletAddress, sessionData.walletAddress) &&
          s.pk === sessionData.pk &&
          s.chainId === sessionData.chainId
        ),
    )
    await setIDBItem(EXPLICIT_SESSIONS_IDB_KEY, [...existingSessions, sessionData])
  } catch (error) {
    console.error('Failed to save explicit session:', error)
    throw error
  }
}

export const getExplicitSessions = async (): Promise<ExplicitSessionData[]> => {
  try {
    const sessions = await getIDBItem<ExplicitSessionData[]>(EXPLICIT_SESSIONS_IDB_KEY)
    return sessions && Array.isArray(sessions) ? sessions : []
  } catch (error) {
    console.error('Failed to retrieve explicit sessions:', error)
    return []
  }
}

export const clearExplicitSessions = async (): Promise<void> => {
  try {
    await deleteIDBItem(EXPLICIT_SESSIONS_IDB_KEY)
  } catch (error) {
    console.error('Failed to clear explicit sessions:', error)
    throw error
  }
}

export const saveImplicitSession = async (sessionData: ImplicitSessionData): Promise<void> => {
  try {
    await setIDBItem(IMPLICIT_SESSIONS_IDB_KEY, sessionData)
  } catch (error) {
    console.error('Failed to save implicit session:', error)
    throw error
  }
}

export const getImplicitSession = async (): Promise<ImplicitSessionData | null> => {
  try {
    return (await getIDBItem<ImplicitSessionData>(IMPLICIT_SESSIONS_IDB_KEY)) ?? null
  } catch (error) {
    console.error('Failed to retrieve implicit session:', error)
    return null
  }
}

export const clearImplicitSession = async (): Promise<void> => {
  try {
    await deleteIDBItem(IMPLICIT_SESSIONS_IDB_KEY)
  } catch (error) {
    console.error('Failed to clear implicit session:', error)
    throw error
  }
}
