import { Address, Hex } from 'ox'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { Cached } from '../../src/state/cached.js'
import type { Provider } from '../../src/state/index.js'
import { Network } from '@0xsequence/wallet-primitives'

// Test data
const TEST_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TEST_ADDRESS_2 = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const TEST_IMAGE_HASH = Hex.from('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
const TEST_IMAGE_HASH_2 = Hex.from('0x2222222222222222222222222222222222222222222222222222222222222222')
const TEST_ROOT_HASH = Hex.from('0xfedcba098765432109876543210987654321098765432109876543210987654321')
const TEST_OP_HASH = Hex.from('0x1111111111111111111111111111111111111111111111111111111111111111')

// Mock data
const mockConfig = { test: 'config' } as any
const mockContext = { test: 'context' } as any
const mockPayload = {
  type: 'call',
  calls: [{ to: TEST_ADDRESS, value: 0n, data: '0x123' }],
} as any

const mockSignature = {
  type: 'hash',
  r: 123n,
  s: 456n,
  yParity: 0,
} as any

const mockSapientSignature = {
  type: 'sapient',
  address: TEST_ADDRESS,
  data: '0xabcdef',
} as any

const mockWalletData = {
  chainId: Network.ChainId.MAINNET,
  payload: mockPayload,
  signature: mockSignature,
}

const mockSapientWalletData = {
  chainId: Network.ChainId.MAINNET,
  payload: mockPayload,
  signature: mockSapientSignature,
}

const mockTree = { test: 'tree' } as any
const mockSignatures = { type: 'unrecovered-signer', weight: 1n, signature: mockSignature } as any

describe('Cached', () => {
  let mockSource: Provider
  let mockCache: Provider
  let cached: Cached

  beforeEach(() => {
    // Create comprehensive mock providers
    mockSource = {
      getConfiguration: vi.fn(),
      getDeploy: vi.fn(),
      getWallets: vi.fn(),
      getWalletsForSapient: vi.fn(),
      getWitnessFor: vi.fn(),
      getWitnessForSapient: vi.fn(),
      getLatestImageHash: vi.fn(),
      getConfigurationUpdates: vi.fn(),
      getTree: vi.fn(),
      getPayload: vi.fn(),
      saveWallet: vi.fn(),
      saveWitnesses: vi.fn(),
      saveUpdate: vi.fn(),
      saveTree: vi.fn(),
      saveConfiguration: vi.fn(),
      saveDeploy: vi.fn(),
      savePayload: vi.fn(),
    } as unknown as Provider

    mockCache = {
      getConfiguration: vi.fn(),
      getDeploy: vi.fn(),
      getWallets: vi.fn(),
      getWalletsForSapient: vi.fn(),
      getWitnessFor: vi.fn(),
      getWitnessForSapient: vi.fn(),
      getLatestImageHash: vi.fn(),
      getConfigurationUpdates: vi.fn(),
      getTree: vi.fn(),
      getPayload: vi.fn(),
      saveWallet: vi.fn(),
      saveWitnesses: vi.fn(),
      saveUpdate: vi.fn(),
      saveTree: vi.fn(),
      saveConfiguration: vi.fn(),
      saveDeploy: vi.fn(),
      savePayload: vi.fn(),
    } as unknown as Provider

    cached = new Cached({ source: mockSource, cache: mockCache })
  })

  describe('getConfiguration', () => {
    it('should return cached config when available', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

      const result = await cached.getConfiguration(TEST_IMAGE_HASH)

      expect(result).toBe(mockConfig)
      expect(mockCache.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
      expect(mockSource.getConfiguration).not.toHaveBeenCalled()
    })

    it('should fetch from source and cache when not in cache', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined)
      vi.mocked(mockSource.getConfiguration).mockResolvedValue(mockConfig)

      const result = await cached.getConfiguration(TEST_IMAGE_HASH)

      expect(result).toBe(mockConfig)
      expect(mockCache.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
      expect(mockSource.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
      expect(mockCache.saveConfiguration).toHaveBeenCalledWith(mockConfig)
    })

    it('should return undefined when not found in cache or source', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined)
      vi.mocked(mockSource.getConfiguration).mockResolvedValue(undefined)

      const result = await cached.getConfiguration(TEST_IMAGE_HASH)

      expect(result).toBeUndefined()
      expect(mockCache.saveConfiguration).not.toHaveBeenCalled()
    })
  })

  describe('getDeploy', () => {
    const mockDeploy = { imageHash: TEST_IMAGE_HASH, context: mockContext }

    it('should return cached deploy when available', async () => {
      vi.mocked(mockCache.getDeploy).mockResolvedValue(mockDeploy)

      const result = await cached.getDeploy(TEST_ADDRESS)

      expect(result).toBe(mockDeploy)
      expect(mockCache.getDeploy).toHaveBeenCalledWith(TEST_ADDRESS)
      expect(mockSource.getDeploy).not.toHaveBeenCalled()
    })

    it('should fetch from source and cache when not in cache', async () => {
      vi.mocked(mockCache.getDeploy).mockResolvedValue(undefined)
      vi.mocked(mockSource.getDeploy).mockResolvedValue(mockDeploy)

      const result = await cached.getDeploy(TEST_ADDRESS)

      expect(result).toBe(mockDeploy)
      expect(mockSource.getDeploy).toHaveBeenCalledWith(TEST_ADDRESS)
      expect(mockCache.saveDeploy).toHaveBeenCalledWith(TEST_IMAGE_HASH, mockContext)
    })
  })

  describe('getWallets', () => {
    it('should merge cache and source data and sync bidirectionally', async () => {
      const cacheData = {
        [TEST_ADDRESS]: mockWalletData,
      }
      const sourceData = {
        [TEST_ADDRESS_2]: mockWalletData,
      }

      vi.mocked(mockCache.getWallets).mockResolvedValue(cacheData)
      vi.mocked(mockSource.getWallets).mockResolvedValue(sourceData)

      const result = await cached.getWallets(TEST_ADDRESS)

      // Should merge both datasets - addresses will be checksummed
      expect(result).toEqual({
        [TEST_ADDRESS]: mockWalletData,
        [Address.checksum(TEST_ADDRESS_2)]: mockWalletData,
      })

      // Should sync missing data to source and cache
      expect(mockSource.saveWitnesses).toHaveBeenCalledWith(
        TEST_ADDRESS,
        mockWalletData.chainId,
        mockWalletData.payload,
        {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: mockWalletData.signature,
        },
      )

      expect(mockCache.saveWitnesses).toHaveBeenCalledWith(
        Address.checksum(TEST_ADDRESS_2),
        mockWalletData.chainId,
        mockWalletData.payload,
        {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: mockWalletData.signature,
        },
      )
    })

    it('should handle overlapping data without duplicate syncing', async () => {
      const sharedData = {
        [TEST_ADDRESS]: mockWalletData,
      }

      vi.mocked(mockCache.getWallets).mockResolvedValue(sharedData)
      vi.mocked(mockSource.getWallets).mockResolvedValue(sharedData)

      const result = await cached.getWallets(TEST_ADDRESS)

      expect(result).toEqual(sharedData)
      // Should not sync data that exists in both
      expect(mockSource.saveWitnesses).not.toHaveBeenCalled()
      expect(mockCache.saveWitnesses).not.toHaveBeenCalled()
    })

    it('should handle empty cache and source', async () => {
      vi.mocked(mockCache.getWallets).mockResolvedValue({})
      vi.mocked(mockSource.getWallets).mockResolvedValue({})

      const result = await cached.getWallets(TEST_ADDRESS)

      expect(result).toEqual({})
      expect(mockSource.saveWitnesses).not.toHaveBeenCalled()
      expect(mockCache.saveWitnesses).not.toHaveBeenCalled()
    })
  })

  describe('getWalletsForSapient', () => {
    it('should merge cache and source data for sapient signers', async () => {
      const cacheData = {
        [TEST_ADDRESS]: mockSapientWalletData,
      }
      const sourceData = {
        [TEST_ADDRESS_2]: mockSapientWalletData,
      }

      vi.mocked(mockCache.getWalletsForSapient).mockResolvedValue(cacheData)
      vi.mocked(mockSource.getWalletsForSapient).mockResolvedValue(sourceData)

      const result = await cached.getWalletsForSapient(TEST_ADDRESS, TEST_IMAGE_HASH)

      expect(result).toEqual({
        [TEST_ADDRESS]: mockSapientWalletData,
        [TEST_ADDRESS_2]: mockSapientWalletData,
      })

      // Verify bidirectional syncing
      expect(mockSource.saveWitnesses).toHaveBeenCalled()
      expect(mockCache.saveWitnesses).toHaveBeenCalled()
    })

    it('should handle address normalization in syncing', async () => {
      const sourceData = {
        [TEST_ADDRESS.toLowerCase()]: mockSapientWalletData,
      }

      vi.mocked(mockCache.getWalletsForSapient).mockResolvedValue({})
      vi.mocked(mockSource.getWalletsForSapient).mockResolvedValue(sourceData)

      await cached.getWalletsForSapient(TEST_ADDRESS, TEST_IMAGE_HASH)

      // Should sync to cache with proper address conversion
      expect(mockCache.saveWitnesses).toHaveBeenCalledWith(
        TEST_ADDRESS,
        mockSapientWalletData.chainId,
        mockSapientWalletData.payload,
        {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: mockSapientWalletData.signature,
        },
      )
    })
  })

  describe('getWitnessFor', () => {
    const mockWitness = {
      chainId: Network.ChainId.MAINNET,
      payload: mockPayload,
      signature: mockSignature,
    }

    it('should return cached witness when available', async () => {
      vi.mocked(mockCache.getWitnessFor).mockResolvedValue(mockWitness)

      const result = await cached.getWitnessFor(TEST_ADDRESS, TEST_ADDRESS_2)

      expect(result).toBe(mockWitness)
      expect(mockSource.getWitnessFor).not.toHaveBeenCalled()
    })

    it('should fetch from source and cache when not in cache', async () => {
      vi.mocked(mockCache.getWitnessFor).mockResolvedValue(undefined)
      vi.mocked(mockSource.getWitnessFor).mockResolvedValue(mockWitness)

      const result = await cached.getWitnessFor(TEST_ADDRESS, TEST_ADDRESS_2)

      expect(result).toBe(mockWitness)
      expect(mockCache.saveWitnesses).toHaveBeenCalledWith(TEST_ADDRESS, mockWitness.chainId, mockWitness.payload, {
        type: 'unrecovered-signer',
        weight: 1n,
        signature: mockWitness.signature,
      })
    })
  })

  describe('getWitnessForSapient', () => {
    const mockSapientWitness = {
      chainId: Network.ChainId.MAINNET,
      payload: mockPayload,
      signature: mockSapientSignature,
    }

    it('should return cached sapient witness when available', async () => {
      vi.mocked(mockCache.getWitnessForSapient).mockResolvedValue(mockSapientWitness)

      const result = await cached.getWitnessForSapient(TEST_ADDRESS, TEST_ADDRESS_2, TEST_IMAGE_HASH)

      expect(result).toBe(mockSapientWitness)
      expect(mockSource.getWitnessForSapient).not.toHaveBeenCalled()
    })

    it('should fetch from source and cache when not in cache', async () => {
      vi.mocked(mockCache.getWitnessForSapient).mockResolvedValue(undefined)
      vi.mocked(mockSource.getWitnessForSapient).mockResolvedValue(mockSapientWitness)

      const result = await cached.getWitnessForSapient(TEST_ADDRESS, TEST_ADDRESS_2, TEST_IMAGE_HASH)

      expect(result).toBe(mockSapientWitness)
      expect(mockCache.saveWitnesses).toHaveBeenCalledWith(
        TEST_ADDRESS,
        mockSapientWitness.chainId,
        mockSapientWitness.payload,
        {
          type: 'unrecovered-signer',
          weight: 1n,
          signature: mockSapientWitness.signature,
        },
      )
    })
  })

  describe('getTree', () => {
    it('should return cached tree when available', async () => {
      vi.mocked(mockCache.getTree).mockResolvedValue(mockTree)

      const result = await cached.getTree(TEST_ROOT_HASH)

      expect(result).toBe(mockTree)
      expect(mockSource.getTree).not.toHaveBeenCalled()
    })

    it('should fetch from source and cache when not in cache', async () => {
      vi.mocked(mockCache.getTree).mockResolvedValue(undefined)
      vi.mocked(mockSource.getTree).mockResolvedValue(mockTree)

      const result = await cached.getTree(TEST_ROOT_HASH)

      expect(result).toBe(mockTree)
      expect(mockCache.saveTree).toHaveBeenCalledWith(mockTree)
    })
  })

  describe('getPayload', () => {
    const mockPayloadData = {
      chainId: Network.ChainId.MAINNET,
      payload: mockPayload,
      wallet: TEST_ADDRESS,
    }

    it('should return cached payload when available', async () => {
      vi.mocked(mockCache.getPayload).mockResolvedValue(mockPayloadData)

      const result = await cached.getPayload(TEST_OP_HASH)

      expect(result).toBe(mockPayloadData)
      expect(mockSource.getPayload).not.toHaveBeenCalled()
    })

    it('should fetch from source and cache when not in cache', async () => {
      vi.mocked(mockCache.getPayload).mockResolvedValue(undefined)
      vi.mocked(mockSource.getPayload).mockResolvedValue(mockPayloadData)

      const result = await cached.getPayload(TEST_OP_HASH)

      expect(result).toBe(mockPayloadData)
      expect(mockCache.savePayload).toHaveBeenCalledWith(
        mockPayloadData.wallet,
        mockPayloadData.payload,
        mockPayloadData.chainId,
      )
    })
  })

  describe('getLatestImageHash', () => {
    it('should return source image hash always', async () => {
      vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH)
      const result = await cached.getLatestImageHash(TEST_ADDRESS)
      expect(result).toBe(TEST_IMAGE_HASH)
      expect(mockSource.getLatestImageHash).toHaveBeenCalledWith(TEST_ADDRESS)
      expect(mockCache.getLatestImageHash).not.toHaveBeenCalled()
    })
  })

  describe('getConfigurationUpdates', () => {
    const TEST_IMAGE_HASH_3 = Hex.from('0x3333333333333333333333333333333333333333333333333333333333333333')
    const TEST_IMAGE_HASH_4 = Hex.from('0x4444444444444444444444444444444444444444444444444444444444444444')

    describe('cached updates scenarios', () => {
      it('should return cached updates when available and up to date', async () => {
        const mockUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH_2)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockCache.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        expect(mockSource.getLatestImageHash).toHaveBeenCalledWith(TEST_ADDRESS)
        expect(mockSource.getConfigurationUpdates).not.toHaveBeenCalled()
      })

      it('should return cached updates when toImageHash matches last cached update', async () => {
        const mockUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(mockUpdates)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, {
          toImageHash: TEST_IMAGE_HASH_2,
        })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockCache.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          toImageHash: TEST_IMAGE_HASH_2,
        })
        expect(mockSource.getLatestImageHash).not.toHaveBeenCalled()
        expect(mockSource.getConfigurationUpdates).not.toHaveBeenCalled()
      })

      it('should fetch from source when cached updates are stale', async () => {
        const cachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        const sourceUpdates = [{ imageHash: TEST_IMAGE_HASH_3, signature: '0x456' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(cachedUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH_3)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(sourceUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toEqual([...cachedUpdates, ...sourceUpdates])
        expect(mockSource.getLatestImageHash).toHaveBeenCalledWith(TEST_ADDRESS)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH_2, {
          allUpdates: true,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, sourceUpdates[0].signature)
      })

      it('should fetch from source when toImageHash is beyond cached updates', async () => {
        const cachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        const sourceUpdates = [{ imageHash: TEST_IMAGE_HASH_3, signature: '0x456' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(cachedUpdates)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(sourceUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, {
          toImageHash: TEST_IMAGE_HASH_3,
        })

        expect(result).toEqual([...cachedUpdates, ...sourceUpdates])
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH_2, {
          toImageHash: TEST_IMAGE_HASH_3,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, sourceUpdates[0].signature)
      })
    })

    describe('partial cache scenarios', () => {
      it('should merge partial cached updates with source updates', async () => {
        const partialCachedUpdates = [
          { imageHash: TEST_IMAGE_HASH_2, signature: '0x123' },
          { imageHash: TEST_IMAGE_HASH_3, signature: '0x456' },
        ] as any
        const sourceUpdates = [{ imageHash: TEST_IMAGE_HASH_4, signature: '0x789' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(partialCachedUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH_4)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(sourceUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toEqual([...partialCachedUpdates, ...sourceUpdates])
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH_3, {
          allUpdates: true,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, sourceUpdates[0].signature)
      })

      it('should handle multiple source updates in partial cache scenario', async () => {
        const partialCachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        const sourceUpdates = [
          { imageHash: TEST_IMAGE_HASH_3, signature: '0x456' },
          { imageHash: TEST_IMAGE_HASH_4, signature: '0x789' },
        ] as any
        const mockConfig2 = { test: 'config2' } as any
        const mockConfig3 = { test: 'config3' } as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(partialCachedUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH_4)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(sourceUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValueOnce(mockConfig2)
        vi.mocked(mockCache.getConfiguration).mockResolvedValueOnce(mockConfig3)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toEqual([...partialCachedUpdates, ...sourceUpdates])
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH_2, {
          allUpdates: true,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig2, sourceUpdates[0].signature)
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig3, sourceUpdates[1].signature)
      })

      it('should handle partial cache with toImageHash option', async () => {
        const partialCachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        const sourceUpdates = [{ imageHash: TEST_IMAGE_HASH_3, signature: '0x456' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(partialCachedUpdates)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(sourceUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, {
          toImageHash: TEST_IMAGE_HASH_3,
        })

        expect(result).toEqual([...partialCachedUpdates, ...sourceUpdates])
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH_2, {
          toImageHash: TEST_IMAGE_HASH_3,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, sourceUpdates[0].signature)
      })
    })

    describe('no cache scenarios', () => {
      it('should fetch from source and cache when not in cache', async () => {
        const mockUpdates = [{ imageHash: TEST_IMAGE_HASH, signature: '0x123' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        expect(mockCache.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, mockUpdates[0].signature)
        expect(mockSource.getLatestImageHash).not.toHaveBeenCalled()
      })

      it('should fetch from source with toImageHash when not in cache', async () => {
        const mockUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(mockConfig)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, {
          toImageHash: TEST_IMAGE_HASH_2,
        })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          toImageHash: TEST_IMAGE_HASH_2,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, mockUpdates[0].signature)
        expect(mockSource.getLatestImageHash).not.toHaveBeenCalled()
      })

      it('should fetch config from source when config is missing from cache', async () => {
        const mockUpdates = [{ imageHash: TEST_IMAGE_HASH, signature: '0x123' }] as any
        const mockConfigFromSource = { test: 'config-from-source' } as any

        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined) // Config not in cache
        vi.mocked(mockSource.getConfiguration).mockResolvedValue(mockConfigFromSource) // Config in source

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        // Should fetch config from source when not in cache
        expect(mockSource.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
        // Should save config to cache
        expect(mockCache.saveConfiguration).toHaveBeenCalledWith(mockConfigFromSource)
        // Should save update to cache
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfigFromSource, mockUpdates[0].signature)
      })

      it('should handle multiple updates when cache is missing and configs need to be fetched', async () => {
        const mockUpdates = [
          { imageHash: TEST_IMAGE_HASH, signature: '0x123' },
          { imageHash: TEST_IMAGE_HASH_2, signature: '0x456' },
        ] as any
        const mockConfig1 = { test: 'config1' } as any
        const mockConfig2 = { test: 'config2' } as any

        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        // First config not in cache, second config in cache
        vi.mocked(mockCache.getConfiguration)
          .mockResolvedValueOnce(undefined) // First call returns undefined
          .mockResolvedValueOnce(mockConfig2) // Second call returns config
        vi.mocked(mockSource.getConfiguration).mockResolvedValue(mockConfig1)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        // Should fetch first config from source
        expect(mockSource.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
        // Should save first config to cache
        expect(mockCache.saveConfiguration).toHaveBeenCalledWith(mockConfig1)
        // Should save both updates to cache
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig1, mockUpdates[0].signature)
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig2, mockUpdates[1].signature)
      })

      it('should handle when config is not found in source during update flow', async () => {
        const mockUpdates = [{ imageHash: TEST_IMAGE_HASH, signature: '0x123' }] as any

        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined) // Config not in cache
        vi.mocked(mockSource.getConfiguration).mockResolvedValue(undefined) // Config not in source either

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        // Should try to fetch config from source
        expect(mockSource.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
        // Should not save config to cache since it's undefined
        expect(mockCache.saveConfiguration).not.toHaveBeenCalled()
        // Should not save update to cache since config is undefined
        expect(mockCache.saveUpdate).not.toHaveBeenCalled()
      })

      it('should handle mixed scenario where some configs are in cache and others need to be fetched', async () => {
        const mockUpdates = [
          { imageHash: TEST_IMAGE_HASH, signature: '0x123' },
          { imageHash: TEST_IMAGE_HASH_2, signature: '0x456' },
          { imageHash: TEST_IMAGE_HASH_3, signature: '0x789' },
        ] as any
        const mockConfig1 = { test: 'config1' } as any
        const mockConfig3 = { test: 'config3' } as any

        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        // Config1 not in cache, Config2 in cache, Config3 not in cache
        vi.mocked(mockCache.getConfiguration)
          .mockResolvedValueOnce(undefined) // First call for TEST_IMAGE_HASH
          .mockResolvedValueOnce(mockConfig) // Second call for TEST_IMAGE_HASH_2 (in cache)
          .mockResolvedValueOnce(undefined) // Third call for TEST_IMAGE_HASH_3
        vi.mocked(mockSource.getConfiguration)
          .mockResolvedValueOnce(mockConfig1) // First config from source
          .mockResolvedValueOnce(mockConfig3) // Third config from source

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        // Should fetch configs from source for missing ones
        expect(mockSource.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH)
        expect(mockSource.getConfiguration).toHaveBeenCalledWith(TEST_IMAGE_HASH_3)
        // Should not fetch config2 since it's in cache
        expect(mockSource.getConfiguration).not.toHaveBeenCalledWith(TEST_IMAGE_HASH_2)
        // Should save missing configs to cache
        expect(mockCache.saveConfiguration).toHaveBeenCalledWith(mockConfig1)
        expect(mockCache.saveConfiguration).toHaveBeenCalledWith(mockConfig3)
        // Should save all updates to cache
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig1, mockUpdates[0].signature)
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, mockUpdates[1].signature)
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig3, mockUpdates[2].signature)
      })
    })

    describe('edge cases', () => {
      it('should handle when getLatestImageHash returns undefined', async () => {
        const cachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(cachedUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(undefined)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        // When getLatestImageHash returns undefined, it should return cached updates without fetching from source
        expect(result).toEqual(cachedUpdates)
        expect(mockSource.getLatestImageHash).toHaveBeenCalledWith(TEST_ADDRESS)
        expect(mockSource.getConfigurationUpdates).not.toHaveBeenCalled()
        expect(mockCache.saveUpdate).not.toHaveBeenCalled()
      })

      it('should handle when source returns empty updates', async () => {
        const cachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(cachedUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH_3)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue([])

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(cachedUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH_2, {
          allUpdates: true,
        })
        expect(mockCache.saveUpdate).not.toHaveBeenCalled()
      })

      it('should handle when config is not found for source update', async () => {
        const cachedUpdates = [{ imageHash: TEST_IMAGE_HASH_2, signature: '0x123' }] as any
        const sourceUpdates = [{ imageHash: TEST_IMAGE_HASH_3, signature: '0x456' }] as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue(cachedUpdates)
        vi.mocked(mockSource.getLatestImageHash).mockResolvedValue(TEST_IMAGE_HASH_3)
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(sourceUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toEqual([...cachedUpdates, ...sourceUpdates])
        expect(mockCache.saveUpdate).not.toHaveBeenCalled()
      })

      it('should handle when both cache and source return empty', async () => {
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue([])

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toEqual([])
        expect(mockSource.getLatestImageHash).not.toHaveBeenCalled()
        expect(mockCache.saveUpdate).not.toHaveBeenCalled()
      })
    })

    describe('legacy tests for backward compatibility', () => {
      it('should save updates to cache', async () => {
        const mockUpdates = [
          { imageHash: TEST_IMAGE_HASH, signature: '0x123' },
          { imageHash: TEST_IMAGE_HASH_2, signature: '0x456' },
        ] as any
        const mockConfig2 = { test: 'config2' } as any
        vi.mocked(mockCache.getConfigurationUpdates).mockResolvedValue([])
        vi.mocked(mockSource.getConfigurationUpdates).mockResolvedValue(mockUpdates)
        vi.mocked(mockCache.getConfiguration).mockResolvedValueOnce(mockConfig)
        vi.mocked(mockCache.getConfiguration).mockResolvedValueOnce(mockConfig2)

        const result = await cached.getConfigurationUpdates(TEST_ADDRESS, TEST_IMAGE_HASH, { allUpdates: true })

        expect(result).toStrictEqual(mockUpdates)
        expect(mockSource.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        expect(mockCache.getConfigurationUpdates).toHaveBeenCalledWith(TEST_ADDRESS, TEST_IMAGE_HASH, {
          allUpdates: true,
        })
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, mockUpdates[0].signature)
        expect(mockCache.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig2, mockUpdates[1].signature)
      })
    })
  })

  describe('write operations', () => {
    it('should forward saveWallet to source only', async () => {
      await cached.saveWallet(mockConfig, mockContext)

      expect(mockSource.saveWallet).toHaveBeenCalledWith(mockConfig, mockContext)
      expect(mockCache.saveWallet).not.toHaveBeenCalled()
    })

    it('should forward saveWitnesses to source only', async () => {
      await cached.saveWitnesses(TEST_ADDRESS, Network.ChainId.MAINNET, mockPayload, mockSignatures)

      expect(mockSource.saveWitnesses).toHaveBeenCalledWith(
        TEST_ADDRESS,
        Network.ChainId.MAINNET,
        mockPayload,
        mockSignatures,
      )
      expect(mockCache.saveWitnesses).not.toHaveBeenCalled()
    })

    it('should forward saveUpdate to source only', async () => {
      const mockRawSignature = '0x123' as any
      await cached.saveUpdate(TEST_ADDRESS, mockConfig, mockRawSignature)

      expect(mockSource.saveUpdate).toHaveBeenCalledWith(TEST_ADDRESS, mockConfig, mockRawSignature)
      expect(mockCache.saveUpdate).not.toHaveBeenCalled()
    })

    it('should forward saveTree to source only', async () => {
      await cached.saveTree(mockTree)

      expect(mockSource.saveTree).toHaveBeenCalledWith(mockTree)
      expect(mockCache.saveTree).not.toHaveBeenCalled()
    })

    it('should forward saveConfiguration to source only', async () => {
      await cached.saveConfiguration(mockConfig)

      expect(mockSource.saveConfiguration).toHaveBeenCalledWith(mockConfig)
      expect(mockCache.saveConfiguration).not.toHaveBeenCalled()
    })

    it('should forward saveDeploy to source only', async () => {
      await cached.saveDeploy(TEST_IMAGE_HASH, mockContext)

      expect(mockSource.saveDeploy).toHaveBeenCalledWith(TEST_IMAGE_HASH, mockContext)
      expect(mockCache.saveDeploy).not.toHaveBeenCalled()
    })

    it('should forward savePayload to source only', async () => {
      await cached.savePayload(TEST_ADDRESS, mockPayload, Network.ChainId.MAINNET)

      expect(mockSource.savePayload).toHaveBeenCalledWith(TEST_ADDRESS, mockPayload, Network.ChainId.MAINNET)
      expect(mockCache.savePayload).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate errors from cache and source', async () => {
      vi.mocked(mockCache.getConfiguration).mockRejectedValue(new Error('Cache error'))
      vi.mocked(mockSource.getConfiguration).mockRejectedValue(new Error('Source error'))

      await expect(cached.getConfiguration(TEST_IMAGE_HASH)).rejects.toThrow('Cache error')
    })

    it('should propagate source errors when cache is empty', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined)
      vi.mocked(mockSource.getConfiguration).mockRejectedValue(new Error('Source error'))

      await expect(cached.getConfiguration(TEST_IMAGE_HASH)).rejects.toThrow('Source error')
    })

    it('should propagate cache save errors', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined)
      vi.mocked(mockSource.getConfiguration).mockResolvedValue(mockConfig)
      vi.mocked(mockCache.saveConfiguration).mockRejectedValue(new Error('Cache save error'))

      await expect(cached.getConfiguration(TEST_IMAGE_HASH)).rejects.toThrow('Cache save error')
    })
  })

  describe('edge cases', () => {
    it('should handle null/undefined returns from providers', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(null as any)
      vi.mocked(mockSource.getConfiguration).mockResolvedValue(null as any)

      const result = await cached.getConfiguration(TEST_IMAGE_HASH)

      expect(result).toBeNull()
    })

    it('should handle address normalization correctly', async () => {
      const cacheData = { [TEST_ADDRESS.toLowerCase()]: mockWalletData }
      const sourceData = { [TEST_ADDRESS_2.toLowerCase()]: mockWalletData }

      vi.mocked(mockCache.getWallets).mockResolvedValue(cacheData)
      vi.mocked(mockSource.getWallets).mockResolvedValue(sourceData)

      const result = await cached.getWallets(TEST_ADDRESS)

      // Should normalize and merge correctly - all addresses will be checksummed
      expect(Object.keys(result)).toHaveLength(2)
      expect(result[Address.checksum(TEST_ADDRESS)]).toBeDefined()
      expect(result[Address.checksum(TEST_ADDRESS_2)]).toBeDefined()
    })

    it('should handle concurrent operations correctly', async () => {
      vi.mocked(mockCache.getConfiguration).mockResolvedValue(undefined)
      vi.mocked(mockSource.getConfiguration).mockResolvedValue(mockConfig)

      // Simulate concurrent calls
      const promises = [
        cached.getConfiguration(TEST_IMAGE_HASH),
        cached.getConfiguration(TEST_IMAGE_HASH),
        cached.getConfiguration(TEST_IMAGE_HASH),
      ]

      const results = await Promise.all(promises)

      results.forEach((result) => expect(result).toBe(mockConfig))
      // Each call should trigger source fetch since cache is empty
      expect(mockSource.getConfiguration).toHaveBeenCalledTimes(3)
    })
  })
})
