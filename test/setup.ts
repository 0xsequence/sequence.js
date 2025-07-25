import {
  indexedDB,
  IDBFactory,
  IDBKeyRange,
  IDBDatabase,
  IDBObjectStore,
  IDBIndex,
  IDBCursor,
  IDBCursorWithValue,
  IDBTransaction,
  IDBRequest,
  IDBOpenDBRequest,
  IDBVersionChangeEvent,
} from 'fake-indexeddb'
import { Provider, RpcTransport } from 'ox'
import { vi } from 'vitest'
import { LOCAL_RPC_URL } from './constants'

// Add IndexedDB support to the test environment using fake-indexeddb
global.indexedDB = indexedDB
global.IDBFactory = IDBFactory as unknown as typeof global.IDBFactory
global.IDBKeyRange = IDBKeyRange as unknown as typeof global.IDBKeyRange
global.IDBDatabase = IDBDatabase as unknown as typeof global.IDBDatabase
global.IDBObjectStore = IDBObjectStore as unknown as typeof global.IDBObjectStore
global.IDBIndex = IDBIndex as unknown as typeof global.IDBIndex
global.IDBCursor = IDBCursor as unknown as typeof global.IDBCursor
global.IDBCursorWithValue = IDBCursorWithValue as unknown as typeof global.IDBCursorWithValue
global.IDBTransaction = IDBTransaction as unknown as typeof global.IDBTransaction
global.IDBRequest = IDBRequest as unknown as typeof global.IDBRequest
global.IDBOpenDBRequest = IDBOpenDBRequest as unknown as typeof global.IDBOpenDBRequest
global.IDBVersionChangeEvent = IDBVersionChangeEvent as unknown as typeof global.IDBVersionChangeEvent

// Mock navigator.locks API for Node.js environment ---

// 1. Ensure the global navigator object exists
if (typeof global.navigator === 'undefined') {
  console.log('mocking navigator')
  global.navigator = {} as Navigator
}

// 2. Define or redefine the 'locks' property on navigator
//    Check if 'locks' is falsy (null or undefined), OR if it's an object
//    that doesn't have the 'request' property we expect in our mock.
if (!global.navigator.locks || !('request' in global.navigator.locks)) {
  Object.defineProperty(global.navigator, 'locks', {
    // The value of the 'locks' property will be our mock object
    value: {
      // Mock the 'request' method
      request: vi
        .fn()
        .mockImplementation(async (name: string, callback: (lock: { name: string } | null) => Promise<any>) => {
          // Simulate acquiring the lock immediately in the test environment.
          const mockLock = { name } // A minimal mock lock object
          try {
            // Execute the callback provided to navigator.locks.request
            const result = await callback(mockLock)
            return result // Return the result of the callback
          } catch (e) {
            // Log errors from the callback for better debugging in tests
            console.error(`Error occurred within mocked lock callback for lock "${name}":`, e)
            throw e // Re-throw the error so the test potentially fails
          }
        }),
      // Mock the 'query' method
      query: vi.fn().mockResolvedValue({ held: [], pending: [] }),
    },
    writable: true,
    configurable: true,
    enumerable: true,
  })
} else {
  console.log('navigator.locks already exists and appears to have a "request" property.')
}

export function mockEthereum() {
  // Add window.ethereum support, pointing to the the Anvil local RPC
  if (typeof (window as any).ethereum === 'undefined') {
    ;(window as any).ethereum = {
      request: vi.fn().mockImplementation(async (args: any) => {
        // Pipe the request to the Anvil local RPC
        const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
        return provider.request(args)
      }),
    }
  }
}
