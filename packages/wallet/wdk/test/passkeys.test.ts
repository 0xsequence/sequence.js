import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { Signers, State } from '@0xsequence/wallet-core'
import { Extensions } from '@0xsequence/wallet-primitives'
import { PasskeysHandler } from '../src/sequence/handlers/passkeys'
import { Signatures } from '../src/sequence/signatures'
import { BaseSignatureRequest } from '../src/sequence/types/signature-request'
import { Kinds } from '../src/sequence/types/signer'

// Mock dependencies with proper vi.fn() types
const mockAddSignature = vi.fn()
const mockGetWalletsForSapient = vi.fn()
const mockGetWitnessForSapient = vi.fn()
const mockGetConfiguration = vi.fn()
const mockGetDeploy = vi.fn()
const mockGetWallets = vi.fn()
const mockGetWitnessFor = vi.fn()
const mockGetConfigurationUpdates = vi.fn()
const mockGetTree = vi.fn()
const mockGetPayload = vi.fn()
const mockSignSapient = vi.fn()
const mockLoadFromWitness = vi.fn()

const mockSignatures = {
  addSignature: mockAddSignature,
} as unknown as Signatures

const mockStateReader = {
  getWalletsForSapient: mockGetWalletsForSapient,
  getWitnessForSapient: mockGetWitnessForSapient,
  getConfiguration: mockGetConfiguration,
  getDeploy: mockGetDeploy,
  getWallets: mockGetWallets,
  getWitnessFor: mockGetWitnessFor,
  getConfigurationUpdates: mockGetConfigurationUpdates,
  getTree: mockGetTree,
  getPayload: mockGetPayload,
} as unknown as State.Reader

const mockExtensions = {
  passkeys: '0x1234567890123456789012345678901234567890' as Address.Address,
} as Pick<Extensions.Extensions, 'passkeys'>

// Mock the Extensions.Passkeys.decode function
vi.mock('@0xsequence/wallet-primitives', async () => {
  const actual = await vi.importActual('@0xsequence/wallet-primitives')
  return {
    ...actual,
    Extensions: {
      ...((actual as any).Extensions || {}),
      Passkeys: {
        ...((actual as any).Extensions?.Passkeys || {}),
        decode: vi.fn().mockReturnValue({
          embedMetadata: false,
        }),
      },
    },
  }
})

// Mock the Signers.Passkey.Passkey class - need to mock it directly
vi.mock('@0xsequence/wallet-core', async () => {
  const actual = await vi.importActual('@0xsequence/wallet-core')
  return {
    ...actual,
    Signers: {
      ...((actual as any).Signers || {}),
      Passkey: {
        Passkey: {
          loadFromWitness: mockLoadFromWitness,
        },
      },
    },
  }
})

