import { Address, Hex } from 'ox'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getWalletsFor, normalizeAddressKeys } from '../../src/state/utils.js'
import type { Reader } from '../../src/state/index.js'
import type { Signer, SapientSigner } from '../../src/signers/index.js'
import { Payload, Signature } from '@0xsequence/wallet-primitives'

// Test addresses
const TEST_SIGNER_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TEST_WALLET_ADDRESS_1 = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const TEST_WALLET_ADDRESS_2 = Address.from('0x9876543210987654321098765432109876543210')
const TEST_IMAGE_HASH = Hex.from('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')

// Mock data for testing
const mockPayload: Payload.Parented = {
  type: 'call',
  nonce: 1n,
  space: 0n,
  calls: [
    {
      to: TEST_WALLET_ADDRESS_1,
      value: 1000000000000000000n,
      data: '0x12345678',
      gasLimit: 21000n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    },
  ],
  parentWallets: [TEST_WALLET_ADDRESS_1],
}

const mockRegularSignature: Signature.SignatureOfSignerLeaf = {
  type: 'hash',
  r: 123n,
  s: 456n,
  yParity: 0,
}

const mockSapientSignature: Signature.SignatureOfSapientSignerLeaf = {
  type: 'sapient',
  address: TEST_SIGNER_ADDRESS,
  data: '0xabcdef123456',
}

