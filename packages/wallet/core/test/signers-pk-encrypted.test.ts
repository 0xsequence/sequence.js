import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex, Bytes, PublicKey, Secp256k1 } from 'ox'
import { EncryptedPksDb, EncryptedPkStore, EncryptedData } from '../src/signers/pk/encrypted.js'

// Mock Ox module
vi.mock('ox', async () => {
  const actual = (await vi.importActual('ox')) as any
  return {
    ...actual,
    Hex: {
      ...(actual.Hex || {}),
      random: vi.fn(),
    },
    Secp256k1: {
      ...(actual.Secp256k1 || {}),
      getPublicKey: vi.fn(),
      sign: vi.fn(),
    },
    Address: {
      ...(actual.Address || {}),
      fromPublicKey: vi.fn(),
    },
  }
})

// Mock global objects
const mockLocalStorage = {
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
}

const mockCryptoSubtle = {
  generateKey: vi.fn(),
  exportKey: vi.fn(),
  importKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}

const mockCrypto = {
  subtle: mockCryptoSubtle,
  getRandomValues: vi.fn(),
}

const mockIndexedDB = {
  open: vi.fn(),
}

// Setup global mocks
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true,
})

Object.defineProperty(globalThis, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
})

// Mock window object
Object.defineProperty(globalThis, 'window', {
  value: {
    crypto: mockCrypto,
    localStorage: mockLocalStorage,
  },
  writable: true,
})

