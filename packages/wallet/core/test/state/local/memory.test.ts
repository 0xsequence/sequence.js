import { Address, Hex } from 'ox'
import { describe, expect, it, beforeEach } from 'vitest'

import { MemoryStore } from '../../../src/state/local/memory.js'
import { Network } from '@0xsequence/wallet-primitives'

// Test addresses and data
const TEST_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TEST_IMAGE_HASH = Hex.from('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
const TEST_SUBDIGEST = Hex.from('0xabcdef123456789012345678901234567890abcdef123456789012345678901234')

describe('MemoryStore', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })

  describe('basic CRUD operations', () => {
    it('should save and load configs', async () => {
      const config = { test: 'data' } as any

      await store.saveConfig(TEST_IMAGE_HASH, config)
      const retrieved = await store.loadConfig(TEST_IMAGE_HASH)

      expect(retrieved).toEqual(config)
    })

    it('should return undefined for non-existent config', async () => {
      const retrieved = await store.loadConfig(TEST_IMAGE_HASH)
      expect(retrieved).toBeUndefined()
    })

    it('should save and load counterfactual wallets', async () => {
      const context = { test: 'context' } as any

      await store.saveCounterfactualWallet(TEST_ADDRESS, TEST_IMAGE_HASH, context)
      const retrieved = await store.loadCounterfactualWallet(TEST_ADDRESS)

      expect(retrieved).toEqual({
        imageHash: TEST_IMAGE_HASH,
        context,
      })
    })

    it('should save and load payloads', async () => {
      const payload = {
        content: { test: 'payload' } as any,
        chainId: Network.ChainId.MAINNET,
        wallet: TEST_ADDRESS,
      }

      await store.savePayloadOfSubdigest(TEST_SUBDIGEST, payload)
      const retrieved = await store.loadPayloadOfSubdigest(TEST_SUBDIGEST)

      expect(retrieved).toEqual(payload)
    })

    it('should save and load signatures', async () => {
      const signature = { type: 'hash', r: 123n, s: 456n, yParity: 0 } as any

      await store.saveSignatureOfSubdigest(TEST_ADDRESS, TEST_SUBDIGEST, signature)
      const retrieved = await store.loadSignatureOfSubdigest(TEST_ADDRESS, TEST_SUBDIGEST)

      expect(retrieved).toEqual(signature)
    })

    it('should save and load trees', async () => {
      const tree = { test: 'tree' } as any

      await store.saveTree(TEST_IMAGE_HASH, tree)
      const retrieved = await store.loadTree(TEST_IMAGE_HASH)

      expect(retrieved).toEqual(tree)
    })
  })

  describe('deep copy functionality', () => {
    it('should create independent copies', async () => {
      const originalData = {
        content: { nested: { array: [1, 2, 3] } } as any,
        chainId: Network.ChainId.MAINNET,
        wallet: TEST_ADDRESS,
      }

      await store.savePayloadOfSubdigest(TEST_SUBDIGEST, originalData)
      const retrieved = await store.loadPayloadOfSubdigest(TEST_SUBDIGEST)

      // Should be equal but not the same reference
      expect(retrieved).toEqual(originalData)
      expect(retrieved).not.toBe(originalData)
    })

    it('should handle structuredClone fallback', async () => {
      // Test the fallback when structuredClone is not available
      const originalStructuredClone = global.structuredClone
      delete (global as any).structuredClone

      const newStore = new MemoryStore()
      const testData = { nested: { value: 'test' } } as any

      await newStore.saveConfig(TEST_IMAGE_HASH, testData)
      const retrieved = await newStore.loadConfig(TEST_IMAGE_HASH)

      expect(retrieved).toEqual(testData)
      expect(retrieved).not.toBe(testData)

      // Restore structuredClone
      global.structuredClone = originalStructuredClone
    })
  })

  describe('key normalization', () => {
    it('should normalize addresses to lowercase', async () => {
      const upperAddress = TEST_ADDRESS.toUpperCase() as Address.Address
      const context = { test: 'data' } as any

      await store.saveCounterfactualWallet(upperAddress, TEST_IMAGE_HASH, context)
      const retrieved = await store.loadCounterfactualWallet(TEST_ADDRESS.toLowerCase() as Address.Address)

      expect(retrieved).toBeDefined()
      expect(retrieved?.imageHash).toBe(TEST_IMAGE_HASH)
    })

    it('should normalize hex values to lowercase', async () => {
      const upperHex = TEST_IMAGE_HASH.toUpperCase() as Hex.Hex
      const config = { test: 'data' } as any

      await store.saveConfig(upperHex, config)
      const retrieved = await store.loadConfig(TEST_IMAGE_HASH.toLowerCase() as Hex.Hex)

      expect(retrieved).toEqual(config)
    })
  })

  describe('signer subdigest tracking', () => {
    it('should track subdigests for regular signers', async () => {
      const signature = { type: 'hash', r: 123n, s: 456n, yParity: 0 } as any
      const subdigest2 = Hex.from('0x1111111111111111111111111111111111111111111111111111111111111111')

      await store.saveSignatureOfSubdigest(TEST_ADDRESS, TEST_SUBDIGEST, signature)
      await store.saveSignatureOfSubdigest(TEST_ADDRESS, subdigest2, signature)

      const subdigests = await store.loadSubdigestsOfSigner(TEST_ADDRESS)

      expect(subdigests).toHaveLength(2)
      expect(subdigests).toContain(TEST_SUBDIGEST.toLowerCase())
      expect(subdigests).toContain(subdigest2.toLowerCase())
    })

    it('should track subdigests for sapient signers', async () => {
      const signature = { type: 'sapient', address: TEST_ADDRESS, data: '0x123' } as any

      await store.saveSapientSignatureOfSubdigest(TEST_ADDRESS, TEST_SUBDIGEST, TEST_IMAGE_HASH, signature)

      const subdigests = await store.loadSubdigestsOfSapientSigner(TEST_ADDRESS, TEST_IMAGE_HASH)

      expect(subdigests).toHaveLength(1)
      expect(subdigests).toContain(TEST_SUBDIGEST.toLowerCase())
    })

    it('should return empty arrays for non-existent signers', async () => {
      const regularSubdigests = await store.loadSubdigestsOfSigner(TEST_ADDRESS)
      const sapientSubdigests = await store.loadSubdigestsOfSapientSigner(TEST_ADDRESS, TEST_IMAGE_HASH)

      expect(regularSubdigests).toEqual([])
      expect(sapientSubdigests).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('should handle overwriting data', async () => {
      const config1 = { value: 1 } as any
      const config2 = { value: 2 } as any

      await store.saveConfig(TEST_IMAGE_HASH, config1)
      await store.saveConfig(TEST_IMAGE_HASH, config2)

      const retrieved = await store.loadConfig(TEST_IMAGE_HASH)
      expect(retrieved).toEqual(config2)
    })

    it('should handle concurrent operations', async () => {
      const promises: Promise<void>[] = []

      for (let i = 0; i < 10; i++) {
        const imageHash = `0x${i.toString().padStart(64, '0')}` as Hex.Hex
        const config = { value: i } as any
        promises.push(store.saveConfig(imageHash, config))
      }

      await Promise.all(promises)

      // Verify all saves completed correctly
      for (let i = 0; i < 10; i++) {
        const imageHash = `0x${i.toString().padStart(64, '0')}` as Hex.Hex
        const retrieved = await store.loadConfig(imageHash)
        expect((retrieved as any)?.value).toBe(i)
      }
    })

    it('should handle special characters and large values', async () => {
      const specialData = {
        content: {
          emoji: '🎉📝✨',
          large: 999999999999999999999999999999n,
          null: null,
          undefined: undefined,
        } as any,
        chainId: Network.ChainId.MAINNET,
        wallet: TEST_ADDRESS,
      }

      await store.savePayloadOfSubdigest(TEST_SUBDIGEST, specialData)
      const retrieved = await store.loadPayloadOfSubdigest(TEST_SUBDIGEST)

      expect(retrieved).toEqual(specialData)
    })
  })
})
