import { describe, expect, it } from 'vitest'
import { Bytes } from 'ox'

import {
  minBytesFor,
  packRSY,
  unpackRSY,
  createJSONReplacer,
  createJSONReviver,
  toJSON,
  fromJSON,
} from '../src/utils.js'

describe('Utils', () => {
  describe('minBytesFor', () => {
    it('should return correct byte count for small numbers', () => {
      expect(minBytesFor(0n)).toBe(1) // 0 still needs 1 byte
      expect(minBytesFor(1n)).toBe(1)
      expect(minBytesFor(15n)).toBe(1) // 0xF
      expect(minBytesFor(16n)).toBe(1) // 0x10
      expect(minBytesFor(255n)).toBe(1) // 0xFF
    })

    it('should return correct byte count for medium numbers', () => {
      expect(minBytesFor(256n)).toBe(2) // 0x100
      expect(minBytesFor(65535n)).toBe(2) // 0xFFFF
      expect(minBytesFor(65536n)).toBe(3) // 0x10000
      expect(minBytesFor(16777215n)).toBe(3) // 0xFFFFFF
    })

    it('should return correct byte count for large numbers', () => {
      expect(minBytesFor(16777216n)).toBe(4) // 0x1000000
      expect(minBytesFor(4294967295n)).toBe(4) // 0xFFFFFFFF
      expect(minBytesFor(4294967296n)).toBe(5) // 0x100000000
    })

    it('should handle very large BigInt values', () => {
      const largeBigInt = BigInt('0x' + 'FF'.repeat(32)) // 32 bytes of 0xFF
      expect(minBytesFor(largeBigInt)).toBe(32)

      const evenLargerBigInt = BigInt('0x1' + '00'.repeat(32)) // 33 bytes
      expect(minBytesFor(evenLargerBigInt)).toBe(33)
    })

    it('should handle odd hex length numbers', () => {
      expect(minBytesFor(0xfffn)).toBe(2) // 3 hex chars -> 2 bytes
      expect(minBytesFor(0xfffffn)).toBe(3) // 5 hex chars -> 3 bytes
    })
  })

  describe('packRSY and unpackRSY (ERC-2098)', () => {
    const sampleSignature = {
      r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
      s: 0x7777777777777777777777777777777777777777777777777777777777777777n,
      yParity: 0,
    }

    const sampleSignatureOddParity = {
      r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
      s: 0x7777777777777777777777777777777777777777777777777777777777777777n,
      yParity: 1,
    }

    describe('packRSY', () => {
      it('should pack signature with even yParity correctly', () => {
        const packed = packRSY(sampleSignature)

        expect(packed.length).toBe(64) // 32 bytes r + 32 bytes s

        // Check r part (first 32 bytes)
        const rPart = packed.slice(0, 32)
        expect(Bytes.toBigInt(rPart)).toBe(sampleSignature.r)

        // Check s part (last 32 bytes) - should not have high bit set
        const sPart = packed.slice(32, 64)
        expect(sPart[0]! & 0x80).toBe(0) // High bit should be 0 for even parity
        expect(Bytes.toBigInt(sPart)).toBe(sampleSignature.s)
      })

      it('should pack signature with odd yParity correctly', () => {
        const packed = packRSY(sampleSignatureOddParity)

        expect(packed.length).toBe(64)

        // Check r part (first 32 bytes)
        const rPart = packed.slice(0, 32)
        expect(Bytes.toBigInt(rPart)).toBe(sampleSignatureOddParity.r)

        // Check s part (last 32 bytes) - should have high bit set
        const sPart = packed.slice(32, 64)
        expect(sPart[0]! & 0x80).toBe(0x80) // High bit should be 1 for odd parity
      })

      it('should handle zero values', () => {
        const zeroSignature = { r: 0n, s: 0n, yParity: 0 }
        const packed = packRSY(zeroSignature)

        expect(packed.length).toBe(64)
        expect(packed.every((byte) => byte === 0)).toBe(true)
      })

      it('should handle maximum values', () => {
        const maxSignature = {
          r: BigInt('0x' + 'FF'.repeat(32)),
          s: BigInt('0x7F' + 'FF'.repeat(31)), // Max s without high bit
          yParity: 1,
        }
        const packed = packRSY(maxSignature)

        expect(packed.length).toBe(64)
        expect(packed[0]).toBe(0xff) // First byte of r
        expect(packed[32]! & 0x80).toBe(0x80) // High bit set for odd parity
      })
    })

    describe('unpackRSY', () => {
      it('should unpack signature with even yParity correctly', () => {
        const packed = packRSY(sampleSignature)
        const unpacked = unpackRSY(packed)

        expect(unpacked.r).toBe(sampleSignature.r)
        expect(unpacked.s).toBe(sampleSignature.s)
        expect(unpacked.yParity).toBe(0)
      })

      it('should unpack signature with odd yParity correctly', () => {
        const packed = packRSY(sampleSignatureOddParity)
        const unpacked = unpackRSY(packed)

        expect(unpacked.r).toBe(sampleSignatureOddParity.r)
        expect(unpacked.s).toBe(sampleSignatureOddParity.s)
        expect(unpacked.yParity).toBe(1)
      })

      it('should handle round-trip packing/unpacking', () => {
        const original = sampleSignature
        const packed = packRSY(original)
        const unpacked = unpackRSY(packed)

        expect(unpacked).toEqual(original)
      })

      it('should handle round-trip with odd parity', () => {
        const original = sampleSignatureOddParity
        const packed = packRSY(original)
        const unpacked = unpackRSY(packed)

        expect(unpacked).toEqual(original)
      })

      it('should handle edge case where s has high bit naturally set', () => {
        const signatureWithHighS = {
          r: 0x1111111111111111111111111111111111111111111111111111111111111111n,
          s: 0x7888888888888888888888888888888888888888888888888888888888888888n, // High bit naturally set but below 0x8000...
          yParity: 0,
        }

        const packed = packRSY(signatureWithHighS)
        const unpacked = unpackRSY(packed)

        expect(unpacked.r).toBe(signatureWithHighS.r)
        expect(unpacked.s).toBe(signatureWithHighS.s)
        expect(unpacked.yParity).toBe(0)
      })

      it('should properly extract yParity when s naturally has high bit and yParity is 1', () => {
        const signatureWithHighS = {
          r: 0x1111111111111111111111111111111111111111111111111111111111111111n,
          s: 0x7888888888888888888888888888888888888888888888888888888888888888n,
          yParity: 1,
        }

        const packed = packRSY(signatureWithHighS)
        const unpacked = unpackRSY(packed)

        expect(unpacked.r).toBe(signatureWithHighS.r)
        expect(unpacked.s).toBe(signatureWithHighS.s)
        expect(unpacked.yParity).toBe(1)
      })
    })
  })

  describe('JSON utilities', () => {
    describe('createJSONReplacer', () => {
      it('should handle BigInt values', () => {
        const replacer = createJSONReplacer()
        const result = replacer('test', 123456789n)

        expect(result).toEqual({ __bigint: '0x75bcd15' })
      })

      it('should handle Uint8Array values', () => {
        const replacer = createJSONReplacer()
        const uint8Array = new Uint8Array([1, 2, 3, 255])
        const result = replacer('test', uint8Array)

        expect(result).toEqual({ __uint8array: [1, 2, 3, 255] })
      })

      it('should handle regular values unchanged', () => {
        const replacer = createJSONReplacer()

        expect(replacer('key', 'string')).toBe('string')
        expect(replacer('key', 42)).toBe(42)
        expect(replacer('key', true)).toBe(true)
        expect(replacer('key', null)).toBe(null)
        expect(replacer('key', { a: 1 })).toEqual({ a: 1 })
      })

      it('should apply custom replacer after BigInt/Uint8Array handling', () => {
        const customReplacer = (key: string, value: any) => {
          if (typeof value === 'string' && value === 'replace-me') {
            return 'replaced'
          }
          return value
        }

        const replacer = createJSONReplacer(customReplacer)

        expect(replacer('key', 'replace-me')).toBe('replaced')
        expect(replacer('key', 'normal')).toBe('normal')
        expect(replacer('key', 123n)).toEqual({ __bigint: '0x7b' })
      })

      it('should handle zero BigInt', () => {
        const replacer = createJSONReplacer()
        const result = replacer('test', 0n)

        expect(result).toEqual({ __bigint: '0x0' })
      })

      it('should handle large BigInt', () => {
        const replacer = createJSONReplacer()
        const largeBigInt = BigInt('0x' + 'FF'.repeat(32))
        const result = replacer('test', largeBigInt)

        expect(result).toEqual({ __bigint: '0x' + 'ff'.repeat(32) })
      })
    })

    describe('createJSONReviver', () => {
      it('should revive BigInt values', () => {
        const reviver = createJSONReviver()
        const result = reviver('test', { __bigint: '0x75bcd15' })

        expect(result).toBe(123456789n)
      })

      it('should revive Uint8Array values', () => {
        const reviver = createJSONReviver()
        const result = reviver('test', { __uint8array: [1, 2, 3, 255] })

        expect(result).toBeInstanceOf(Uint8Array)
        expect(Array.from(result)).toEqual([1, 2, 3, 255])
      })

      it('should handle regular values unchanged', () => {
        const reviver = createJSONReviver()

        expect(reviver('key', 'string')).toBe('string')
        expect(reviver('key', 42)).toBe(42)
        expect(reviver('key', true)).toBe(true)
        expect(reviver('key', null)).toBe(null)
        expect(reviver('key', { a: 1 })).toEqual({ a: 1 })
      })

      it('should apply custom reviver after BigInt/Uint8Array handling', () => {
        const customReviver = (key: string, value: any) => {
          if (typeof value === 'string' && value === 'revive-me') {
            return 'revived'
          }
          return value
        }

        const reviver = createJSONReviver(customReviver)

        expect(reviver('key', 'revive-me')).toBe('revived')
        expect(reviver('key', 'normal')).toBe('normal')
        expect(reviver('key', { __bigint: '0x7b' })).toBe(123n)
      })

      it('should not revive malformed BigInt objects', () => {
        const reviver = createJSONReviver()

        // Missing 0x prefix
        expect(reviver('test', { __bigint: '75bcd15' })).toEqual({ __bigint: '75bcd15' })

        // Extra properties
        expect(reviver('test', { __bigint: '0x7b', extra: 'prop' })).toEqual({ __bigint: '0x7b', extra: 'prop' })

        // Wrong type
        expect(reviver('test', { __bigint: 123 })).toEqual({ __bigint: 123 })
      })

      it('should not revive malformed Uint8Array objects', () => {
        const reviver = createJSONReviver()

        // Not an array
        expect(reviver('test', { __uint8array: 'not-array' })).toEqual({ __uint8array: 'not-array' })

        // Extra properties
        expect(reviver('test', { __uint8array: [1, 2], extra: 'prop' })).toEqual({
          __uint8array: [1, 2],
          extra: 'prop',
        })
      })

      it('should handle zero BigInt', () => {
        const reviver = createJSONReviver()
        const result = reviver('test', { __bigint: '0x0' })

        expect(result).toBe(0n)
      })

      it('should handle empty Uint8Array', () => {
        const reviver = createJSONReviver()
        const result = reviver('test', { __uint8array: [] })

        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(0)
      })
    })

    describe('toJSON', () => {
      it('should serialize simple objects', () => {
        const obj = { a: 1, b: 'test', c: true }
        const result = toJSON(obj)

        expect(result).toBe('{"a":1,"b":"test","c":true}')
      })

      it('should serialize objects with BigInt', () => {
        const obj = { value: 123456789n, name: 'test' }
        const result = toJSON(obj)

        const parsed = JSON.parse(result)
        expect(parsed.value).toEqual({ __bigint: '0x75bcd15' })
        expect(parsed.name).toBe('test')
      })

      it('should serialize objects with Uint8Array', () => {
        const obj = { data: new Uint8Array([1, 2, 3]), name: 'test' }
        const result = toJSON(obj)

        const parsed = JSON.parse(result)
        expect(parsed.data).toEqual({ __uint8array: [1, 2, 3] })
        expect(parsed.name).toBe('test')
      })

      it('should serialize complex nested objects', () => {
        const obj = {
          id: 42n,
          buffer: new Uint8Array([255, 0, 128]),
          nested: {
            value: 999n,
            array: [1, 2n, new Uint8Array([10, 20])],
          },
        }

        const result = toJSON(obj)
        const parsed = JSON.parse(result)

        expect(parsed.id).toEqual({ __bigint: '0x2a' })
        expect(parsed.buffer).toEqual({ __uint8array: [255, 0, 128] })
        expect(parsed.nested.value).toEqual({ __bigint: '0x3e7' })
        expect(parsed.nested.array[1]).toEqual({ __bigint: '0x2' })
        expect(parsed.nested.array[2]).toEqual({ __uint8array: [10, 20] })
      })

      it('should handle space parameter for pretty printing', () => {
        const obj = { a: 1, b: 2n }
        const result = toJSON(obj, null, 2)

        expect(result).toContain('\n')
        expect(result).toContain('  ')
      })

      it('should work with custom replacer function', () => {
        const customReplacer = (key: string, value: any) => {
          if (key === 'secret') return undefined
          return value
        }

        const obj = { public: 'visible', secret: 'hidden', big: 123n }
        const result = toJSON(obj, customReplacer)
        const parsed = JSON.parse(result)

        expect(parsed.public).toBe('visible')
        expect(parsed.secret).toBeUndefined()
        expect(parsed.big).toEqual({ __bigint: '0x7b' })
      })
    })

    describe('fromJSON', () => {
      it('should deserialize simple objects', () => {
        const json = '{"a":1,"b":"test","c":true}'
        const result = fromJSON(json)

        expect(result).toEqual({ a: 1, b: 'test', c: true })
      })

      it('should deserialize objects with BigInt', () => {
        const json = '{"value":{"__bigint":"0x75bcd15"},"name":"test"}'
        const result = fromJSON(json)

        expect(result.value).toBe(123456789n)
        expect(result.name).toBe('test')
      })

      it('should deserialize objects with Uint8Array', () => {
        const json = '{"data":{"__uint8array":[1,2,3]},"name":"test"}'
        const result = fromJSON(json)

        expect(result.data).toBeInstanceOf(Uint8Array)
        expect(Array.from(result.data)).toEqual([1, 2, 3])
        expect(result.name).toBe('test')
      })

      it('should handle round-trip serialization', () => {
        const original = {
          id: 42n,
          buffer: new Uint8Array([255, 0, 128]),
          nested: {
            value: 999n,
            array: [1, 2n, new Uint8Array([10, 20])],
          },
          normal: 'string',
        }

        const json = toJSON(original)
        const result = fromJSON(json)

        expect(result.id).toBe(42n)
        expect(result.buffer).toBeInstanceOf(Uint8Array)
        expect(Array.from(result.buffer)).toEqual([255, 0, 128])
        expect(result.nested.value).toBe(999n)
        expect(result.nested.array[1]).toBe(2n)
        expect(result.nested.array[2]).toBeInstanceOf(Uint8Array)
        expect(Array.from(result.nested.array[2])).toEqual([10, 20])
        expect(result.normal).toBe('string')
      })

      it('should work with custom reviver function', () => {
        const customReviver = (key: string, value: any) => {
          if (key === 'timestamp' && typeof value === 'number') {
            return new Date(value)
          }
          return value
        }

        const json = '{"timestamp":1640995200000,"big":{"__bigint":"0x7b"}}'
        const result = fromJSON(json, customReviver)

        expect(result.timestamp).toBeInstanceOf(Date)
        expect(result.big).toBe(123n)
      })

      it('should handle malformed JSON gracefully', () => {
        expect(() => fromJSON('invalid json')).toThrow()
      })
    })

    describe('Edge cases and integration', () => {
      it('should handle arrays with mixed types', () => {
        const original = [1, 'string', 42n, new Uint8Array([1, 2]), { nested: 99n }]
        const json = toJSON(original)
        const result = fromJSON(json)

        expect(result[0]).toBe(1)
        expect(result[1]).toBe('string')
        expect(result[2]).toBe(42n)
        expect(result[3]).toBeInstanceOf(Uint8Array)
        expect(Array.from(result[3])).toEqual([1, 2])
        expect(result[4].nested).toBe(99n)
      })

      it('should preserve object types after round-trip', () => {
        // Test that demonstrates how custom replacer/reviver work with the utility functions
        const original = {
          bigint: 123n,
          uint8: new Uint8Array([1, 2, 3]),
          timestamp: Date.now(), // Use a number instead of Date object for simplicity
        }

        // Test that custom transformations work correctly
        const customReplacer = (key: string, value: any) => {
          if (key === 'timestamp' && typeof value === 'number') {
            return { __timestamp: value }
          }
          return value
        }

        const customReviver = (key: string, value: any) => {
          if (value && typeof value === 'object' && '__timestamp' in value && Object.keys(value).length === 1) {
            return value.__timestamp * 2 // Transform the value to show reviver worked
          }
          return value
        }

        const replacerFunc = createJSONReplacer(customReplacer)
        const json = JSON.stringify(original, replacerFunc)
        const result = fromJSON(json, customReviver)

        expect(result.timestamp).toBe(original.timestamp * 2) // Should be doubled by reviver
        expect(result.bigint).toBe(123n)
        expect(result.uint8).toBeInstanceOf(Uint8Array)
        expect(Array.from(result.uint8)).toEqual([1, 2, 3])
      })

      it('should handle deeply nested structures', () => {
        const deep = { level1: { level2: { level3: { big: 999n } } } }
        const json = toJSON(deep)
        const result = fromJSON(json)

        expect(result.level1.level2.level3.big).toBe(999n)
      })

      it('should handle empty and null values', () => {
        const obj = {
          empty: {},
          nullValue: null,
          undefinedValue: undefined,
          emptyArray: [],
          emptyUint8: new Uint8Array(0),
          zeroBig: 0n,
        }

        const json = toJSON(obj)
        const result = fromJSON(json)

        expect(result.empty).toEqual({})
        expect(result.nullValue).toBe(null)
        expect(result.undefinedValue).toBeUndefined()
        expect(result.emptyArray).toEqual([])
        expect(result.emptyUint8).toBeInstanceOf(Uint8Array)
        expect(result.emptyUint8.length).toBe(0)
        expect(result.zeroBig).toBe(0n)
      })
    })
  })
})
