import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex, Bytes } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { IdentityInstrument, KeyType } from '@0xsequence/identity-instrument'
import { State } from '@0xsequence/wallet-core'
import { IdentitySigner, toIdentityAuthKey } from '../src/identity/signer'
import { AuthKey } from '../src/dbs/auth-keys'

// Mock the global crypto API
const mockCryptoSubtle = {
  sign: vi.fn(),
  generateKey: vi.fn(),
  exportKey: vi.fn(),
}

Object.defineProperty(global, 'window', {
  value: {
    crypto: {
      subtle: mockCryptoSubtle,
    },
  },
  writable: true,
})

// Mock IdentityInstrument
const mockIdentityInstrument = {
  sign: vi.fn(),
} as unknown as IdentityInstrument

describe('Identity Signer', () => {
  let testAuthKey: AuthKey
  let testWallet: Address.Address
  let mockStateWriter: State.Writer
  let mockSignFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a proper mock function for the sign method
    mockSignFn = vi.fn()
    mockIdentityInstrument.sign = mockSignFn

    testWallet = '0x1234567890123456789012345678901234567890' as Address.Address

    // Create mock CryptoKey
    const mockCryptoKey = {
      algorithm: { name: 'ECDSA', namedCurve: 'P-256' },
      extractable: false,
      type: 'private',
      usages: ['sign'],
    } as CryptoKey

    testAuthKey = {
      address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
      privateKey: mockCryptoKey,
      identitySigner: '0x1234567890123456789012345678901234567890', // Use exact format from working tests
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    }

    mockStateWriter = {
      saveWitnesses: vi.fn(),
    } as unknown as State.Writer
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // === UTILITY FUNCTION TESTS ===

  describe('toIdentityAuthKey()', () => {
    it('Should convert AuthKey to Identity.AuthKey format', () => {
      const result = toIdentityAuthKey(testAuthKey)

      expect(result.address).toBe(testAuthKey.address)
      expect(result.keyType).toBe(KeyType.Secp256r1)
      expect(result.signer).toBe(testAuthKey.identitySigner)
      expect(typeof result.sign).toBe('function')
    })

    it('Should create working sign function that uses Web Crypto API', async () => {
      const mockSignature = new ArrayBuffer(64)
      const mockDigest = Hex.toBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')

      mockCryptoSubtle.sign.mockResolvedValueOnce(mockSignature)

      const identityAuthKey = toIdentityAuthKey(testAuthKey)
      const result = await identityAuthKey.sign(mockDigest)

      expect(mockCryptoSubtle.sign).toHaveBeenCalledOnce()
      expect(mockCryptoSubtle.sign).toHaveBeenCalledWith(
        {
          name: 'ECDSA',
          hash: 'SHA-256',
        },
        testAuthKey.privateKey,
        mockDigest,
      )

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.startsWith('0x')).toBe(true)
    })

    it('Should handle Web Crypto API errors in sign function', async () => {
      const mockDigest = Hex.toBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')

      mockCryptoSubtle.sign.mockRejectedValueOnce(new Error('Crypto operation failed'))

      const identityAuthKey = toIdentityAuthKey(testAuthKey)

      await expect(identityAuthKey.sign(mockDigest)).rejects.toThrow('Crypto operation failed')
    })
  })

  // === IDENTITY SIGNER CLASS TESTS ===

  describe('IdentitySigner', () => {
    let identitySigner: IdentitySigner

    beforeEach(() => {
      identitySigner = new IdentitySigner(mockIdentityInstrument, testAuthKey)
    })

    describe('Constructor', () => {
      it('Should create IdentitySigner with correct properties', () => {
        expect(identitySigner.identityInstrument).toBe(mockIdentityInstrument)
        expect(identitySigner.authKey).toBe(testAuthKey)
      })
    })

    describe('address getter', () => {
      it('Should return checksummed address from authKey.identitySigner', () => {
        const result = identitySigner.address

        expect(result).toBe(Address.checksum(testAuthKey.identitySigner))
        expect(Address.validate(result)).toBe(true)
      })

      it('Should throw error when identitySigner is invalid', () => {
        const invalidAuthKey = {
          ...testAuthKey,
          identitySigner: 'invalid-address',
        }
        const invalidSigner = new IdentitySigner(mockIdentityInstrument, invalidAuthKey)

        expect(() => invalidSigner.address).toThrow('No signer address found')
      })

      it('Should handle empty identitySigner', () => {
        const emptyAuthKey = {
          ...testAuthKey,
          identitySigner: '',
        }
        const emptySigner = new IdentitySigner(mockIdentityInstrument, emptyAuthKey)

        expect(() => emptySigner.address).toThrow('No signer address found')
      })
    })

    describe('sign()', () => {
      it('Should sign payload and return signature', async () => {
        const testPayload = Payload.fromMessage(Hex.fromString('Test message'))
        const chainId = 42161n
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        const result = await identitySigner.sign(testWallet, chainId, testPayload)

        expect(result).toBeDefined()
        expect(result.type).toBe('hash')
        // For hash type signatures, the structure includes r, s, yParity
        if (result.type === 'hash') {
          expect(result.r).toBeDefined()
          expect(result.s).toBeDefined()
          expect(result.yParity).toBeDefined()
        }

        // Verify that identityInstrument.sign was called with correct parameters
        expect(mockSignFn).toHaveBeenCalledOnce()
        const [authKeyArg, digestArg] = mockSignFn.mock.calls[0]
        expect(authKeyArg.address).toBe(testAuthKey.address)
        expect(authKeyArg.signer).toBe(testAuthKey.identitySigner)
        expect(digestArg).toBeDefined()
      })

      it('Should handle different chainIds correctly', async () => {
        const testPayload = Payload.fromMessage(Hex.fromString('Mainnet message'))
        const mainnetChainId = 1n
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        await identitySigner.sign(testWallet, mainnetChainId, testPayload)

        expect(mockSignFn).toHaveBeenCalledOnce()
        // The digest should be different for different chainIds
        const [, digestArg] = mockSignFn.mock.calls[0]
        expect(digestArg).toBeDefined()
      })

      it('Should handle transaction payloads', async () => {
        const transactionPayload = Payload.fromCall(1n, 0n, [
          {
            to: '0x1234567890123456789012345678901234567890' as Address.Address,
            value: 1000000000000000000n,
            data: '0x',
            gasLimit: 21000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ])
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        const result = await identitySigner.sign(testWallet, 42161n, transactionPayload)

        expect(result).toBeDefined()
        expect(result.type).toBe('hash')
        expect(mockSignFn).toHaveBeenCalledOnce()
      })

      it('Should handle identity instrument signing errors', async () => {
        const testPayload = Payload.fromMessage(Hex.fromString('Error message'))

        mockSignFn.mockRejectedValueOnce(new Error('Identity service unavailable'))

        await expect(identitySigner.sign(testWallet, 42161n, testPayload)).rejects.toThrow(
          'Identity service unavailable',
        )
      })
    })

    describe('signDigest()', () => {
      it('Should sign raw digest directly', async () => {
        const digest = Hex.toBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        const result = await identitySigner.signDigest(digest)

        expect(result).toBeDefined()
        expect(result.type).toBe('hash')
        // For hash type signatures, check properties conditionally
        if (result.type === 'hash') {
          expect(result.r).toBeDefined()
          expect(result.s).toBeDefined()
          expect(result.yParity).toBeDefined()
        }

        expect(mockSignFn).toHaveBeenCalledOnce()
        const [authKeyArg, digestArg] = mockSignFn.mock.calls[0]
        expect(authKeyArg.address).toBe(testAuthKey.address)
        expect(digestArg).toBe(digest)
      })

      it('Should handle different digest lengths', async () => {
        const shortDigest = Hex.toBytes('0x1234')
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        const result = await identitySigner.signDigest(shortDigest)

        expect(result).toBeDefined()
        expect(result.type).toBe('hash')
        expect(mockSignFn).toHaveBeenCalledWith(
          expect.objectContaining({
            address: testAuthKey.address,
          }),
          shortDigest,
        )
      })

      it('Should handle empty digest', async () => {
        const emptyDigest = new Uint8Array(0)
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        const result = await identitySigner.signDigest(emptyDigest)

        expect(result).toBeDefined()
        expect(result.type).toBe('hash')
      })

      it('Should handle malformed signature from identity instrument', async () => {
        const digest = Hex.toBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')

        mockSignFn.mockResolvedValueOnce('invalid-signature')

        await expect(identitySigner.signDigest(digest)).rejects.toThrow() // Should throw when Signature.fromHex fails
      })
    })

    describe('witness()', () => {
      it('Should create and save witness signature', async () => {
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
        const mockSaveWitnesses = vi.fn()
        mockStateWriter.saveWitnesses = mockSaveWitnesses

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        await identitySigner.witness(mockStateWriter, testWallet)

        // Verify signature was created (sign called)
        expect(mockSignFn).toHaveBeenCalledOnce()

        // Verify witness was saved
        expect(mockSaveWitnesses).toHaveBeenCalledOnce()
        const [wallet, chainId, payload, witness] = mockSaveWitnesses.mock.calls[0]

        expect(wallet).toBe(testWallet)
        expect(chainId).toBe(0n) // Witness signatures use chainId 0
        expect(payload.type).toBe('message')
        expect(witness.type).toBe('unrecovered-signer')
        expect(witness.weight).toBe(1n)
        expect(witness.signature).toBeDefined()
      })

      it('Should create consent payload with correct structure', async () => {
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
        const mockSaveWitnesses = vi.fn()
        mockStateWriter.saveWitnesses = mockSaveWitnesses

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        await identitySigner.witness(mockStateWriter, testWallet)

        // Extract the payload that was signed
        const [, , payload] = mockSaveWitnesses.mock.calls[0]

        // Parse the message content to verify consent structure
        const messageHex = payload.message
        const messageString = Hex.toString(messageHex)
        const consentData = JSON.parse(messageString)

        expect(consentData.action).toBe('consent-to-be-part-of-wallet')
        expect(consentData.wallet).toBe(testWallet)
        expect(consentData.signer).toBe(identitySigner.address)
        expect(consentData.timestamp).toBeDefined()
        expect(typeof consentData.timestamp).toBe('number')
      })

      it('Should include extra data in consent payload', async () => {
        const extraData = {
          userAgent: 'test-browser',
          sessionId: 'session-123',
        }
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
        const mockSaveWitnesses = vi.fn()
        mockStateWriter.saveWitnesses = mockSaveWitnesses

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)

        await identitySigner.witness(mockStateWriter, testWallet, extraData)

        // Extract and verify extra data was included
        const [, , payload] = mockSaveWitnesses.mock.calls[0]
        const messageString = Hex.toString(payload.message)
        const consentData = JSON.parse(messageString)

        expect(consentData.userAgent).toBe(extraData.userAgent)
        expect(consentData.sessionId).toBe(extraData.sessionId)
      })

      it('Should handle witness creation failure', async () => {
        const mockSaveWitnesses = vi.fn()
        mockStateWriter.saveWitnesses = mockSaveWitnesses

        mockSignFn.mockRejectedValueOnce(new Error('Identity signing failed'))

        await expect(identitySigner.witness(mockStateWriter, testWallet)).rejects.toThrow('Identity signing failed')

        // Verify saveWitnesses was not called due to error
        expect(mockSaveWitnesses).not.toHaveBeenCalled()
      })

      it('Should handle state writer saveWitnesses failure', async () => {
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
        const mockSaveWitnesses = vi.fn()
        mockStateWriter.saveWitnesses = mockSaveWitnesses

        mockSignFn.mockResolvedValueOnce(mockSignatureHex)
        mockSaveWitnesses.mockRejectedValueOnce(new Error('State write failed'))

        await expect(identitySigner.witness(mockStateWriter, testWallet)).rejects.toThrow('State write failed')

        // Verify sign was called but saveWitnesses failed
        expect(mockSignFn).toHaveBeenCalledOnce()
        expect(mockSaveWitnesses).toHaveBeenCalledOnce()
      })
    })

    // === INTEGRATION TESTS ===

    describe('Integration Tests', () => {
      it('Should work with real-world payload and witness flow', async () => {
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
        const mockSaveWitnesses = vi.fn()
        mockStateWriter.saveWitnesses = mockSaveWitnesses

        // Mock both sign operations (for payload and witness)
        mockSignFn
          .mockResolvedValueOnce(mockSignatureHex) // For initial payload signing
          .mockResolvedValueOnce(mockSignatureHex) // For witness creation

        // First, sign a regular payload
        const payload = Payload.fromMessage(Hex.fromString('User authentication request'))
        const payloadSignature = await identitySigner.sign(testWallet, 1n, payload)

        expect(payloadSignature.type).toBe('hash')

        // Then create a witness
        await identitySigner.witness(mockStateWriter, testWallet, {
          signatureId: 'sig-123',
          purpose: 'authentication',
        })

        // Verify both operations completed
        expect(mockSignFn).toHaveBeenCalledTimes(2)
        expect(mockSaveWitnesses).toHaveBeenCalledOnce()

        // Verify witness payload includes extra context
        const [, , witnessPayload] = mockSaveWitnesses.mock.calls[0]
        const witnessMessage = JSON.parse(Hex.toString(witnessPayload.message))
        expect(witnessMessage.signatureId).toBe('sig-123')
        expect(witnessMessage.purpose).toBe('authentication')
      })

      it('Should handle complex payload types correctly', async () => {
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValue(mockSignatureHex)

        // Test with different payload types
        const messagePayload = Payload.fromMessage(Hex.fromString('Hello World'))
        const transactionPayload = Payload.fromCall(1n, 0n, [
          {
            to: testWallet,
            value: 0n,
            data: '0x',
            gasLimit: 21000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ])

        const messageResult = await identitySigner.sign(testWallet, 42161n, messagePayload)
        const transactionResult = await identitySigner.sign(testWallet, 42161n, transactionPayload)

        expect(messageResult.type).toBe('hash')
        expect(transactionResult.type).toBe('hash')
        expect(mockSignFn).toHaveBeenCalledTimes(2)

        // Verify different payloads produce different hashes
        const [, messageDigest] = mockSignFn.mock.calls[0]
        const [, transactionDigest] = mockSignFn.mock.calls[1]
        expect(messageDigest).not.toEqual(transactionDigest)
      })
    })

    // === ERROR HANDLING AND EDGE CASES ===

    describe('Error Handling', () => {
      it('Should handle corrupted AuthKey data gracefully', () => {
        const corruptedAuthKey = {
          ...testAuthKey,
          address: null,
        } as any

        // This should not throw during construction
        const corruptedSigner = new IdentitySigner(mockIdentityInstrument, corruptedAuthKey)
        expect(corruptedSigner).toBeDefined()
      })

      it('Should handle network failures in identity instrument', async () => {
        const digest = Hex.toBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')

        mockSignFn.mockRejectedValueOnce(new Error('Network timeout'))

        await expect(identitySigner.signDigest(digest)).rejects.toThrow('Network timeout')
      })

      it('Should handle malformed hex signatures', async () => {
        const digest = Hex.toBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')

        mockSignFn.mockResolvedValueOnce('not-a-hex-string')

        await expect(identitySigner.signDigest(digest)).rejects.toThrow()
      })

      it('Should handle edge case wallet addresses', async () => {
        const zeroWallet = '0x0000000000000000000000000000000000000000' as Address.Address
        const maxWallet = '0xffffffffffffffffffffffffffffffffffffffff' as Address.Address
        const mockSignatureHex =
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

        mockSignFn.mockResolvedValue(mockSignatureHex)

        const payload = Payload.fromMessage(Hex.fromString('Edge case test'))

        // Should work with edge case addresses
        const zeroResult = await identitySigner.sign(zeroWallet, 1n, payload)
        const maxResult = await identitySigner.sign(maxWallet, 1n, payload)

        expect(zeroResult.type).toBe('hash')
        expect(maxResult.type).toBe('hash')
      })
    })
  })
})