describe('Encrypted Private Key Signers', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890' as Address.Address
  const mockPrivateKey = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex.Hex
  const mockPublicKey = { x: 123n, y: 456n } as PublicKey.PublicKey
  const mockIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const mockEncryptedBuffer = new ArrayBuffer(32)
  const mockDigest = new Uint8Array([1, 2, 3, 4]) as Bytes.Bytes

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockLocalStorage.setItem.mockImplementation(() => {})
    mockLocalStorage.getItem.mockImplementation(() => null)
    mockLocalStorage.removeItem.mockImplementation(() => {})

    mockCrypto.getRandomValues.mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.set(mockIv)
      }
      return array
    })
  })

  describe('EncryptedPksDb', () => {
    let encryptedDb: EncryptedPksDb

    beforeEach(() => {
      encryptedDb = new EncryptedPksDb()
    })

    describe('Constructor', () => {
      it('Should construct with default parameters', () => {
        const db = new EncryptedPksDb()
        expect(db).toBeInstanceOf(EncryptedPksDb)
      })

      it('Should construct with custom parameters', () => {
        const db = new EncryptedPksDb('custom_prefix_', 'custom_table')
        expect(db).toBeInstanceOf(EncryptedPksDb)
      })
    })

    describe('computeDbKey', () => {
      it('Should compute correct database key', () => {
        // Access the private method via bracket notation for testing
        const dbKey = (encryptedDb as any).computeDbKey(mockAddress)
        expect(dbKey).toBe(`pk_${mockAddress.toLowerCase()}`)
      })
    })

    describe('generateAndStore', () => {
      beforeEach(() => {
        // Mock crypto operations
        const mockCryptoKey = { type: 'secret' }
        const mockJwk = { k: 'test-key', alg: 'A256GCM' }

        mockCryptoSubtle.generateKey.mockResolvedValue(mockCryptoKey)
        mockCryptoSubtle.exportKey.mockResolvedValue(mockJwk)
        mockCryptoSubtle.encrypt.mockResolvedValue(mockEncryptedBuffer)

        // Mock Ox functions using the mocked module
        vi.mocked(Hex.random).mockReturnValue(mockPrivateKey)
        vi.mocked(Secp256k1.getPublicKey).mockReturnValue(mockPublicKey)
        vi.mocked(Address.fromPublicKey).mockReturnValue(mockAddress)

        // Mock database operations by spying on private methods
        vi.spyOn(encryptedDb as any, 'putData').mockResolvedValue(undefined)
      })

      it('Should generate and store encrypted private key', async () => {
        const result = await encryptedDb.generateAndStore()

        expect(result).toEqual({
          iv: mockIv,
          data: mockEncryptedBuffer,
          keyPointer: 'e_pk_key_' + mockAddress,
          address: mockAddress,
          publicKey: mockPublicKey,
        })

        expect(mockCryptoSubtle.generateKey).toHaveBeenCalledWith({ name: 'AES-GCM', length: 256 }, true, [
          'encrypt',
          'decrypt',
        ])

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'e_pk_key_' + mockAddress,
          JSON.stringify({ k: 'test-key', alg: 'A256GCM' }),
        )

        expect(mockCryptoSubtle.encrypt).toHaveBeenCalledWith(
          { name: 'AES-GCM', iv: mockIv },
          { type: 'secret' },
          expect.any(Uint8Array),
        )
      })
    })

    describe('getEncryptedEntry', () => {
      it('Should return encrypted entry for valid address', async () => {
        const mockEncryptedData: EncryptedData = {
          iv: mockIv,
          data: mockEncryptedBuffer,
          keyPointer: 'test-key-pointer',
          address: mockAddress,
          publicKey: mockPublicKey,
        }

        vi.spyOn(encryptedDb as any, 'getData').mockResolvedValue(mockEncryptedData)

        const result = await encryptedDb.getEncryptedEntry(mockAddress)
        expect(result).toBe(mockEncryptedData)
      })

      it('Should return undefined for non-existent address', async () => {
        vi.spyOn(encryptedDb as any, 'getData').mockResolvedValue(undefined)

        const result = await encryptedDb.getEncryptedEntry(mockAddress)
        expect(result).toBeUndefined()
      })
    })

    describe('getEncryptedPkStore', () => {
      it('Should return EncryptedPkStore for valid address', async () => {
        const mockEncryptedData: EncryptedData = {
          iv: mockIv,
          data: mockEncryptedBuffer,
          keyPointer: 'test-key-pointer',
          address: mockAddress,
          publicKey: mockPublicKey,
        }

        // Spy on getEncryptedEntry
        vi.spyOn(encryptedDb, 'getEncryptedEntry').mockResolvedValue(mockEncryptedData)

        const result = await encryptedDb.getEncryptedPkStore(mockAddress)

        expect(result).toBeInstanceOf(EncryptedPkStore)
        expect(encryptedDb.getEncryptedEntry).toHaveBeenCalledWith(mockAddress)
      })

      it('Should return undefined when entry does not exist', async () => {
        vi.spyOn(encryptedDb, 'getEncryptedEntry').mockResolvedValue(undefined)

        const result = await encryptedDb.getEncryptedPkStore(mockAddress)

        expect(result).toBeUndefined()
      })
    })

    describe('listAddresses', () => {
      it('Should return list of addresses', async () => {
        const mockEntries: EncryptedData[] = [
          {
            iv: mockIv,
            data: mockEncryptedBuffer,
            keyPointer: 'key1',
            address: mockAddress,
            publicKey: mockPublicKey,
          },
          {
            iv: mockIv,
            data: mockEncryptedBuffer,
            keyPointer: 'key2',
            address: '0x9876543210987654321098765432109876543210' as Address.Address,
            publicKey: mockPublicKey,
          },
        ]

        vi.spyOn(encryptedDb as any, 'getAllData').mockResolvedValue(mockEntries)

        const result = await encryptedDb.listAddresses()
        expect(result).toEqual([mockAddress, '0x9876543210987654321098765432109876543210'])
      })
    })

    describe('remove', () => {
      it('Should remove encrypted data from both IndexedDB and localStorage', async () => {
        vi.spyOn(encryptedDb as any, 'putData').mockResolvedValue(undefined)

        await encryptedDb.remove(mockAddress)

        expect((encryptedDb as any).putData).toHaveBeenCalledWith(`pk_${mockAddress.toLowerCase()}`, undefined)
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`e_pk_key_${mockAddress}`)
      })
    })

    describe('Database operations', () => {
      it('Should handle openDB correctly', async () => {
        const mockDatabase = {
          transaction: vi.fn(),
          objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
          createObjectStore: vi.fn(),
        }

        const mockRequest = {
          result: mockDatabase,
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
        }

        mockIndexedDB.open.mockReturnValue(mockRequest)

        const dbPromise = (encryptedDb as any).openDB()

        // Simulate successful opening
        setTimeout(() => {
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess({ target: { result: mockDatabase } })
          }
        }, 0)

        const result = await dbPromise
        expect(result).toBe(mockDatabase)
        expect(mockIndexedDB.open).toHaveBeenCalledWith('pk-db', 1)
      })

      it('Should handle database upgrade', async () => {
        const mockDatabase = {
          transaction: vi.fn(),
          objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
          createObjectStore: vi.fn(),
        }

        const mockRequest = {
          result: mockDatabase,
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
        }

        mockIndexedDB.open.mockReturnValue(mockRequest)

        const dbPromise = (encryptedDb as any).openDB()

        // Simulate upgrade needed then success
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({ target: { result: mockDatabase } })
          }
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess({ target: { result: mockDatabase } })
          }
        }, 0)

        const result = await dbPromise
        expect(result).toBe(mockDatabase)
        expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('e_pk')
      })
    })
  })

  describe('EncryptedPkStore', () => {
    let encryptedData: EncryptedData
    let encryptedStore: EncryptedPkStore

    beforeEach(() => {
      encryptedData = {
        iv: mockIv,
        data: mockEncryptedBuffer,
        keyPointer: 'test-key-pointer',
        address: mockAddress,
        publicKey: mockPublicKey,
      }
      encryptedStore = new EncryptedPkStore(encryptedData)
    })

    describe('address', () => {
      it('Should return the correct address', () => {
        expect(encryptedStore.address()).toBe(mockAddress)
      })
    })

    describe('publicKey', () => {
      it('Should return the correct public key', () => {
        expect(encryptedStore.publicKey()).toBe(mockPublicKey)
      })
    })

    describe('signDigest', () => {
      beforeEach(() => {
        const mockJwk = { k: 'test-key', alg: 'A256GCM' }
        const mockCryptoKey = { type: 'secret' }
        const mockDecryptedBuffer = new TextEncoder().encode(mockPrivateKey)
        const mockSignature = { r: 123n, s: 456n, yParity: 0 }

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockJwk))
        mockCryptoSubtle.importKey.mockResolvedValue(mockCryptoKey)
        mockCryptoSubtle.decrypt.mockResolvedValue(mockDecryptedBuffer)
        vi.mocked(Secp256k1.sign).mockReturnValue(mockSignature)
      })

      it('Should sign digest successfully', async () => {
        const result = await encryptedStore.signDigest(mockDigest)

        expect(result).toEqual({ r: 123n, s: 456n, yParity: 0 })

        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key-pointer')
        expect(mockCryptoSubtle.importKey).toHaveBeenCalledWith(
          'jwk',
          { k: 'test-key', alg: 'A256GCM' },
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        )
        expect(mockCryptoSubtle.decrypt).toHaveBeenCalledWith(
          { name: 'AES-GCM', iv: mockIv },
          { type: 'secret' },
          mockEncryptedBuffer,
        )
        expect(Secp256k1.sign).toHaveBeenCalledWith({
          payload: mockDigest,
          privateKey: mockPrivateKey,
        })
      })

      it('Should throw error when encryption key not found in localStorage', async () => {
        mockLocalStorage.getItem.mockReturnValue(null)

        await expect(encryptedStore.signDigest(mockDigest)).rejects.toThrow('Encryption key not found in localStorage')
      })

      it('Should handle JSON parsing errors', async () => {
        mockLocalStorage.getItem.mockReturnValue('invalid json')

        await expect(encryptedStore.signDigest(mockDigest)).rejects.toThrow()
      })

      it('Should handle crypto import key errors', async () => {
        const mockJwk = { k: 'test-key', alg: 'A256GCM' }
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockJwk))
        mockCryptoSubtle.importKey.mockRejectedValue(new Error('Import key failed'))

        await expect(encryptedStore.signDigest(mockDigest)).rejects.toThrow('Import key failed')
      })

      it('Should handle decryption errors', async () => {
        const mockJwk = { k: 'test-key', alg: 'A256GCM' }
        const mockCryptoKey = { type: 'secret' }

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockJwk))
        mockCryptoSubtle.importKey.mockResolvedValue(mockCryptoKey)
        mockCryptoSubtle.decrypt.mockRejectedValue(new Error('Decryption failed'))

        await expect(encryptedStore.signDigest(mockDigest)).rejects.toThrow('Decryption failed')
      })
    })
  })
})
