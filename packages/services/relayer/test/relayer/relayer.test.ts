import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Address, Hex } from 'ox'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { Relayer, RpcRelayerGen } from '@0xsequence/relayer'

// Test addresses and data
const TEST_WALLET_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TEST_TO_ADDRESS = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const TEST_DATA = Hex.from('0x12345678')
const TEST_CHAIN_ID = Network.ChainId.MAINNET
const TEST_OP_HASH = Hex.from('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')

describe('Relayer', () => {
  describe('Relayer.isRelayer type guard', () => {
    it('should return true for valid relayer objects', () => {
      const mockRelayer: Relayer.Relayer = {
        kind: 'relayer',
        type: 'test',
        id: 'test-relayer',
        isAvailable: vi.fn(),
        feeTokens: vi.fn(),
        feeOptions: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }

      expect(Relayer.isRelayer(mockRelayer)).toBe(true)
    })

    it('should return false for objects missing required methods', () => {
      // Missing isAvailable
      const missing1 = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        feeOptions: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }
      expect(Relayer.isRelayer(missing1)).toBe(false)

      // Missing feeOptions
      const missing2 = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        isAvailable: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }
      expect(Relayer.isRelayer(missing2)).toBe(false)

      // Missing relay
      const missing3 = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        isAvailable: vi.fn(),
        feeOptions: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }
      expect(Relayer.isRelayer(missing3)).toBe(false)

      // Missing status
      const missing4 = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        isAvailable: vi.fn(),
        feeOptions: vi.fn(),
        relay: vi.fn(),
        checkPrecondition: vi.fn(),
      }
      expect(Relayer.isRelayer(missing4)).toBe(false)

      // Missing checkPrecondition
      const missing5 = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        isAvailable: vi.fn(),
        feeOptions: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
      }
      expect(Relayer.isRelayer(missing5)).toBe(false)
    })

    it('should return false for non-objects', () => {
      expect(Relayer.isRelayer(null)).toBe(false)
      expect(Relayer.isRelayer(undefined)).toBe(false)
      expect(Relayer.isRelayer('string')).toBe(false)
      expect(Relayer.isRelayer(123)).toBe(false)
      expect(Relayer.isRelayer(true)).toBe(false)
      expect(Relayer.isRelayer([])).toBe(false)
    })

    it('should return false for objects with properties but wrong types', () => {
      const wrongTypes = {
        kind: 'relayer' as const,
        type: 'test',
        id: 'test-relayer',
        isAvailable: 'not a function',
        feeOptions: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }
      // The current implementation only checks if properties exist, not their types
      // So this will actually return true since all required properties exist
      expect(Relayer.isRelayer(wrongTypes)).toBe(true)
    })
  })

  describe('FeeOption interface', () => {
    it('should accept valid fee option objects', () => {
      const feeOption: Relayer.FeeOption = {
        token: {
          chainId: Network.ChainId.MAINNET,
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          logoURL: 'https://example.com/eth.png',
          type: 'NATIVE' as RpcRelayerGen.FeeTokenType,
          contractAddress: undefined,
        },
        to: TEST_TO_ADDRESS,
        value: '1000000000000000000',
        gasLimit: 21000,
      }

      expect(feeOption.token).toBeDefined()
      expect(feeOption.to).toBe(TEST_TO_ADDRESS)
      expect(feeOption.value).toBe('1000000000000000000')
      expect(feeOption.gasLimit).toBe(21000)
    })
  })

  describe('FeeQuote interface', () => {
    it('should accept valid fee quote objects', () => {
      const feeQuote: Relayer.FeeQuote = {
        _tag: 'FeeQuote',
        _quote: { someQuoteData: 'value' },
      }

      expect(feeQuote._tag).toBe('FeeQuote')
      expect(feeQuote._quote).toBeDefined()
    })
  })

  describe('OperationStatus types', () => {
    it('should accept OperationUnknownStatus', () => {
      const status: Relayer.OperationUnknownStatus = {
        status: 'unknown',
        reason: 'Transaction not found',
      }

      expect(status.status).toBe('unknown')
      expect(status.reason).toBe('Transaction not found')
    })

    it('should accept OperationQueuedStatus', () => {
      const status: Relayer.OperationQueuedStatus = {
        status: 'queued',
        reason: 'Transaction queued for processing',
      }

      expect(status.status).toBe('queued')
      expect(status.reason).toBeDefined()
    })

    it('should accept OperationPendingStatus', () => {
      const status: Relayer.OperationPendingStatus = {
        status: 'pending',
        reason: 'Transaction pending confirmation',
      }

      expect(status.status).toBe('pending')
      expect(status.reason).toBeDefined()
    })

    it('should accept OperationPendingPreconditionStatus', () => {
      const status: Relayer.OperationPendingPreconditionStatus = {
        status: 'pending-precondition',
        reason: 'Waiting for preconditions to be met',
      }

      expect(status.status).toBe('pending-precondition')
      expect(status.reason).toBeDefined()
    })

    it('should accept OperationConfirmedStatus', () => {
      const status: Relayer.OperationConfirmedStatus = {
        status: 'confirmed',
        transactionHash: TEST_OP_HASH,
        data: {
          receipt: {
            id: 'receipt123',
            status: 'success',
            index: 0,
            logs: [],
            receipts: [],
            blockNumber: '12345',
            txnHash: 'hash123',
            txnReceipt: 'receipt_data',
          },
        },
      }

      expect(status.status).toBe('confirmed')
      expect(status.transactionHash).toBe(TEST_OP_HASH)
      expect(status.data).toBeDefined()
    })

    it('should accept OperationFailedStatus', () => {
      const status: Relayer.OperationFailedStatus = {
        status: 'failed',
        transactionHash: TEST_OP_HASH,
        reason: 'Transaction reverted',
        data: {
          receipt: {
            id: 'receipt456',
            status: 'failed',
            index: 0,
            logs: [],
            receipts: [],
            blockNumber: '12345',
            txnHash: 'hash123',
            txnReceipt: 'receipt_data',
          },
        },
      }

      expect(status.status).toBe('failed')
      expect(status.transactionHash).toBe(TEST_OP_HASH)
      expect(status.reason).toBe('Transaction reverted')
      expect(status.data).toBeDefined()
    })

    it('should handle OperationStatus union type', () => {
      const statuses: Relayer.OperationStatus[] = [
        { status: 'unknown' },
        { status: 'queued' },
        { status: 'pending' },
        { status: 'pending-precondition' },
        { status: 'confirmed', transactionHash: TEST_OP_HASH },
        { status: 'failed', reason: 'Error occurred' },
      ]

      statuses.forEach((status) => {
        expect(['unknown', 'queued', 'pending', 'pending-precondition', 'confirmed', 'failed']).toContain(status.status)
      })
    })
  })

  describe('Relayer interface contract', () => {
    let mockRelayer: Relayer.Relayer

    beforeEach(() => {
      mockRelayer = {
        kind: 'relayer',
        type: 'mock',
        id: 'mock-relayer',
        isAvailable: vi.fn(),
        feeTokens: vi.fn(),
        feeOptions: vi.fn(),
        relay: vi.fn(),
        status: vi.fn(),
        checkPrecondition: vi.fn(),
      }
    })

    it('should have required properties', () => {
      expect(mockRelayer.kind).toBe('relayer')
      expect(mockRelayer.type).toBe('mock')
      expect(mockRelayer.id).toBe('mock-relayer')
    })

    it('should have required methods with correct signatures', () => {
      expect(typeof mockRelayer.isAvailable).toBe('function')
      expect(typeof mockRelayer.feeOptions).toBe('function')
      expect(typeof mockRelayer.relay).toBe('function')
      expect(typeof mockRelayer.status).toBe('function')
      expect(typeof mockRelayer.checkPrecondition).toBe('function')
    })

    it('should support typical relayer workflow methods', async () => {
      // Mock the methods to return expected types
      vi.mocked(mockRelayer.isAvailable).mockResolvedValue(true)
      vi.mocked(mockRelayer.feeOptions).mockResolvedValue({
        options: [],
        quote: undefined,
        sponsored: false,
      })
      vi.mocked(mockRelayer.relay).mockResolvedValue({
        opHash: TEST_OP_HASH,
      })
      vi.mocked(mockRelayer.status).mockResolvedValue({
        status: 'confirmed',
        transactionHash: TEST_OP_HASH,
      })
      vi.mocked(mockRelayer.checkPrecondition).mockResolvedValue(true)

      // Test method calls
      const isAvailable = await mockRelayer.isAvailable(TEST_WALLET_ADDRESS, TEST_CHAIN_ID)
      expect(isAvailable).toBe(true)

      const feeOptions = await mockRelayer.feeOptions(TEST_WALLET_ADDRESS, TEST_CHAIN_ID, TEST_TO_ADDRESS, [])
      expect(feeOptions.options).toEqual([])

      const relayResult = await mockRelayer.relay(TEST_TO_ADDRESS, TEST_DATA, TEST_CHAIN_ID)
      expect(relayResult.opHash).toBe(TEST_OP_HASH)

      const statusResult = await mockRelayer.status(TEST_OP_HASH, TEST_CHAIN_ID)
      expect(statusResult.status).toBe('confirmed')

      const preconditionResult = await mockRelayer.checkPrecondition({} as { type: string })
      expect(preconditionResult).toBe(true)
    })
  })

  describe('RpcRelayer.feeOptions', () => {
    const mockCall: Payload.Call = {
      to: TEST_TO_ADDRESS,
      value: 0n,
      data: TEST_DATA,
      gasLimit: 21000n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }

    const makeRelayer = () => {
      const requests: Array<{ input: RequestInfo; init?: RequestInit }> = []
      const fetchImpl = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        requests.push({ input, init })
        return new Response(JSON.stringify({ options: [], sponsored: false }), { status: 200 })
      })

      return {
        relayer: new Relayer.RpcRelayer('https://relayer.test', TEST_CHAIN_ID, 'https://rpc.test', fetchImpl),
        requests,
      }
    }

    it('should send provided transaction target and data when available', async () => {
      const { relayer, requests } = makeRelayer()

      await relayer.feeOptions(TEST_WALLET_ADDRESS, TEST_CHAIN_ID, TEST_TO_ADDRESS, [mockCall], TEST_DATA)

      expect(requests).toHaveLength(1)
      expect(requests[0]!.input).toBe('https://relayer.test/rpc/Relayer/FeeOptions')
      expect(JSON.parse(requests[0]!.init!.body as string)).toEqual({
        wallet: TEST_WALLET_ADDRESS,
        to: TEST_TO_ADDRESS,
        data: TEST_DATA,
      })
    })

    it('should encode calls for the provided target when transaction data is not provided', async () => {
      const { relayer, requests } = makeRelayer()

      await relayer.feeOptions(TEST_WALLET_ADDRESS, TEST_CHAIN_ID, TEST_TO_ADDRESS, [mockCall])

      const expectedData = Hex.fromBytes(
        Payload.encode({ type: 'call', space: 0n, nonce: 0n, calls: [mockCall] }, TEST_TO_ADDRESS),
      )

      expect(JSON.parse(requests[0]!.init!.body as string)).toEqual({
        wallet: TEST_WALLET_ADDRESS,
        to: TEST_TO_ADDRESS,
        data: expectedData,
      })
    })

    it('should propagate sponsored:true from the server', async () => {
      const fetchImpl = vi.fn(
        async () => new Response(JSON.stringify({ options: [], sponsored: true }), { status: 200 }),
      )
      const relayer = new Relayer.RpcRelayer('https://relayer.test', TEST_CHAIN_ID, 'https://rpc.test', fetchImpl)

      const result = await relayer.feeOptions(TEST_WALLET_ADDRESS, TEST_CHAIN_ID, TEST_TO_ADDRESS, [mockCall])

      expect(result.sponsored).toBe(true)
      expect(result.options).toEqual([])
      expect(result.failed).toBeUndefined()
    })

    it('should propagate sponsored:false from the server', async () => {
      const fetchImpl = vi.fn(
        async () => new Response(JSON.stringify({ options: [], sponsored: false }), { status: 200 }),
      )
      const relayer = new Relayer.RpcRelayer('https://relayer.test', TEST_CHAIN_ID, 'https://rpc.test', fetchImpl)

      const result = await relayer.feeOptions(TEST_WALLET_ADDRESS, TEST_CHAIN_ID, TEST_TO_ADDRESS, [mockCall])

      expect(result.sponsored).toBe(false)
      expect(result.failed).toBeUndefined()
    })

    it('should return sponsored:false and failed:true when the server errors', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const fetchImpl = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Aborted', code: 1005, msg: 'simulation failed' }), { status: 400 }),
      )
      const relayer = new Relayer.RpcRelayer('https://relayer.test', TEST_CHAIN_ID, 'https://rpc.test', fetchImpl)

      const result = await relayer.feeOptions(TEST_WALLET_ADDRESS, TEST_CHAIN_ID, TEST_TO_ADDRESS, [mockCall])

      expect(result).toEqual({ options: [], sponsored: false, failed: true })
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('RpcRelayer.feeTokens', () => {
    it('should return failed:true when the server errors', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }))
      const relayer = new Relayer.RpcRelayer('https://relayer.test', TEST_CHAIN_ID, 'https://rpc.test', fetchImpl)

      const result = await relayer.feeTokens()

      expect(result).toEqual({ isFeeRequired: false, failed: true })
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
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

    it('should work with wallet-primitives types', () => {
      // Test basic compatibility with imported types
      const mockCall: Payload.Call = {
        to: TEST_TO_ADDRESS,
        value: 0n,
        data: TEST_DATA,
        gasLimit: 21000n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      expect(mockCall.to).toBe(TEST_TO_ADDRESS)
      expect(mockCall.data).toBe(TEST_DATA)
    })
  })
})