describe('PasskeysHandler', () => {
  let passkeysHandler: PasskeysHandler
  let testWallet: Address.Address
  let testImageHash: Hex.Hex
  let testRequest: BaseSignatureRequest
  let mockPasskey: any

  beforeEach(() => {
    vi.clearAllMocks()

    testWallet = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address.Address
    testImageHash = '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex.Hex

    testRequest = {
      id: 'test-request-id',
      envelope: {
        wallet: testWallet,
        chainId: 42161n,
        payload: Payload.fromMessage(Hex.fromString('Test message')),
      },
    } as BaseSignatureRequest

    // Create mock passkey object
    mockPasskey = {
      address: mockExtensions.passkeys,
      imageHash: testImageHash,
      credentialId: 'test-credential-id',
      signSapient: mockSignSapient,
    }

    // Setup mock witness data for getWitnessForSapient with proper structure
    const witnessMessage = {
      action: 'consent-to-be-part-of-wallet',
      publicKey: {
        x: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        y: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        requireUserVerification: true,
        metadata: {
          credentialId: 'test-credential-id',
          name: 'Test Passkey',
        },
      },
      metadata: {
        credentialId: 'test-credential-id',
        name: 'Test Passkey',
      },
    }

    const mockWitness = {
      chainId: 42161n,
      payload: Payload.fromMessage(Hex.fromString(JSON.stringify(witnessMessage))),
      signature: {
        type: 'sapient-signer-leaf' as const,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', // Mock encoded signature data
      },
    }

    mockGetWitnessForSapient.mockResolvedValue(mockWitness)

    passkeysHandler = new PasskeysHandler(mockSignatures, mockExtensions, mockStateReader)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // === CONSTRUCTOR AND PROPERTIES ===

  describe('Constructor', () => {
    it('Should create PasskeysHandler with correct properties', () => {
      const handler = new PasskeysHandler(mockSignatures, mockExtensions, mockStateReader)

      expect(handler.kind).toBe(Kinds.LoginPasskey)
    })

    it('Should store dependencies correctly', () => {
      expect(passkeysHandler['signatures']).toBe(mockSignatures)
      expect(passkeysHandler['extensions']).toBe(mockExtensions)
      expect(passkeysHandler['stateReader']).toBe(mockStateReader)
    })
  })

  // === ON STATUS CHANGE ===

  describe('onStatusChange()', () => {
    it('Should return a no-op unsubscribe function', () => {
      const mockCallback = vi.fn()

      const unsubscribe = passkeysHandler.onStatusChange(mockCallback)

      expect(typeof unsubscribe).toBe('function')

      // Calling the unsubscribe function should not throw
      expect(() => unsubscribe()).not.toThrow()

      // The callback should not be called since it's a no-op implementation
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('Should not call the provided callback', () => {
      const mockCallback = vi.fn()

      passkeysHandler.onStatusChange(mockCallback)

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  // === LOAD PASSKEY (PRIVATE METHOD) ===

  describe('loadPasskey() private method', () => {
    it.skip('Should successfully load passkey when loadFromWitness succeeds', async () => {
      mockLoadFromWitness.mockResolvedValueOnce(mockPasskey)

      const result = await passkeysHandler['loadPasskey'](testWallet, testImageHash)

      expect(result).toBe(mockPasskey)
      expect(mockLoadFromWitness).toHaveBeenCalledWith(mockStateReader, mockExtensions, testWallet, testImageHash)
    })

    it('Should return undefined when loadFromWitness fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockLoadFromWitness.mockRejectedValueOnce(new Error('Failed to load passkey'))

      const result = await passkeysHandler['loadPasskey'](testWallet, testImageHash)

      expect(result).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load passkey:', expect.any(Error))

      consoleSpy.mockRestore()
    })

    it('Should handle various error types gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Test with string error
      mockLoadFromWitness.mockRejectedValueOnce('String error')
      let result = await passkeysHandler['loadPasskey'](testWallet, testImageHash)
      expect(result).toBeUndefined()

      // Test with null error
      mockLoadFromWitness.mockRejectedValueOnce(null)
      result = await passkeysHandler['loadPasskey'](testWallet, testImageHash)
      expect(result).toBeUndefined()

      consoleSpy.mockRestore()
    })
  })

  // === STATUS METHOD ===

  describe('status()', () => {
    describe('Address mismatch scenarios', () => {
      it('Should return unavailable when address does not match passkey module address', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const wrongAddress = '0x9999999999999999999999999999999999999999' as Address.Address

        const result = await passkeysHandler.status(wrongAddress, testImageHash, testRequest)

        expect(result.status).toBe('unavailable')
        expect((result as any).reason).toBe('unknown-error')
        expect(result.address).toBe(wrongAddress)
        expect(result.imageHash).toBe(testImageHash)
        expect(result.handler).toBe(passkeysHandler)

        expect(consoleSpy).toHaveBeenCalledWith(
          'PasskeySigner: status address does not match passkey module address',
          wrongAddress,
          mockExtensions.passkeys,
        )

        consoleSpy.mockRestore()
      })

      it('Should not attempt to load passkey when address mismatches', async () => {
        const wrongAddress = '0x9999999999999999999999999999999999999999' as Address.Address
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        await passkeysHandler.status(wrongAddress, testImageHash, testRequest)

        expect(mockLoadFromWitness).not.toHaveBeenCalled()
      })
    })

    describe('Missing imageHash scenarios', () => {
      it('Should return unavailable when imageHash is undefined', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const result = await passkeysHandler.status(mockExtensions.passkeys, undefined, testRequest)

        expect(result.status).toBe('unavailable')
        expect((result as any).reason).toBe('unknown-error')
        expect(result.address).toBe(mockExtensions.passkeys)
        expect(result.imageHash).toBeUndefined()
        expect(result.handler).toBe(passkeysHandler)

        expect(consoleSpy).toHaveBeenCalledWith(
          'PasskeySigner: status failed to load passkey',
          mockExtensions.passkeys,
          undefined,
        )

        consoleSpy.mockRestore()
      })

      it('Should not attempt to load passkey when imageHash is undefined', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        await passkeysHandler.status(mockExtensions.passkeys, undefined, testRequest)

        expect(mockLoadFromWitness).not.toHaveBeenCalled()
      })
    })

    describe('Failed passkey loading scenarios', () => {
      it('Should return unavailable when passkey loading fails', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mockLoadFromWitness.mockResolvedValueOnce(undefined)

        const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

        expect(result.status).toBe('unavailable')
        expect((result as any).reason).toBe('unknown-error')
        expect(result.address).toBe(mockExtensions.passkeys)
        expect(result.imageHash).toBe(testImageHash)
        expect(result.handler).toBe(passkeysHandler)

        expect(consoleSpy).toHaveBeenCalledWith(
          'PasskeySigner: status failed to load passkey',
          mockExtensions.passkeys,
          testImageHash,
        )

        consoleSpy.mockRestore()
      })

      it.skip('Should attempt to load passkey with correct parameters', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        mockLoadFromWitness.mockResolvedValueOnce(undefined)

        await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

        expect(mockLoadFromWitness).toHaveBeenCalledWith(
          mockStateReader,
          mockExtensions,
          testRequest.envelope.wallet,
          testImageHash,
        )
      })
    })

    describe('Successful passkey loading scenarios', () => {
      beforeEach(() => {
        mockLoadFromWitness.mockResolvedValue(mockPasskey)
      })

      it.skip('Should return actionable status when passkey is successfully loaded', async () => {
        const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

        expect(result.status).toBe('actionable')
        expect((result as any).message).toBe('request-interaction-with-passkey')
        expect(result.address).toBe(mockExtensions.passkeys)
        expect(result.imageHash).toBe(testImageHash)
        expect(result.handler).toBe(passkeysHandler)
        expect(typeof (result as any).handle).toBe('function')
      })

      it.skip('Should execute passkey signing when handle is called', async () => {
        const mockSignature = {
          type: 'sapient-signer-leaf' as const,
          signature: '0xabcdef1234567890',
          imageHash: testImageHash,
        }

        mockSignSapient.mockResolvedValueOnce(mockSignature)

        const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)
        const handleResult = await (result as any).handle()

        expect(handleResult).toBe(true)
        expect(mockSignSapient).toHaveBeenCalledWith(
          testRequest.envelope.wallet,
          testRequest.envelope.chainId,
          testRequest.envelope.payload,
          testImageHash,
        )
        expect(mockAddSignature).toHaveBeenCalledWith(testRequest.id, {
          address: mockExtensions.passkeys,
          imageHash: testImageHash,
          signature: mockSignature,
        })
      })

      it.skip('Should handle signing errors gracefully', async () => {
        mockSignSapient.mockRejectedValueOnce(new Error('User cancelled signing'))

        const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

        await expect((result as any).handle()).rejects.toThrow('User cancelled signing')
        expect(mockAddSignature).not.toHaveBeenCalled()
      })

      it.skip('Should handle addSignature errors gracefully', async () => {
        const mockSignature = {
          type: 'sapient-signer-leaf' as const,
          signature: '0xabcdef1234567890',
          imageHash: testImageHash,
        }

        mockSignSapient.mockResolvedValueOnce(mockSignature)
        mockAddSignature.mockRejectedValueOnce(new Error('Database error'))

        const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

        await expect((result as any).handle()).rejects.toThrow('Database error')
      })
    })
  })

  // === ERROR HANDLING ===

  describe('Error Handling', () => {
    it('Should handle corrupted passkey data gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockLoadFromWitness.mockResolvedValueOnce(null) // Invalid passkey data

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

      expect(result.status).toBe('unavailable')
      expect((result as any).reason).toBe('unknown-error')

      consoleSpy.mockRestore()
    })

    it('Should handle state reader errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockLoadFromWitness.mockRejectedValueOnce(new Error('State reader unavailable'))

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)

      expect(result.status).toBe('unavailable')
      expect((result as any).reason).toBe('unknown-error')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load passkey:', expect.any(Error))

      consoleSpy.mockRestore()
    })

    it('Should handle malformed extensions object', async () => {
      const malformedExtensions = {} as Pick<Extensions.Extensions, 'passkeys'>
      const handlerWithBadExtensions = new PasskeysHandler(mockSignatures, malformedExtensions, mockStateReader)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await handlerWithBadExtensions.status(mockExtensions.passkeys, testImageHash, testRequest)

      expect(result.status).toBe('unavailable')
      expect((result as any).reason).toBe('unknown-error')

      consoleSpy.mockRestore()
    })
  })

  // === INTEGRATION TESTS ===

  describe('Integration Tests', () => {
    it.skip('Should handle complete passkey authentication flow', async () => {
      const mockSignature = {
        type: 'sapient-signer-leaf' as const,
        signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        imageHash: testImageHash,
      }

      mockLoadFromWitness.mockResolvedValueOnce(mockPasskey)
      mockSignSapient.mockResolvedValueOnce(mockSignature)

      // Step 1: Check status
      const statusResult = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)
      expect(statusResult.status).toBe('actionable')
      expect((statusResult as any).message).toBe('request-interaction-with-passkey')

      // Step 2: Execute signing
      const handleResult = await (statusResult as any).handle()
      expect(handleResult).toBe(true)

      // Step 3: Verify all operations completed
      expect(mockLoadFromWitness).toHaveBeenCalledOnce()
      expect(mockSignSapient).toHaveBeenCalledOnce()
      expect(mockAddSignature).toHaveBeenCalledOnce()
    })

    it.skip('Should handle multiple status checks efficiently', async () => {
      mockLoadFromWitness.mockResolvedValue(mockPasskey)

      // Multiple status checks
      const results = await Promise.all([
        passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest),
        passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest),
        passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest),
      ])

      results.forEach((result) => {
        expect(result.status).toBe('actionable')
        expect((result as any).message).toBe('request-interaction-with-passkey')
      })

      expect(mockLoadFromWitness).toHaveBeenCalledTimes(3)
    })

    it.skip('Should handle different payloads correctly', async () => {
      mockLoadFromWitness.mockResolvedValue(mockPasskey)

      const transactionRequest = {
        ...testRequest,
        envelope: {
          ...testRequest.envelope,
          payload: Payload.fromCall(42161n, 0n, [
            {
              to: '0x1234567890123456789012345678901234567890' as Address.Address,
              value: 0n,
              data: '0x',
              gasLimit: 21000n,
              delegateCall: false,
              onlyFallback: false,
              behaviorOnError: 'revert',
            },
          ]),
        },
      }

      const mockSignature = {
        type: 'sapient-signer-leaf' as const,
        signature: '0xabcdef1234567890',
        imageHash: testImageHash,
      }

      mockSignSapient.mockResolvedValueOnce(mockSignature)

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, transactionRequest)
      await (result as any).handle()

      expect(mockSignSapient).toHaveBeenCalledWith(
        transactionRequest.envelope.wallet,
        transactionRequest.envelope.chainId,
        transactionRequest.envelope.payload,
        testImageHash,
      )
    })

    it.skip('Should handle different chain IDs correctly', async () => {
      mockLoadFromWitness.mockResolvedValue(mockPasskey)

      const polygonRequest = {
        ...testRequest,
        envelope: {
          ...testRequest.envelope,
          chainId: 137n, // Polygon
        },
      }

      const mockSignature = {
        type: 'sapient-signer-leaf' as const,
        signature: '0xabcdef1234567890',
        imageHash: testImageHash,
      }

      mockSignSapient.mockResolvedValueOnce(mockSignature)

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, polygonRequest)
      await (result as any).handle()

      expect(mockSignSapient).toHaveBeenCalledWith(
        polygonRequest.envelope.wallet,
        137n,
        polygonRequest.envelope.payload,
        testImageHash,
      )
    })

    it.skip('Should handle different image hashes correctly', async () => {
      const alternativeImageHash = '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex.Hex

      mockLoadFromWitness.mockResolvedValue(mockPasskey)

      await passkeysHandler.status(mockExtensions.passkeys, alternativeImageHash, testRequest)

      expect(mockLoadFromWitness).toHaveBeenCalledWith(
        mockStateReader,
        mockExtensions,
        testRequest.envelope.wallet,
        alternativeImageHash,
      )
    })
  })

  // === EDGE CASES ===

  describe('Edge Cases', () => {
    it.skip('Should handle very long credential IDs', async () => {
      const longCredentialId = 'a'.repeat(1000)
      const passkeyWithLongId = {
        ...mockPasskey,
        credentialId: longCredentialId,
      }

      mockLoadFromWitness.mockResolvedValueOnce(passkeyWithLongId)
      mockSignSapient.mockResolvedValueOnce({
        type: 'sapient-signer-leaf' as const,
        signature: '0xabcdef1234567890',
        imageHash: testImageHash,
      })

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, testRequest)
      await (result as any).handle()

      expect(mockSignSapient).toHaveBeenCalledOnce()
    })

    it.skip('Should handle zero-value chain IDs', async () => {
      mockLoadFromWitness.mockResolvedValue(mockPasskey)

      const zeroChainRequest = {
        ...testRequest,
        envelope: {
          ...testRequest.envelope,
          chainId: 0n,
        },
      }

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, zeroChainRequest)
      expect(result.status).toBe('actionable')
    })

    it.skip('Should handle empty payload gracefully', async () => {
      mockLoadFromWitness.mockResolvedValue(mockPasskey)

      const emptyPayloadRequest = {
        ...testRequest,
        envelope: {
          ...testRequest.envelope,
          payload: Payload.fromMessage('0x' as Hex.Hex),
        },
      }

      const mockSignature = {
        type: 'sapient-signer-leaf' as const,
        signature: '0xabcdef1234567890',
        imageHash: testImageHash,
      }

      mockSignSapient.mockResolvedValueOnce(mockSignature)

      const result = await passkeysHandler.status(mockExtensions.passkeys, testImageHash, emptyPayloadRequest)
      await (result as any).handle()

      expect(mockSignSapient).toHaveBeenCalledWith(
        emptyPayloadRequest.envelope.wallet,
        emptyPayloadRequest.envelope.chainId,
        emptyPayloadRequest.envelope.payload,
        testImageHash,
      )
    })
  })
})