describe('State Utils', () => {
  // Mock console.warn to test warning messages
  const originalWarn = console.warn
  beforeEach(() => {
    console.warn = vi.fn()
  })
  afterEach(() => {
    console.warn = originalWarn
  })

  describe('normalizeAddressKeys', () => {
    it('should normalize lowercase addresses to checksum format', () => {
      const input = {
        '0x1234567890123456789012345678901234567890': 'signature1',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': 'signature2',
      }

      const result = normalizeAddressKeys(input)

      // Check that addresses are properly checksummed
      expect(result).toHaveProperty('0x1234567890123456789012345678901234567890', 'signature1')
      expect(result).toHaveProperty('0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD', 'signature2')
    })

    it('should normalize uppercase addresses to checksum format', () => {
      const input = {
        '0x1234567890123456789012345678901234567890': 'signature1',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': 'signature2',
      }

      const result = normalizeAddressKeys(input)

      expect(result).toHaveProperty('0x1234567890123456789012345678901234567890', 'signature1')
      expect(result).toHaveProperty('0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD', 'signature2')
    })

    it('should handle mixed case addresses', () => {
      const input = {
        '0x1234567890aBcDeF1234567890123456789012Ab': 'signature1',
      }

      const result = normalizeAddressKeys(input)

      // Should normalize to proper checksum
      const normalizedKey = Object.keys(result)[0]
      expect(normalizedKey).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(result[normalizedKey as Address.Address]).toBe('signature1')
    })

    it('should handle empty object', () => {
      const input = {}
      const result = normalizeAddressKeys(input)
      expect(result).toEqual({})
    })

    it('should preserve values for different value types', () => {
      const input = {
        '0x1234567890123456789012345678901234567890': { chainId: 1n, payload: mockPayload },
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': 'string-value',
        '0x9876543210987654321098765432109876543210': 123,
      }

      const result = normalizeAddressKeys(input)

      expect(Object.values(result)).toHaveLength(3)
      expect(Object.values(result)).toContain(input['0x1234567890123456789012345678901234567890'])
      expect(Object.values(result)).toContain('string-value')
      expect(Object.values(result)).toContain(123)
    })

    it('should handle complex nested objects as values', () => {
      const complexValue = {
        chainId: 42n,
        payload: mockPayload,
        signature: mockRegularSignature,
        nested: {
          deep: {
            value: 'test',
          },
        },
      }

      const input = {
        '0x1234567890123456789012345678901234567890': complexValue,
      }

      const result = normalizeAddressKeys(input)

      const normalizedAddress = Object.keys(result)[0] as Address.Address
      expect(result[normalizedAddress]).toEqual(complexValue)
      expect(result[normalizedAddress].nested.deep.value).toBe('test')
    })
  })

  describe('getWalletsFor', () => {
    let mockStateReader: Reader
    let mockSigner: Signer
    let mockSapientSigner: SapientSigner

    beforeEach(() => {
      // Mock isSapientSigner function
      vi.mock('../../src/signers/index.js', async () => {
        const actual = await vi.importActual('../../src/signers/index.js')
        return {
          ...actual,
          isSapientSigner: vi.fn(),
        }
      })

      // Create mock state reader
      mockStateReader = {
        getWallets: vi.fn(),
        getWalletsForSapient: vi.fn(),
      } as unknown as Reader

      // Create mock regular signer
      mockSigner = {
        address: Promise.resolve(TEST_SIGNER_ADDRESS),
        sign: vi.fn(),
      } as unknown as Signer

      // Create mock sapient signer
      mockSapientSigner = {
        address: Promise.resolve(TEST_SIGNER_ADDRESS),
        imageHash: Promise.resolve(TEST_IMAGE_HASH),
        signSapient: vi.fn(),
      } as unknown as SapientSigner
    })

    afterEach(() => {
      vi.clearAllMocks()
      vi.resetModules()
    })

    it('should handle regular signer successfully', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(false)

      const mockWalletsData = {
        [TEST_WALLET_ADDRESS_1]: {
          chainId: 1n,
          payload: mockPayload,
          signature: mockRegularSignature,
        },
        [TEST_WALLET_ADDRESS_2]: {
          chainId: 42n,
          payload: mockPayload,
          signature: mockRegularSignature,
        },
      }

      vi.mocked(mockStateReader.getWallets).mockResolvedValue(mockWalletsData)

      const result = await getWalletsFor(mockStateReader, mockSigner)

      expect(isSapientSigner).toHaveBeenCalledWith(mockSigner)
      expect(mockStateReader.getWallets).toHaveBeenCalledWith(TEST_SIGNER_ADDRESS)
      expect(result).toHaveLength(2)

      expect(result[0]).toEqual({
        wallet: TEST_WALLET_ADDRESS_1,
        chainId: 1n,
        payload: mockPayload,
        signature: mockRegularSignature,
      })

      expect(result[1]).toEqual({
        wallet: TEST_WALLET_ADDRESS_2,
        chainId: 42n,
        payload: mockPayload,
        signature: mockRegularSignature,
      })
    })

    it('should handle sapient signer with imageHash successfully', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(true)

      const mockWalletsData = {
        [TEST_WALLET_ADDRESS_1]: {
          chainId: 1n,
          payload: mockPayload,
          signature: mockSapientSignature,
        },
      }

      vi.mocked(mockStateReader.getWalletsForSapient).mockResolvedValue(mockWalletsData)

      const result = await getWalletsFor(mockStateReader, mockSapientSigner)

      expect(isSapientSigner).toHaveBeenCalledWith(mockSapientSigner)
      expect(mockStateReader.getWalletsForSapient).toHaveBeenCalledWith(TEST_SIGNER_ADDRESS, TEST_IMAGE_HASH)
      expect(result).toHaveLength(1)

      expect(result[0]).toEqual({
        wallet: TEST_WALLET_ADDRESS_1,
        chainId: 1n,
        payload: mockPayload,
        signature: mockSapientSignature,
      })
    })

    it('should handle sapient signer without imageHash (should warn and return empty)', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(true)

      const mockSapientSignerNoHash = {
        address: Promise.resolve(TEST_SIGNER_ADDRESS),
        imageHash: Promise.resolve(undefined),
        signSapient: vi.fn(),
      } as unknown as SapientSigner

      const result = await getWalletsFor(mockStateReader, mockSapientSignerNoHash)

      expect(isSapientSigner).toHaveBeenCalledWith(mockSapientSignerNoHash)
      expect(console.warn).toHaveBeenCalledWith('Sapient signer has no imageHash')
      expect(mockStateReader.getWalletsForSapient).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should handle empty wallets response', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(false)

      vi.mocked(mockStateReader.getWallets).mockResolvedValue({})

      const result = await getWalletsFor(mockStateReader, mockSigner)

      expect(result).toEqual([])
    })

    it('should handle promises for signer address properly', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(false)

      // Create a signer with delayed promise resolution
      const delayedSigner = {
        address: new Promise((resolve) => setTimeout(() => resolve(TEST_SIGNER_ADDRESS), 10)),
        sign: vi.fn(),
      } as unknown as Signer

      const mockWalletsData = {
        [TEST_WALLET_ADDRESS_1]: {
          chainId: 1n,
          payload: mockPayload,
          signature: mockRegularSignature,
        },
      }

      vi.mocked(mockStateReader.getWallets).mockResolvedValue(mockWalletsData)

      const result = await getWalletsFor(mockStateReader, delayedSigner)

      expect(mockStateReader.getWallets).toHaveBeenCalledWith(TEST_SIGNER_ADDRESS)
      expect(result).toHaveLength(1)
    })

    it('should handle promises for sapient signer address and imageHash properly', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(true)

      // Create a sapient signer with delayed promise resolution
      const delayedSapientSigner = {
        address: new Promise((resolve) => setTimeout(() => resolve(TEST_SIGNER_ADDRESS), 10)),
        imageHash: new Promise((resolve) => setTimeout(() => resolve(TEST_IMAGE_HASH), 15)),
        signSapient: vi.fn(),
      } as unknown as SapientSigner

      const mockWalletsData = {
        [TEST_WALLET_ADDRESS_1]: {
          chainId: 1n,
          payload: mockPayload,
          signature: mockSapientSignature,
        },
      }

      vi.mocked(mockStateReader.getWalletsForSapient).mockResolvedValue(mockWalletsData)

      const result = await getWalletsFor(mockStateReader, delayedSapientSigner)

      expect(mockStateReader.getWalletsForSapient).toHaveBeenCalledWith(TEST_SIGNER_ADDRESS, TEST_IMAGE_HASH)
      expect(result).toHaveLength(1)
    })

    it('should validate wallet addresses with Hex.assert', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(false)

      // Mock data with invalid hex (this would normally cause Hex.assert to throw)
      const mockWalletsDataWithInvalidHex = {
        'not-a-valid-hex-address': {
          chainId: 1n,
          payload: mockPayload,
          signature: mockRegularSignature,
        },
      }

      vi.mocked(mockStateReader.getWallets).mockResolvedValue(mockWalletsDataWithInvalidHex)

      // This should throw when Hex.assert is called on the invalid address
      await expect(getWalletsFor(mockStateReader, mockSigner)).rejects.toThrow()
    })

    it('should preserve data types in transformation', async () => {
      const { isSapientSigner } = await import('../../src/signers/index.js')
      vi.mocked(isSapientSigner).mockReturnValue(false)

      const specificPayload: Payload.Parented = {
        type: 'call',
        nonce: 123n,
        space: 456n,
        calls: [
          {
            to: TEST_WALLET_ADDRESS_2,
            value: 999999999999999999n,
            data: '0xabcdef123456789',
            gasLimit: 50000n,
            delegateCall: true,
            onlyFallback: true,
            behaviorOnError: 'ignore',
          },
        ],
        parentWallets: [TEST_WALLET_ADDRESS_1, TEST_WALLET_ADDRESS_2],
      }

      const specificSignature: Signature.SignatureOfSignerLeaf = {
        type: 'eth_sign',
        r: 999n,
        s: 888n,
        yParity: 1,
      }

      const mockWalletsData = {
        [TEST_WALLET_ADDRESS_1]: {
          chainId: 42161n, // Arbitrum
          payload: specificPayload,
          signature: specificSignature,
        },
      }

      vi.mocked(mockStateReader.getWallets).mockResolvedValue(mockWalletsData)

      const result = await getWalletsFor(mockStateReader, mockSigner)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        wallet: TEST_WALLET_ADDRESS_1,
        chainId: 42161n,
        payload: specificPayload,
        signature: specificSignature,
      })

      // Verify specific field preservation
      if (result[0].payload.type === 'call') {
        expect(result[0].payload.nonce).toBe(123n)
        expect(result[0].payload.calls[0].delegateCall).toBe(true)
      }
      if (result[0].signature.type === 'eth_sign') {
        expect(result[0].signature.r).toBe(999n)
        expect(result[0].signature.yParity).toBe(1)
      }
    })
  })
})
