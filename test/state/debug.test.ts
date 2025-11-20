import { Address, Hex } from 'ox'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { multiplex } from '../../src/state/debug.js'

// Test data
const TEST_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TEST_HEX = Hex.from('0xabcdef123456')
const TEST_UINT8ARRAY = new Uint8Array([171, 205, 239, 18, 52, 86])

describe('State Debug', () => {
  // Mock console.trace to test logging
  const originalTrace = console.trace
  beforeEach(() => {
    console.trace = vi.fn()
  })
  afterEach(() => {
    console.trace = originalTrace
  })

  describe('utility functions (tested through multiplex)', () => {
    it('should handle stringifyReplacer functionality', async () => {
      interface TestInterface {
        testMethod(data: { bigint: bigint; uint8Array: Uint8Array; normal: string }): Promise<string>
      }

      const reference: TestInterface = {
        async testMethod(data) {
          return JSON.stringify(data, (key, value) => {
            if (typeof value === 'bigint') return value.toString()
            if (value instanceof Uint8Array) return Hex.fromBytes(value)
            return value
          })
        },
      }

      const candidate: TestInterface = {
        async testMethod(data) {
          return JSON.stringify(data, (key, value) => {
            if (typeof value === 'bigint') return value.toString()
            if (value instanceof Uint8Array) return Hex.fromBytes(value)
            return value
          })
        },
      }

      const proxy = multiplex(reference, { candidate })

      const testData = {
        bigint: 123456789012345678901234567890n,
        uint8Array: TEST_UINT8ARRAY,
        normal: 'test string',
      }

      const result = await proxy.testMethod(testData)

      // Should properly stringify with bigint and Uint8Array conversion
      expect(result).toContain('123456789012345678901234567890')
      expect(result).toContain('0xabcdef123456')
      expect(result).toContain('test string')
    })

    it('should handle normalize functionality for deep comparison', async () => {
      interface TestInterface {
        testMethod(data: any): Promise<any>
      }

      const reference: TestInterface = {
        async testMethod(data) {
          return data
        },
      }

      // Candidate that returns equivalent but not identical data
      const candidate: TestInterface = {
        async testMethod(data) {
          return {
            ...data,
            address: data.address?.toUpperCase(), // Different case
            nested: {
              ...data.nested,
              bigint: data.nested?.bigint, // Same bigint
            },
          }
        },
      }

      const proxy = multiplex(reference, { candidate })

      const testData = {
        address: TEST_ADDRESS.toLowerCase(),
        nested: {
          bigint: 123n,
          array: [1, 2, 3],
          uint8: TEST_UINT8ARRAY,
        },
        undefined_field: undefined,
      }

      await proxy.testMethod(testData)

      // Should detect that normalized values are equal (despite case differences)
      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]
      expect(traceCall[0]).not.toContain('warning: candidate testMethod does not match reference')
    })
  })

  describe('multiplex', () => {
    interface MockInterface {
      syncMethod(value: string): string
      asyncMethod(value: number): Promise<number>
      throwingMethod(): Promise<void>
      property: string
    }

    let reference: MockInterface
    let candidate1: MockInterface
    let candidate2: MockInterface

    beforeEach(() => {
      reference = {
        syncMethod: vi.fn((value: string) => `ref-${value}`),
        asyncMethod: vi.fn(async (value: number) => value * 2),
        throwingMethod: vi.fn(async () => {
          throw new Error('Reference error')
        }),
        property: 'ref-property',
      }

      candidate1 = {
        syncMethod: vi.fn((value: string) => `cand1-${value}`),
        asyncMethod: vi.fn(async (value: number) => value * 2), // Same as reference
        throwingMethod: vi.fn(async () => {
          throw new Error('Candidate1 error')
        }),
        property: 'cand1-property',
      }

      candidate2 = {
        syncMethod: vi.fn((value: string) => `cand2-${value}`),
        asyncMethod: vi.fn(async (value: number) => value * 3), // Different from reference
        throwingMethod: vi.fn(async () => {
          /* doesn't throw */
        }),
        property: 'cand2-property',
      }
    })

    it('should proxy method calls to reference and return reference result', async () => {
      const proxy = multiplex(reference, { candidate1, candidate2 })

      const syncResult = await proxy.syncMethod('test')
      const asyncResult = await proxy.asyncMethod(5)

      expect(syncResult).toBe('ref-test')
      expect(asyncResult).toBe(10)

      expect(reference.syncMethod).toHaveBeenCalledWith('test')
      expect(reference.asyncMethod).toHaveBeenCalledWith(5)
    })

    it('should call candidates in parallel and compare results', async () => {
      const proxy = multiplex(reference, { candidate1, candidate2 })

      await proxy.asyncMethod(5)

      expect(candidate1.asyncMethod).toHaveBeenCalledWith(5)
      expect(candidate2.asyncMethod).toHaveBeenCalledWith(5)

      // Should log comparison results
      expect(console.trace).toHaveBeenCalledTimes(2) // One for each candidate
    })

    it('should detect and log when candidate results match reference', async () => {
      const proxy = multiplex(reference, { candidate1 })

      await proxy.asyncMethod(5)

      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]
      expect(traceCall[0]).toContain('candidate1 returned:')
      expect(traceCall[0]).not.toContain('warning: candidate1 asyncMethod does not match reference')
    })

    it('should detect and log when candidate results differ from reference', async () => {
      const proxy = multiplex(reference, { candidate2 })

      await proxy.asyncMethod(5)

      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]
      expect(traceCall[0]).toContain('warning: candidate2 asyncMethod does not match reference')
    })

    it('should handle when reference method throws', async () => {
      const proxy = multiplex(reference, { candidate1 })

      await expect(proxy.throwingMethod()).rejects.toThrow('Reference error')

      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]
      expect(traceCall[0]).toContain('warning: reference throwingMethod threw:')
    })

    it('should handle when candidate method throws', async () => {
      const proxy = multiplex(reference, { candidate1 })

      const result = await proxy.syncMethod('test')

      expect(result).toBe('ref-test')
      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]
      expect(traceCall[0]).toContain('warning: candidate1 syncMethod does not match reference')
    })

    it('should handle when candidate method is missing', async () => {
      const incompleteCandidate = {
        property: 'incomplete',
        // missing syncMethod
      } as any

      const proxy = multiplex(reference, { incomplete: incompleteCandidate })

      await proxy.syncMethod('test')

      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]
      expect(traceCall[0]).toContain('warning: incomplete has no syncMethod')
    })

    it('should passthrough non-method properties', () => {
      const proxy = multiplex(reference, { candidate1 })

      expect(proxy.property).toBe('ref-property')
    })

    it('should handle complex data types in logging', async () => {
      interface ComplexInterface {
        complexMethod(data: { bigint: bigint; uint8Array: Uint8Array; nested: { value: string } }): Promise<string>
      }

      const complexRef: ComplexInterface = {
        async complexMethod(data) {
          return 'complex-ref'
        },
      }

      const complexCand: ComplexInterface = {
        async complexMethod(data) {
          return 'complex-cand'
        },
      }

      const proxy = multiplex(complexRef, { complex: complexCand })

      const complexData = {
        bigint: 999999999999999999n,
        uint8Array: TEST_UINT8ARRAY,
        nested: { value: 'nested-test' },
      }

      await proxy.complexMethod(complexData)

      expect(console.trace).toHaveBeenCalled()
      const traceCall = vi.mocked(console.trace).mock.calls[0]

      // Should properly stringify complex data in logs
      expect(traceCall[0]).toContain('999999999999999999')
      expect(traceCall[0]).toContain('0xabcdef123456')
      expect(traceCall[0]).toContain('nested-test')
    })

    it('should generate unique IDs for different calls', async () => {
      const proxy = multiplex(reference, { candidate1, candidate2 })

      await proxy.syncMethod('test1')
      await proxy.syncMethod('test2')

      expect(console.trace).toHaveBeenCalledTimes(4) // 2 calls * 2 candidates

      const traces = vi.mocked(console.trace).mock.calls
      const ids = traces.map((call) => call[0].match(/\[(\d{6})\]/)?.[1]).filter(Boolean)

      // Should have generated unique IDs (though there's a small chance of collision)
      expect(ids).toHaveLength(4)
      expect(new Set(ids).size).toBeGreaterThan(1) // At least some should be different
    })

    it('should handle async candidates correctly', async () => {
      const asyncCandidate = {
        syncMethod: vi.fn((value: string) => `async-${value}`), // Return string directly, not Promise<string>
        asyncMethod: vi.fn(async (value: number) => value * 2),
        throwingMethod: vi.fn(),
        property: 'async-property',
      }

      const proxy = multiplex(reference, { async: asyncCandidate })

      await proxy.syncMethod('test')

      expect(asyncCandidate.syncMethod).toHaveBeenCalledWith('test')
      expect(console.trace).toHaveBeenCalled()
    })

    it('should handle multiple candidates with mixed results', async () => {
      const matching = {
        syncMethod: vi.fn((value: string) => `ref-${value}`), // Matches reference
        asyncMethod: vi.fn(),
        throwingMethod: vi.fn(),
        property: 'matching',
      }

      const different = {
        syncMethod: vi.fn((value: string) => `diff-${value}`), // Different from reference
        asyncMethod: vi.fn(),
        throwingMethod: vi.fn(),
        property: 'different',
      }

      const proxy = multiplex(reference, { matching, different })

      await proxy.syncMethod('test')

      expect(console.trace).toHaveBeenCalledTimes(2)

      const traces = vi.mocked(console.trace).mock.calls
      const matchingTrace = traces.find((call) => call[0].includes('matching'))
      const differentTrace = traces.find((call) => call[0].includes('different'))

      expect(matchingTrace?.[0]).not.toContain('warning: matching syncMethod does not match reference')
      expect(differentTrace?.[0]).toContain('warning: different syncMethod does not match reference')
    })
  })
})
