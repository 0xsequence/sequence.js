import { Address } from 'ox'
import { describe, expect, it } from 'vitest'

import {
  extractChainID,
  extractSupportedPreconditions,
  extractNativeBalancePreconditions,
  extractERC20BalancePreconditions,
} from '../../src/preconditions/selectors.js'
import { TransactionPrecondition } from '../../src/preconditions/codec.js'
import {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc721OwnershipPrecondition,
} from '../../src/preconditions/types.js'
import { Network } from '@0xsequence/wallet-primitives'

// Test addresses (strings for TransactionPrecondition)
const TEST_ADDRESS = '0x1234567890123456789012345678901234567890'
const TOKEN_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function nativePrecondition(overrides: Partial<TransactionPrecondition> = {}): TransactionPrecondition {
  return {
    type: 'native-balance',
    chainId: Network.ChainId.MAINNET,
    ownerAddress: TEST_ADDRESS,
    tokenAddress: ZERO_ADDRESS,
    minAmount: 1000000000000000000n,
    ...overrides,
  }
}

function erc20Precondition(overrides: Partial<TransactionPrecondition> = {}): TransactionPrecondition {
  return {
    type: 'erc20-balance',
    chainId: Network.ChainId.MAINNET,
    ownerAddress: TEST_ADDRESS,
    tokenAddress: TOKEN_ADDRESS,
    minAmount: 1000000n,
    ...overrides,
  }
}

function erc721OwnershipPrecondition(overrides: Partial<TransactionPrecondition> = {}): TransactionPrecondition {
  return {
    type: 'erc721-ownership',
    chainId: Network.ChainId.MAINNET,
    ownerAddress: TEST_ADDRESS,
    tokenAddress: TOKEN_ADDRESS,
    minAmount: 0n,
    ...overrides,
  }
}

describe('Preconditions Selectors', () => {
  describe('extractChainID', () => {
    it('should extract chainID from valid precondition data', () => {
      const precondition = nativePrecondition({ chainId: Network.ChainId.MAINNET })
      const chainId = extractChainID(precondition)
      expect(chainId).toBe(Network.ChainId.MAINNET)
    })

    it('should extract large chainID values', () => {
      const precondition = nativePrecondition({ chainId: Network.ChainId.ARBITRUM })
      const chainId = extractChainID(precondition)
      expect(chainId).toBe(Network.ChainId.ARBITRUM)
    })

    it('should return undefined when chainID is not present', () => {
      const precondition = { type: 'native-balance', ownerAddress: TEST_ADDRESS, tokenAddress: ZERO_ADDRESS, minAmount: 1n } as TransactionPrecondition
      const chainId = extractChainID(precondition)
      expect(chainId).toBeUndefined()
    })

    it('should return undefined for null/undefined precondition', () => {
      expect(extractChainID(null as unknown as TransactionPrecondition)).toBeUndefined()
      expect(extractChainID(undefined as unknown as TransactionPrecondition)).toBeUndefined()
    })

    it('should handle chainID with value 0', () => {
      const precondition = nativePrecondition({ chainId: 0 })
      const chainId = extractChainID(precondition)
      expect(chainId).toBe(0)
    })
  })

  describe('extractSupportedPreconditions', () => {
    it('should extract valid preconditions', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition(),
        erc20Precondition(),
      ]

      const results = extractSupportedPreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[1]).toBeInstanceOf(Erc20BalancePrecondition)
    })

    it('should filter out invalid preconditions', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition(),
        { type: 'unknown-type', chainId: 1, ownerAddress: TEST_ADDRESS, tokenAddress: ZERO_ADDRESS, minAmount: 0n } as TransactionPrecondition,
        nativePrecondition({ ownerAddress: '' }),
      ]

      const results = extractSupportedPreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
    })

    it('should return empty array for null/undefined input', () => {
      expect(extractSupportedPreconditions(null as unknown as TransactionPrecondition[])).toEqual([])
      expect(extractSupportedPreconditions(undefined as unknown as TransactionPrecondition[])).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const results = extractSupportedPreconditions([])
      expect(results).toEqual([])
    })

    it('should handle mixed valid and invalid preconditions', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition(),
        erc721OwnershipPrecondition(),
        { type: 'invalid-type', chainId: 1, ownerAddress: TEST_ADDRESS, tokenAddress: ZERO_ADDRESS, minAmount: 0n } as TransactionPrecondition,
      ]

      const results = extractSupportedPreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[1]).toBeInstanceOf(Erc721OwnershipPrecondition)
    })
  })

  describe('extractNativeBalancePreconditions', () => {
    it('should extract only native balance preconditions', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition({ minAmount: 1000000000000000000n }),
        erc20Precondition(),
        nativePrecondition({ minAmount: 2000000000000000000n }),
      ]

      const results = extractNativeBalancePreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[1]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[0].min).toBe(1000000000000000000n)
      expect(results[1].min).toBe(2000000000000000000n)
    })

    it('should return empty array when no native balance preconditions exist', () => {
      const intents: TransactionPrecondition[] = [
        erc20Precondition(),
        erc721OwnershipPrecondition(),
      ]

      const results = extractNativeBalancePreconditions(intents)
      expect(results).toEqual([])
    })

    it('should return empty array for null/undefined input', () => {
      expect(extractNativeBalancePreconditions(null as unknown as TransactionPrecondition[])).toEqual([])
      expect(extractNativeBalancePreconditions(undefined as unknown as TransactionPrecondition[])).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const results = extractNativeBalancePreconditions([])
      expect(results).toEqual([])
    })

    it('should filter out invalid native balance preconditions', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition({ minAmount: 1000000000000000000n }),
        nativePrecondition({ ownerAddress: '' }),
      ]

      const results = extractNativeBalancePreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
      expect(results[0].min).toBe(1000000000000000000n)
    })
  })

  describe('extractERC20BalancePreconditions', () => {
    it('should extract only ERC20 balance preconditions', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition(),
        erc20Precondition({ minAmount: 1000000n }),
        erc20Precondition({ minAmount: 2000000n }),
      ]

      const results = extractERC20BalancePreconditions(intents)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(Erc20BalancePrecondition)
      expect(results[1]).toBeInstanceOf(Erc20BalancePrecondition)
      expect(results[0].min).toBe(1000000n)
      expect(results[1].min).toBe(2000000n)
      expect(results[0].token).toEqual(Address.from(TOKEN_ADDRESS))
      expect(results[1].token).toEqual(Address.from(TOKEN_ADDRESS))
    })

    it('should return empty array when no ERC20 balance preconditions exist', () => {
      const intents: TransactionPrecondition[] = [
        nativePrecondition(),
        erc721OwnershipPrecondition(),
      ]

      const results = extractERC20BalancePreconditions(intents)
      expect(results).toEqual([])
    })

    it('should return empty array for null/undefined input', () => {
      expect(extractERC20BalancePreconditions(null as unknown as TransactionPrecondition[])).toEqual([])
      expect(extractERC20BalancePreconditions(undefined as unknown as TransactionPrecondition[])).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const results = extractERC20BalancePreconditions([])
      expect(results).toEqual([])
    })

    it('should filter out invalid ERC20 balance preconditions', () => {
      const intents: TransactionPrecondition[] = [
        erc20Precondition({ minAmount: 1000000n }),
        erc20Precondition({ tokenAddress: '' }),
      ]

      const results = extractERC20BalancePreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(Erc20BalancePrecondition)
      expect(results[0].min).toBe(1000000n)
      expect(results[0].token).toEqual(Address.from(TOKEN_ADDRESS))
    })
  })
})
