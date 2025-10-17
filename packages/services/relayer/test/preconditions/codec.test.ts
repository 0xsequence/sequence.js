import { Address } from 'ox'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  decodePrecondition,
  decodePreconditions,
  encodePrecondition,
  IntentPrecondition,
} from '../../src/preconditions/codec.js'
import {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
} from '../../src/preconditions/types.js'

// Test addresses
const TEST_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TOKEN_ADDRESS = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const OPERATOR_ADDRESS = Address.from('0x9876543210987654321098765432109876543210')

describe('Preconditions Codec', () => {
  // Mock console.warn to test error logging
  const originalWarn = console.warn
  beforeEach(() => {
    console.warn = vi.fn()
  })
  afterEach(() => {
    console.warn = originalWarn
  })

  describe('decodePrecondition', () => {
    it('should return undefined for null/undefined input', () => {
      expect(decodePrecondition(null as any)).toBeUndefined()
      expect(decodePrecondition(undefined as any)).toBeUndefined()
    })

    it('should decode native balance precondition with min and max', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          min: '1000000000000000000',
          max: '2000000000000000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(NativeBalancePrecondition)

      const precondition = result as NativeBalancePrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.min).toBe(1000000000000000000n)
      expect(precondition.max).toBe(2000000000000000000n)
      expect(precondition.type()).toBe('native-balance')
    })

    it('should decode native balance precondition with only min', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          min: '1000000000000000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(NativeBalancePrecondition)

      const precondition = result as NativeBalancePrecondition
      expect(precondition.min).toBe(1000000000000000000n)
      expect(precondition.max).toBeUndefined()
    })

    it('should decode native balance precondition with only max', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          max: '2000000000000000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(NativeBalancePrecondition)

      const precondition = result as NativeBalancePrecondition
      expect(precondition.min).toBeUndefined()
      expect(precondition.max).toBe(2000000000000000000n)
    })

    it('should decode ERC20 balance precondition', () => {
      const intent: IntentPrecondition = {
        type: 'erc20-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          min: '1000000',
          max: '2000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc20BalancePrecondition)

      const precondition = result as Erc20BalancePrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.min).toBe(1000000n)
      expect(precondition.max).toBe(2000000n)
    })

    it('should decode ERC20 approval precondition', () => {
      const intent: IntentPrecondition = {
        type: 'erc20-approval',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          operator: OPERATOR_ADDRESS,
          min: '1000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc20ApprovalPrecondition)

      const precondition = result as Erc20ApprovalPrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.operator).toBe(OPERATOR_ADDRESS)
      expect(precondition.min).toBe(1000000n)
    })

    it('should decode ERC721 ownership precondition', () => {
      const intent: IntentPrecondition = {
        type: 'erc721-ownership',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          tokenId: '123',
          owned: true,
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc721OwnershipPrecondition)

      const precondition = result as Erc721OwnershipPrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.owned).toBe(true)
    })

    it('should decode ERC721 ownership precondition without owned flag', () => {
      const intent: IntentPrecondition = {
        type: 'erc721-ownership',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          tokenId: '123',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc721OwnershipPrecondition)

      const precondition = result as Erc721OwnershipPrecondition
      expect(precondition.owned).toBeUndefined()
    })

    it('should decode ERC721 approval precondition', () => {
      const intent: IntentPrecondition = {
        type: 'erc721-approval',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          tokenId: '123',
          operator: OPERATOR_ADDRESS,
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc721ApprovalPrecondition)

      const precondition = result as Erc721ApprovalPrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.operator).toBe(OPERATOR_ADDRESS)
    })

    it('should decode ERC1155 balance precondition', () => {
      const intent: IntentPrecondition = {
        type: 'erc1155-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          tokenId: '123',
          min: '1000000',
          max: '2000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc1155BalancePrecondition)

      const precondition = result as Erc1155BalancePrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.min).toBe(1000000n)
      expect(precondition.max).toBe(2000000n)
    })

    it('should decode ERC1155 approval precondition', () => {
      const intent: IntentPrecondition = {
        type: 'erc1155-approval',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          token: TOKEN_ADDRESS,
          tokenId: '123',
          operator: OPERATOR_ADDRESS,
          min: '1000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeInstanceOf(Erc1155ApprovalPrecondition)

      const precondition = result as Erc1155ApprovalPrecondition
      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.operator).toBe(OPERATOR_ADDRESS)
      expect(precondition.min).toBe(1000000n)
    })

    it('should return undefined for unknown precondition type', () => {
      const intent: IntentPrecondition = {
        type: 'unknown-type',
        data: JSON.stringify({ address: TEST_ADDRESS }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeUndefined()
    })

    it('should return undefined and log warning for invalid JSON', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: 'invalid json',
      }

      const result = decodePrecondition(intent)
      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to decode precondition'))
    })

    it('should return undefined and log warning for invalid precondition', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          // Missing required address field
          min: '1000000000000000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to decode precondition'))
    })

    it('should handle malformed addresses gracefully', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: 'invalid-address',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to decode precondition'))
    })

    it('should handle malformed BigInt values gracefully', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          min: 'not-a-number',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to decode precondition'))
    })

    it('should return undefined and log warning for precondition that fails validation', () => {
      const intent: IntentPrecondition = {
        type: 'native-balance',
        data: JSON.stringify({
          address: TEST_ADDRESS,
          min: '2000000000000000000', // min > max should fail validation
          max: '1000000000000000000',
        }),
      }

      const result = decodePrecondition(intent)
      expect(result).toBeUndefined()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid precondition'))
    })
  })

  describe('decodePreconditions', () => {
    it('should decode multiple preconditions', () => {
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

      const results = decodePreconditions(intents)
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
          type: 'invalid-type',
          data: JSON.stringify({ address: TEST_ADDRESS }),
        },
        {
          type: 'native-balance',
          data: 'invalid json',
        },
      ]

      const results = decodePreconditions(intents)
      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(NativeBalancePrecondition)
    })

    it('should return empty array for empty input', () => {
      const results = decodePreconditions([])
      expect(results).toEqual([])
    })
  })

  describe('encodePrecondition', () => {
    it('should encode native balance precondition with min and max', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, 1000000000000000000n, 2000000000000000000n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.min).toBe('1000000000000000000')
      expect(data.max).toBe('2000000000000000000')
    })

    it('should encode native balance precondition with only min', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, 1000000000000000000n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.min).toBe('1000000000000000000')
      expect(data.max).toBeUndefined()
    })

    it('should encode native balance precondition with only max', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, undefined, 2000000000000000000n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.min).toBeUndefined()
      expect(data.max).toBe('2000000000000000000')
    })

    it('should encode ERC20 balance precondition', () => {
      const precondition = new Erc20BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 1000000n, 2000000n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.min).toBe('1000000')
      expect(data.max).toBe('2000000')
    })

    it('should encode ERC20 approval precondition', () => {
      const precondition = new Erc20ApprovalPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, OPERATOR_ADDRESS, 1000000n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.operator).toBe(OPERATOR_ADDRESS)
      expect(data.min).toBe('1000000')
    })

    it('should encode ERC721 ownership precondition', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, true)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.tokenId).toBe('123')
      expect(data.owned).toBe(true)
    })

    it('should encode ERC721 ownership precondition without owned flag', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.tokenId).toBe('123')
      expect(data.owned).toBeUndefined()
    })

    it('should encode ERC721 approval precondition', () => {
      const precondition = new Erc721ApprovalPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, OPERATOR_ADDRESS)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.tokenId).toBe('123')
      expect(data.operator).toBe(OPERATOR_ADDRESS)
    })

    it('should encode ERC1155 balance precondition', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, 1000000n, 2000000n)

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.tokenId).toBe('123')
      expect(data.min).toBe('1000000')
      expect(data.max).toBe('2000000')
    })

    it('should encode ERC1155 approval precondition', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        123n,
        OPERATOR_ADDRESS,
        1000000n,
      )

      const encoded = encodePrecondition(precondition)
      const data = JSON.parse(encoded)

      expect(data.address).toBe(TEST_ADDRESS)
      expect(data.token).toBe(TOKEN_ADDRESS)
      expect(data.tokenId).toBe('123')
      expect(data.operator).toBe(OPERATOR_ADDRESS)
      expect(data.min).toBe('1000000')
    })
  })

  describe('roundtrip encoding/decoding', () => {
    it('should roundtrip native balance precondition', () => {
      const original = new NativeBalancePrecondition(TEST_ADDRESS, 1000000000000000000n, 2000000000000000000n)

      const encoded = encodePrecondition(original)
      const intent: IntentPrecondition = {
        type: original.type(),
        data: encoded,
      }
      const decoded = decodePrecondition(intent) as NativeBalancePrecondition

      expect(decoded.address).toBe(original.address)
      expect(decoded.min).toBe(original.min)
      expect(decoded.max).toBe(original.max)
      expect(decoded.type()).toBe(original.type())
    })

    it('should roundtrip ERC20 balance precondition', () => {
      const original = new Erc20BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 1000000n, 2000000n)

      const encoded = encodePrecondition(original)
      const intent: IntentPrecondition = {
        type: original.type(),
        data: encoded,
      }
      const decoded = decodePrecondition(intent) as Erc20BalancePrecondition

      expect(decoded.address).toBe(original.address)
      expect(decoded.token).toBe(original.token)
      expect(decoded.min).toBe(original.min)
      expect(decoded.max).toBe(original.max)
      expect(decoded.type()).toBe(original.type())
    })

    it('should roundtrip ERC721 ownership precondition', () => {
      const original = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, true)

      const encoded = encodePrecondition(original)
      const intent: IntentPrecondition = {
        type: original.type(),
        data: encoded,
      }
      const decoded = decodePrecondition(intent) as Erc721OwnershipPrecondition

      expect(decoded.address).toBe(original.address)
      expect(decoded.token).toBe(original.token)
      expect(decoded.tokenId).toBe(original.tokenId)
      expect(decoded.owned).toBe(original.owned)
      expect(decoded.type()).toBe(original.type())
    })
  })
})
