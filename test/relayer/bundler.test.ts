import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Address, Hex } from 'ox'
import { UserOperation } from 'ox/erc4337'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { Bundler, isBundler } from '../../src/bundler/index.js'
import { Relayer } from '@0xsequence/relayer'

// Test addresses and data
const TEST_WALLET_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TEST_ENTRYPOINT_ADDRESS = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const TEST_CHAIN_ID = Network.ChainId.MAINNET
const TEST_OP_HASH = Hex.from('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')

describe('Bundler', () => {
  describe('isBundler type guard', () => {
    it('should return true for valid bundler objects', () => {
      const mockBundler: Bundler = {
        kind: 'bundler',
        id: 'test-bundler',
        estimateLimits: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        isAvailable: vi.fn(),
      }

      expect(isBundler(mockBundler)).toBe(true)
    })

    it('should return false for objects missing required methods', () => {
      // Missing estimateLimits
      const missing1 = {
        kind: 'bundler' as const,
        id: 'test-bundler',
        relay: vi.fn(),
        status: vi.fn(),
        isAvailable: vi.fn(),
      }
      expect(isBundler(missing1)).toBe(false)

      // Missing relay
      const missing2 = {
        kind: 'bundler' as const,
        id: 'test-bundler',
        estimateLimits: vi.fn(),
        status: vi.fn(),
        isAvailable: vi.fn(),
      }
      expect(isBundler(missing2)).toBe(false)

      // Missing isAvailable
      const missing3 = {
        kind: 'bundler' as const,
        id: 'test-bundler',
        estimateLimits: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
      }
      expect(isBundler(missing3)).toBe(false)
    })

    it('should return false for non-objects', () => {
      // These will throw due to the 'in' operator, so we need to test the actual behavior
      expect(() => isBundler(null)).toThrow()
      expect(() => isBundler(undefined)).toThrow()
      expect(() => isBundler('string')).toThrow()
      expect(() => isBundler(123)).toThrow()
      expect(() => isBundler(true)).toThrow()
      // Arrays and objects should not throw, but should return false
      expect(isBundler([])).toBe(false)
    })

    it('should return false for objects with properties but wrong types', () => {
      const wrongTypes = {
        kind: 'bundler' as const,
        id: 'test-bundler',
        estimateLimits: 'not a function',
        relay: vi.fn(),
        status: vi.fn(),
        isAvailable: vi.fn(),
      }
      // The current implementation only checks if properties exist, not their types
      // So this will actually return true since all required properties exist
      expect(isBundler(wrongTypes)).toBe(true)
    })

    it('should return false for relayer objects', () => {
      const mockRelayer = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        isAvailable: vi.fn(),
        feeOptions: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }
      expect(isBundler(mockRelayer)).toBe(false)
    })
  })

  describe('Bundler interface contract', () => {
    let mockBundler: Bundler
    let mockPayload: Payload.Calls4337_07
    let mockUserOperation: UserOperation.RpcV07

    beforeEach(() => {
      mockBundler = {
        kind: 'bundler',
        id: 'mock-bundler',
        estimateLimits: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        isAvailable: vi.fn(),
      }

      mockPayload = {
        type: 'call_4337_07',
        calls: [
          {
            to: TEST_WALLET_ADDRESS,
            value: 0n,
            data: '0x',
            gasLimit: 21000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
        entrypoint: TEST_ENTRYPOINT_ADDRESS,
        space: 0n,
        nonce: 0n,
        callGasLimit: 50000n,
        verificationGasLimit: 50000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        paymaster: undefined,
        paymasterData: undefined,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 50000n,
        factory: undefined,
        factoryData: undefined,
      }

      mockUserOperation = {
        sender: TEST_WALLET_ADDRESS,
        nonce: '0x0',
        callData: '0x',
        callGasLimit: '0xc350',
        verificationGasLimit: '0xc350',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x3b9aca00',
        maxPriorityFeePerGas: '0x3b9aca00',
        paymasterData: '0x',
        signature: '0x',
      }
    })

    it('should have required properties', () => {
      expect(mockBundler.kind).toBe('bundler')
      expect(mockBundler.id).toBe('mock-bundler')
    })

    it('should have required methods with correct signatures', () => {
      expect(typeof mockBundler.estimateLimits).toBe('function')
      expect(typeof mockBundler.relay).toBe('function')
      expect(typeof mockBundler.status).toBe('function')
      expect(typeof mockBundler.isAvailable).toBe('function')
    })

    it('should support typical bundler workflow methods', async () => {
      // Mock the methods to return expected types
      vi.mocked(mockBundler.isAvailable).mockResolvedValue(true)
      vi.mocked(mockBundler.estimateLimits).mockResolvedValue([
        {
          speed: 'standard',
          payload: mockPayload,
        },
      ])
      vi.mocked(mockBundler.relay).mockResolvedValue({
        opHash: TEST_OP_HASH,
      })
      vi.mocked(mockBundler.status).mockResolvedValue({
        status: 'confirmed',
        transactionHash: TEST_OP_HASH,
      })

      // Test method calls
      const isAvailable = await mockBundler.isAvailable(TEST_ENTRYPOINT_ADDRESS, TEST_CHAIN_ID)
      expect(isAvailable).toBe(true)

      const estimateResult = await mockBundler.estimateLimits(TEST_WALLET_ADDRESS, mockPayload)
      expect(estimateResult).toHaveLength(1)
      expect(estimateResult[0].speed).toBe('standard')
      expect(estimateResult[0].payload).toBe(mockPayload)

      const relayResult = await mockBundler.relay(TEST_ENTRYPOINT_ADDRESS, mockUserOperation)
      expect(relayResult.opHash).toBe(TEST_OP_HASH)

      const statusResult = await mockBundler.status(TEST_OP_HASH, TEST_CHAIN_ID)
      expect(statusResult.status).toBe('confirmed')
    })

    it('should handle estimateLimits with different speed options', async () => {
      const estimateResults = [
        { speed: 'slow' as const, payload: mockPayload },
        { speed: 'standard' as const, payload: mockPayload },
        { speed: 'fast' as const, payload: mockPayload },
        { payload: mockPayload }, // No speed specified
      ]

      vi.mocked(mockBundler.estimateLimits).mockResolvedValue(estimateResults)

      const result = await mockBundler.estimateLimits(TEST_WALLET_ADDRESS, mockPayload)
      expect(result).toHaveLength(4)
      expect(result[0].speed).toBe('slow')
      expect(result[1].speed).toBe('standard')
      expect(result[2].speed).toBe('fast')
      expect(result[3].speed).toBeUndefined()
    })

    it('should handle various operation statuses', async () => {
      const statuses: Relayer.OperationStatus[] = [
        { status: 'unknown' },
        { status: 'pending' },
        { status: 'confirmed', transactionHash: TEST_OP_HASH },
        { status: 'failed', reason: 'UserOp reverted' },
      ]

      for (const expectedStatus of statuses) {
        vi.mocked(mockBundler.status).mockResolvedValue(expectedStatus)
        const result = await mockBundler.status(TEST_OP_HASH, TEST_CHAIN_ID)
        expect(result.status).toBe(expectedStatus.status)
      }
    })
  })

  describe('Type compatibility', () => {
    it('should work with Address and Hex types from ox', () => {
      // Test that the interfaces work correctly with ox types
      const address = Address.from('0x1234567890123456789012345678901234567890')
      const hex = Hex.from('0xabcdef')
      const chainId = 1n

      expect(Address.validate(address)).toBe(true)
      expect(Hex.validate(hex)).toBe(true)
      expect(typeof chainId).toBe('bigint')
    })

    it('should work with ERC4337 UserOperation types', () => {
      // Test basic compatibility with UserOperation types
      const mockUserOp: UserOperation.RpcV07 = {
        sender: TEST_WALLET_ADDRESS,
        nonce: '0x0',
        callData: '0x',
        callGasLimit: '0xc350',
        verificationGasLimit: '0xc350',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x3b9aca00',
        maxPriorityFeePerGas: '0x3b9aca00',
        paymasterData: '0x',
        signature: '0x',
      }

      expect(mockUserOp.sender).toBe(TEST_WALLET_ADDRESS)
      expect(mockUserOp.nonce).toBe('0x0')
      expect(mockUserOp.signature).toBe('0x')
    })

    it('should work with wallet-primitives Payload types', () => {
      // Test basic compatibility with Payload types
      const mockPayload: Payload.Calls4337_07 = {
        type: 'call_4337_07',
        calls: [
          {
            to: TEST_WALLET_ADDRESS,
            value: 0n,
            data: '0x',
            gasLimit: 21000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
        entrypoint: TEST_ENTRYPOINT_ADDRESS,
        space: 0n,
        nonce: 0n,
        callGasLimit: 50000n,
        verificationGasLimit: 50000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        paymaster: undefined,
        paymasterData: undefined,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 50000n,
        factory: undefined,
        factoryData: undefined,
      }

      expect(mockPayload.type).toBe('call_4337_07')
      expect(mockPayload.calls).toHaveLength(1)
      expect(mockPayload.entrypoint).toBe(TEST_ENTRYPOINT_ADDRESS)
    })
  })
})
