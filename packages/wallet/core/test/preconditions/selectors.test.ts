import { describe, expect, it } from 'vitest'

import {
  extractChainID,
  extractSupportedPreconditions,
  extractNativeBalancePreconditions,
  extractERC20BalancePreconditions,
} from '../../src/preconditions/selectors.js'
import { IntentPrecondition } from '../../src/preconditions/codec.js'
import {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc721OwnershipPrecondition,
} from '../../src/preconditions/types.js'
import { Address } from '@0xsequence/wallet-primitives'

// Test addresses
const TEST_ADDRESS = Address.checksum('0x1234567890123456789012345678901234567890')
const TOKEN_ADDRESS = Address.checksum('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')

describe('Preconditions Selectors', () => {
  describe('extractChainID', () => {
    it('should extract chainID from valid precondition data', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          chainID: '1',
          min: '1000000000000000000',
        }),
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBe(1n)
    })

    it('should extract large chainID values', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          chainID: '42161', // Arbitrum chainID
        }),
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBe(42161n)
    })

    it('should return undefined when chainID is not present', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          min: '1000000000000000000',
        }),
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBeUndefined()
    })

    it('should return undefined when chainID is falsy', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          chainID: '',
          min: '1000000000000000000',
        }),
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBeUndefined()
    })

    it('should return undefined when chainID is null', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          chainID: null,
          min: '1000000000000000000',
        }),
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBeUndefined()
    })

    it('should return undefined for null/undefined precondition', () => {
      expect(extractChainID(null as any)).toBeUndefined()
      expect(extractChainID(undefined as any)).toBeUndefined()
    })

    it('should return undefined for invalid JSON', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: 'invalid json',
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBeUndefined()
    })

    it('should handle chainID with value 0', () => {
      const precondition: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          chainID: '0',
        }),
      }

      const chainId = extractChainID(precondition)
      expect(chainId).toBe(0n) // chainID '0' becomes 0n bigint
    })
  })

  describe('extractSupportedPreconditions', () => {
    it('should extract valid preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            min: '1000000',
          }),
        },
      ]

      const results = extractSupportedPreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[1]).toBeInstanceOf(Erc20BalancePrecondition)
    })

    it('should filter out invalid preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'unknown-type',
          data: JSON.stringify({ address: TEST_ADDRESS }),
        },
        {
          type: 'native-balance',
          data: 'invalid json',
        },
      ]

      const results = extractSupportedPreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
    })

    it('should return empty array for null/undefined input', () => {
      expect(extractSupportedPreconditions(null as any)).toEqual([])
      expect(extractSupportedPreconditions(undefined as any)).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const results = extractSupportedPreconditions([])
      expect(results).toEqual([])
    })

    it('should handle mixed valid and invalid preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'erc721-ownership',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            tokenId: '123',
          }),
        },
        {
          type: 'invalid-type',
          data: JSON.stringify({ address: TEST_ADDRESS }),
        },
      ]

      const results = extractSupportedPreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[1]).toBeInstanceOf(Erc721OwnershipPrecondition)
    })
  })

  describe('extractNativeBalancePreconditions', () => {
    it('should extract only native balance preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            min: '1000000',
          }),
        },
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            max: '2000000000000000000',
          }),
        },
      ]

      const results = extractNativeBalancePreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[1]).toBeInstanceOf(NativeBalancePrecondition)

      // Verify the specific properties
      expect(results[0].min).toBe(1000000000000000000n)
      expect(results[1].max).toBe(2000000000000000000n)
    })

    it('should return empty array when no native balance preconditions exist', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            min: '1000000',
          }),
        },
        {
          type: 'erc721-ownership',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            tokenId: '123',
          }),
        },
      ]

      const results = extractNativeBalancePreconditions(intents)
      expect(results).toEqual([])
    })

    it('should return empty array for null/undefined input', () => {
      expect(extractNativeBalancePreconditions(null as any)).toEqual([])
      expect(extractNativeBalancePreconditions(undefined as any)).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const results = extractNativeBalancePreconditions([])
      expect(results).toEqual([])
    })

    it('should filter out invalid native balance preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'native-balance',
          data: 'invalid json', // This will be filtered out
        },
        {
          type: 'native-balance',
          data: JSON.stringify({
            // Missing address - this will be filtered out
            min: '1000000000000000000',
          }),
        },
      ]

      const results = extractNativeBalancePreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[0].min).toBe(1000000000000000000n)
    })
  })

  describe('extractERC20BalancePreconditions', () => {
    it('should extract only ERC20 balance preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            min: '1000000',
          }),
        },
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            max: '2000000',
          }),
        },
      ]

      const results = extractERC20BalancePreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(Erc20BalancePrecondition)
      expect(results[1]).toBeInstanceOf(Erc20BalancePrecondition)

      // Verify the specific properties
      expect(results[0].min).toBe(1000000n)
      expect(results[1].max).toBe(2000000n)
      expect(results[0].token).toBe(TOKEN_ADDRESS)
      expect(results[1].token).toBe(TOKEN_ADDRESS)
    })

    it('should return empty array when no ERC20 balance preconditions exist', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'native-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            min: '1000000000000000000',
          }),
        },
        {
          type: 'erc721-ownership',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            tokenId: '123',
          }),
        },
      ]

      const results = extractERC20BalancePreconditions(intents)
      expect(results).toEqual([])
    })

    it('should return empty array for null/undefined input', () => {
      expect(extractERC20BalancePreconditions(null as any)).toEqual([])
      expect(extractERC20BalancePreconditions(undefined as any)).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const results = extractERC20BalancePreconditions([])
      expect(results).toEqual([])
    })

    it('should filter out invalid ERC20 balance preconditions', () => {
      const intents: IntentPrecondition[] = [
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            token: TOKEN_ADDRESS,
            min: '1000000',
          }),
        },
        {
          type: 'erc20-balance',
          data: 'invalid json', // This will be filtered out
        },
        {
          type: 'erc20-balance',
          data: JSON.stringify({
            address: TEST_ADDRESS,
            // Missing token address - this will be filtered out
            min: '1000000',
          }),
        },
      ]

      const results = extractERC20BalancePreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(Erc20BalancePrecondition)
      expect(results[0].min).toBe(1000000n)
      expect(results[0].token).toBe(TOKEN_ADDRESS)
    })
  })
})
