import { indexedDB, IDBFactory } from 'fake-indexeddb'
import { Address, Bytes, Hex, Provider, RpcTransport } from 'ox'
import { vi } from 'vitest'
import { LOCAL_RPC_URL } from './constants'

// Add IndexedDB support to the test environment
global.indexedDB = indexedDB
global.IDBFactory = IDBFactory

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

// export type SendTransactionParams = {
//   provider: Provider.Provider
//   sender?: Address.Address
//   to: Address.Address
//   data?: Hex.Hex
//   value?: bigint | Hex.Hex
//   gasLimit?: bigint | Hex.Hex
// }

// export async function sendTransactionWithManagedNonce({
//   provider,
//   sender,
//   to,
//   data = '0x' as Hex.Hex,
//   value,
//   gasLimit,
// }: SendTransactionParams): Promise<Hex.Hex> {
//   let effectiveSender: Address.Address

//   if (sender) {
//     effectiveSender = sender
//   } else {
//     // If sender is not provided, fetch accounts and use the first one (Anvil's default)
//     const accounts = await provider.request({ method: 'eth_accounts' })
//     if (!accounts || accounts.length === 0) {
//       throw new Error('No accounts found in provider and no sender specified.')
//     }
//     effectiveSender = accounts[0]
//   }

//   const nonce = await provider.request({
//     method: 'eth_getTransactionCount',
//     params: [effectiveSender, 'pending'],
//   })

//   const txParams: {
//     from: Address.Address
//     to: Address.Address
//     data: Hex.Hex
//     nonce: Hex.Hex
//     value?: Hex.Hex
//     gas?: Hex.Hex
//   } = {
//     from: effectiveSender,
//     to,
//     data,
//     nonce,
//   }

//   if (value !== undefined) {
//     txParams.value = typeof value === 'bigint' ? Hex.fromNumber(value) : value
//   }

//   if (gasLimit !== undefined) {
//     txParams.gas = typeof gasLimit === 'bigint' ? Hex.fromNumber(gasLimit) : gasLimit
//   }

//   return provider.request({
//     method: 'eth_sendTransaction',
//     params: [txParams],
//   })
// }
