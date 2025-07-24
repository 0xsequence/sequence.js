import { describe, expect, it } from 'vitest'
import { Bytes, Hash, Hex } from 'ox'

import {
  Attestation,
  AuthData,
  encode,
  encodeAuthData,
  decode,
  decodeAuthData,
  hash,
  toJson,
  encodeForJson,
  fromJson,
  fromParsed,
  ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX,
  generateImplicitRequestMagic,
} from '../src/attestation.js'

describe('Attestation', () => {
  const sampleAuthData: AuthData = {
    redirectUrl: 'https://example.com/callback',
    issuedAt: 1234567890n,
  }

  const sampleAttestation: Attestation = {
    approvedSigner: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
    identityType: Bytes.fromHex('0x12345678'),
    issuerHash: Bytes.fromHex('0x1111111111111111111111111111111111111111111111111111111111111111'),
    audienceHash: Bytes.fromHex('0x2222222222222222222222222222222222222222222222222222222222222222'),
    applicationData: Bytes.fromString('test-app-data'),
    authData: sampleAuthData,
  }

  describe('AuthData encoding/decoding', () => {
    it('should encode AuthData correctly', () => {
      const encoded = encodeAuthData(sampleAuthData)

      // Should be deterministic
      const encoded2 = encodeAuthData(sampleAuthData)
      expect(Bytes.isEqual(encoded, encoded2)).toBe(true)

      // Should have correct structure: 3 bytes length + url + 8 bytes timestamp
      const expectedLength = 3 + sampleAuthData.redirectUrl.length + 8
      expect(encoded.length).toBe(expectedLength)
    })

    it('should decode AuthData correctly', () => {
      const encoded = encodeAuthData(sampleAuthData)
      const decoded = decodeAuthData(encoded)

      expect(decoded.redirectUrl).toBe(sampleAuthData.redirectUrl)
      expect(decoded.issuedAt).toBe(sampleAuthData.issuedAt)
    })

    it('should handle round-trip encoding/decoding for AuthData', () => {
      const encoded = encodeAuthData(sampleAuthData)
      const decoded = decodeAuthData(encoded)
      const reencoded = encodeAuthData(decoded)

      expect(Bytes.isEqual(encoded, reencoded)).toBe(true)
    })

    it('should handle empty redirect URL', () => {
      const authDataWithEmptyUrl: AuthData = {
        redirectUrl: '',
        issuedAt: 123n,
      }

      const encoded = encodeAuthData(authDataWithEmptyUrl)
      const decoded = decodeAuthData(encoded)

      expect(decoded.redirectUrl).toBe('')
      expect(decoded.issuedAt).toBe(123n)
    })

    it('should handle long redirect URLs', () => {
      const longUrl = 'https://example.com/very/long/path/with/many/segments/' + 'a'.repeat(100)
      const authDataWithLongUrl: AuthData = {
        redirectUrl: longUrl,
        issuedAt: 456n,
      }

      const encoded = encodeAuthData(authDataWithLongUrl)
      const decoded = decodeAuthData(encoded)

      expect(decoded.redirectUrl).toBe(longUrl)
      expect(decoded.issuedAt).toBe(456n)
    })

    it('should handle maximum timestamp values', () => {
      const maxTimestamp = BigInt('18446744073709551615') // 2^64 - 1
      const authDataWithMaxTimestamp: AuthData = {
        redirectUrl: 'https://example.com',
        issuedAt: maxTimestamp,
      }

      const encoded = encodeAuthData(authDataWithMaxTimestamp)
      const decoded = decodeAuthData(encoded)

      expect(decoded.issuedAt).toBe(maxTimestamp)
    })
  })

  describe('Attestation encoding/decoding', () => {
    it('should encode Attestation correctly', () => {
      const encoded = encode(sampleAttestation)

      // Should be deterministic
      const encoded2 = encode(sampleAttestation)
      expect(Bytes.isEqual(encoded, encoded2)).toBe(true)

      // Should contain all expected parts
      expect(encoded.length).toBeGreaterThan(20 + 4 + 32 + 32 + 3) // Minimum size
    })

    it('should decode Attestation correctly', () => {
      const encoded = encode(sampleAttestation)
      const decoded = decode(encoded)

      expect(decoded.approvedSigner).toBe(sampleAttestation.approvedSigner)
      expect(Bytes.isEqual(decoded.identityType, sampleAttestation.identityType)).toBe(true)
      expect(Bytes.isEqual(decoded.issuerHash, sampleAttestation.issuerHash)).toBe(true)
      expect(Bytes.isEqual(decoded.audienceHash, sampleAttestation.audienceHash)).toBe(true)
      expect(Bytes.isEqual(decoded.applicationData, sampleAttestation.applicationData)).toBe(true)
      expect(decoded.authData.redirectUrl).toBe(sampleAttestation.authData.redirectUrl)
      expect(decoded.authData.issuedAt).toBe(sampleAttestation.authData.issuedAt)
    })

    it('should handle round-trip encoding/decoding for Attestation', () => {
      const encoded = encode(sampleAttestation)
      const decoded = decode(encoded)
      const reencoded = encode(decoded)

      expect(Bytes.isEqual(encoded, reencoded)).toBe(true)
    })

    it('should handle identity type truncation', () => {
      const attestationWithLongIdentityType: Attestation = {
        ...sampleAttestation,
        identityType: Bytes.fromHex('0x123456789abcdef0'), // 8 bytes, should be truncated to 4
      }

      const encoded = encode(attestationWithLongIdentityType)
      const decoded = decode(encoded)

      // Should be truncated to first 4 bytes
      expect(decoded.identityType.length).toBe(4)
      expect(Bytes.toHex(decoded.identityType)).toBe('0x12345678')
    })

    it('should handle empty application data', () => {
      const attestationWithEmptyAppData: Attestation = {
        ...sampleAttestation,
        applicationData: new Uint8Array(0),
      }

      const encoded = encode(attestationWithEmptyAppData)
      const decoded = decode(encoded)

      expect(decoded.applicationData.length).toBe(0)
    })

    it('should handle large application data', () => {
      const largeAppData = new Uint8Array(1000).fill(0xaa)
      const attestationWithLargeAppData: Attestation = {
        ...sampleAttestation,
        applicationData: largeAppData,
      }

      const encoded = encode(attestationWithLargeAppData)
      const decoded = decode(encoded)

      expect(Bytes.isEqual(decoded.applicationData, largeAppData)).toBe(true)
    })

    it('should handle different address formats', () => {
      const attestationWithDifferentAddress: Attestation = {
        ...sampleAttestation,
        approvedSigner: '0x8ba1f109551bd432803012645aac136c776056c0',
      }

      const encoded = encode(attestationWithDifferentAddress)
      const decoded = decode(encoded)

      expect(decoded.approvedSigner).toBe(attestationWithDifferentAddress.approvedSigner)
    })
  })

  describe('hash function', () => {
    it('should generate consistent hash for same attestation', () => {
      const hash1 = hash(sampleAttestation)
      const hash2 = hash(sampleAttestation)

      expect(Bytes.isEqual(hash1, hash2)).toBe(true)
      expect(hash1.length).toBe(32) // keccak256 produces 32 bytes
    })

    it('should generate different hashes for different attestations', () => {
      const differentAttestation: Attestation = {
        ...sampleAttestation,
        approvedSigner: '0x8ba1f109551bd432803012645aac136c776056c0',
      }

      const hash1 = hash(sampleAttestation)
      const hash2 = hash(differentAttestation)

      expect(Bytes.isEqual(hash1, hash2)).toBe(false)
    })

    it('should match manual hash calculation', () => {
      const encoded = encode(sampleAttestation)
      const manualHash = Hash.keccak256(encoded)
      const functionHash = hash(sampleAttestation)

      expect(Bytes.isEqual(manualHash, functionHash)).toBe(true)
    })
  })

  describe('JSON serialization', () => {
    it('should encode for JSON correctly', () => {
      const jsonObj = encodeForJson(sampleAttestation)

      expect(jsonObj.approvedSigner).toBe(sampleAttestation.approvedSigner)
      expect(jsonObj.identityType).toBe(Bytes.toHex(sampleAttestation.identityType))
      expect(jsonObj.issuerHash).toBe(Bytes.toHex(sampleAttestation.issuerHash))
      expect(jsonObj.audienceHash).toBe(Bytes.toHex(sampleAttestation.audienceHash))
      expect(jsonObj.applicationData).toBe(Bytes.toHex(sampleAttestation.applicationData))
      expect(jsonObj.authData.redirectUrl).toBe(sampleAttestation.authData.redirectUrl)
      expect(jsonObj.authData.issuedAt).toBe(sampleAttestation.authData.issuedAt.toString())
    })

    it('should convert to JSON string correctly', () => {
      const jsonString = toJson(sampleAttestation)

      expect(typeof jsonString).toBe('string')
      expect(() => JSON.parse(jsonString)).not.toThrow()

      const parsed = JSON.parse(jsonString)
      expect(parsed.approvedSigner).toBe(sampleAttestation.approvedSigner)
    })

    it('should convert to JSON string with indentation', () => {
      const jsonString = toJson(sampleAttestation, 2)

      expect(jsonString).toContain('\n') // Should have newlines due to indentation
      expect(jsonString).toContain('  ') // Should have 2-space indentation
    })

    it('should parse from JSON string correctly', () => {
      const jsonString = toJson(sampleAttestation)
      const parsed = fromJson(jsonString)

      expect(parsed.approvedSigner).toBe(sampleAttestation.approvedSigner)
      expect(Bytes.isEqual(parsed.identityType, sampleAttestation.identityType)).toBe(true)
      expect(Bytes.isEqual(parsed.issuerHash, sampleAttestation.issuerHash)).toBe(true)
      expect(Bytes.isEqual(parsed.audienceHash, sampleAttestation.audienceHash)).toBe(true)
      expect(Bytes.isEqual(parsed.applicationData, sampleAttestation.applicationData)).toBe(true)
      expect(parsed.authData.redirectUrl).toBe(sampleAttestation.authData.redirectUrl)
      expect(parsed.authData.issuedAt).toBe(sampleAttestation.authData.issuedAt)
    })

    it('should parse from parsed object correctly', () => {
      const jsonObj = encodeForJson(sampleAttestation)
      const parsed = fromParsed(jsonObj)

      expect(parsed.approvedSigner).toBe(sampleAttestation.approvedSigner)
      expect(Bytes.isEqual(parsed.identityType, sampleAttestation.identityType)).toBe(true)
      expect(Bytes.isEqual(parsed.issuerHash, sampleAttestation.issuerHash)).toBe(true)
      expect(Bytes.isEqual(parsed.audienceHash, sampleAttestation.audienceHash)).toBe(true)
      expect(Bytes.isEqual(parsed.applicationData, sampleAttestation.applicationData)).toBe(true)
      expect(parsed.authData.redirectUrl).toBe(sampleAttestation.authData.redirectUrl)
      expect(parsed.authData.issuedAt).toBe(sampleAttestation.authData.issuedAt)
    })

    it('should handle round-trip JSON serialization', () => {
      const jsonString = toJson(sampleAttestation)
      const parsed = fromJson(jsonString)
      const reencoded = toJson(parsed)

      expect(jsonString).toBe(reencoded)
    })
  })

  describe('Library functions', () => {
    it('should have correct ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX', () => {
      const expectedPrefix = Hash.keccak256(Bytes.fromString('acceptImplicitRequest'))

      expect(Bytes.isEqual(ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX, expectedPrefix)).toBe(true)
      expect(ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX.length).toBe(32)
    })

    it('should generate implicit request magic correctly', () => {
      const wallet = '0x1234567890123456789012345678901234567890'
      const magic = generateImplicitRequestMagic(sampleAttestation, wallet)

      expect(magic.length).toBe(32) // keccak256 produces 32 bytes

      // Should be deterministic
      const magic2 = generateImplicitRequestMagic(sampleAttestation, wallet)
      expect(Bytes.isEqual(magic, magic2)).toBe(true)
    })

    it('should generate different magic for different wallets', () => {
      const wallet1 = '0x1111111111111111111111111111111111111111'
      const wallet2 = '0x2222222222222222222222222222222222222222'

      const magic1 = generateImplicitRequestMagic(sampleAttestation, wallet1)
      const magic2 = generateImplicitRequestMagic(sampleAttestation, wallet2)

      expect(Bytes.isEqual(magic1, magic2)).toBe(false)
    })

    it('should generate different magic for different attestations', () => {
      const wallet = '0x1234567890123456789012345678901234567890'
      const differentAttestation: Attestation = {
        ...sampleAttestation,
        audienceHash: Bytes.fromHex('0x3333333333333333333333333333333333333333333333333333333333333333'),
      }

      const magic1 = generateImplicitRequestMagic(sampleAttestation, wallet)
      const magic2 = generateImplicitRequestMagic(differentAttestation, wallet)

      expect(Bytes.isEqual(magic1, magic2)).toBe(false)
    })

    it('should generate magic matching manual calculation', () => {
      const wallet = '0x1234567890123456789012345678901234567890'

      const manualMagic = Hash.keccak256(
        Bytes.concat(
          ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX,
          Bytes.fromHex(wallet, { size: 20 }),
          sampleAttestation.audienceHash,
          sampleAttestation.issuerHash,
        ),
      )

      const functionMagic = generateImplicitRequestMagic(sampleAttestation, wallet)

      expect(Bytes.isEqual(manualMagic, functionMagic)).toBe(true)
    })
  })

  describe('Edge cases and error conditions', () => {
    it('should handle attestation with minimal data', () => {
      const minimalAttestation: Attestation = {
        approvedSigner: '0x0000000000000000000000000000000000000000',
        identityType: new Uint8Array(4),
        issuerHash: new Uint8Array(32),
        audienceHash: new Uint8Array(32),
        applicationData: new Uint8Array(0),
        authData: {
          redirectUrl: '',
          issuedAt: 0n,
        },
      }

      const encoded = encode(minimalAttestation)
      const decoded = decode(encoded)

      expect(decoded.approvedSigner).toBe(minimalAttestation.approvedSigner)
      expect(decoded.authData.issuedAt).toBe(0n)
    })

    it('should handle attestation with maximum application data size', () => {
      // 3 bytes can represent up to 16,777,215 (0xFFFFFF)
      const maxAppDataSize = 0xffffff
      const largeAppData = new Uint8Array(Math.min(maxAppDataSize, 10000)) // Use smaller size for test performance
      largeAppData.fill(0x42)

      const attestationWithMaxData: Attestation = {
        ...sampleAttestation,
        applicationData: largeAppData,
      }

      const encoded = encode(attestationWithMaxData)
      const decoded = decode(encoded)

      expect(Bytes.isEqual(decoded.applicationData, largeAppData)).toBe(true)
    })

    it('should handle ASCII redirect URLs', () => {
      const asciiUrlAttestation: Attestation = {
        ...sampleAttestation,
        authData: {
          redirectUrl: 'https://example.com/callback?param=value&other=test',
          issuedAt: 1234567890n,
        },
      }

      const encoded = encode(asciiUrlAttestation)
      const decoded = decode(encoded)

      expect(decoded.authData.redirectUrl).toBe(asciiUrlAttestation.authData.redirectUrl)
    })

    it('should maintain byte precision in round-trip operations', () => {
      // Test with specific byte patterns
      const precisionAttestation: Attestation = {
        approvedSigner: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        identityType: Bytes.fromHex('0xCAFEBABE'),
        issuerHash: Bytes.fromHex('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
        audienceHash: Bytes.fromHex('0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'),
        applicationData: Bytes.fromHex('0x00010203040506070809'),
        authData: {
          redirectUrl: 'https://test.example',
          issuedAt: 0x123456789abcdef0n,
        },
      }

      const encoded = encode(precisionAttestation)
      const decoded = decode(encoded)
      const reencoded = encode(decoded)

      expect(Bytes.isEqual(encoded, reencoded)).toBe(true)
    })
  })
})
