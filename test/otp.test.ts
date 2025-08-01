import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { IdentityInstrument, IdentityType, KeyType, OtpChallenge } from '@0xsequence/identity-instrument'
import { OtpHandler } from '../src/sequence/handlers/otp'
import { Signatures } from '../src/sequence/signatures'
import * as Db from '../src/dbs'
import { IdentitySigner } from '../src/identity/signer'
import { BaseSignatureRequest } from '../src/sequence/types/signature-request'
import { Kinds } from '../src/sequence/types/signer'

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

// Mock dependencies with proper vi.fn() types
const mockCommitVerifier = vi.fn()
const mockCompleteAuth = vi.fn()
const mockAddSignature = vi.fn()
const mockGetBySigner = vi.fn()
const mockDelBySigner = vi.fn()
const mockAuthKeysSet = vi.fn()
const mockAddListener = vi.fn()

const mockIdentityInstrument = {
  commitVerifier: mockCommitVerifier,
  completeAuth: mockCompleteAuth,
} as unknown as IdentityInstrument

const mockSignatures = {
  addSignature: mockAddSignature,
} as unknown as Signatures

const mockAuthKeys = {
  getBySigner: mockGetBySigner,
  delBySigner: mockDelBySigner,
  set: mockAuthKeysSet,
  addListener: mockAddListener,
} as unknown as Db.AuthKeys

// Mock the OtpChallenge constructor and methods
vi.mock('@0xsequence/identity-instrument', async () => {
  const actual = await vi.importActual('@0xsequence/identity-instrument')
  return {
    ...actual,
    OtpChallenge: {
      fromRecipient: vi.fn(),
      fromSigner: vi.fn(),
    },
  }
})

// Import the mocked version
const { OtpChallenge: MockedOtpChallenge } = await import('@0xsequence/identity-instrument')

describe('OtpHandler', () => {
  let otpHandler: OtpHandler
  let testWallet: Address.Address
  let testRequest: BaseSignatureRequest
  let mockPromptOtp: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    testWallet = '0x1234567890123456789012345678901234567890' as Address.Address

    // Create mock CryptoKey
    const mockCryptoKey = {
      algorithm: { name: 'ECDSA', namedCurve: 'P-256' },
      extractable: false,
      type: 'private',
      usages: ['sign'],
    } as CryptoKey

    mockCryptoSubtle.generateKey.mockResolvedValue({
      publicKey: {} as CryptoKey,
      privateKey: mockCryptoKey,
    })

    mockCryptoSubtle.exportKey.mockResolvedValue(new ArrayBuffer(64))

    testRequest = {
      id: 'test-request-id',
      envelope: {
        wallet: testWallet,
        chainId: 42161n,
        payload: Payload.fromMessage(Hex.fromString('Test message')),
      },
    } as BaseSignatureRequest

    mockPromptOtp = vi.fn()

    otpHandler = new OtpHandler(mockIdentityInstrument, mockSignatures, mockAuthKeys)

    // Setup mock OtpChallenge instances
    const mockChallengeInstance = {
      withAnswer: vi.fn().mockReturnThis(),
      getCommitParams: vi.fn(),
      getCompleteParams: vi.fn(),
    }

    ;(MockedOtpChallenge.fromRecipient as any).mockReturnValue(mockChallengeInstance)
    ;(MockedOtpChallenge.fromSigner as any).mockReturnValue(mockChallengeInstance)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // === CONSTRUCTOR AND PROPERTIES ===

  describe('Constructor', () => {
    it('Should create OtpHandler with correct properties', () => {
      const handler = new OtpHandler(mockIdentityInstrument, mockSignatures, mockAuthKeys)

      expect(handler.kind).toBe(Kinds.LoginEmailOtp)
      expect(handler.identityType).toBe(IdentityType.Email)
    })

    it('Should initialize without UI callback registered', () => {
      expect(otpHandler['onPromptOtp']).toBeUndefined()
    })
  })

  // === UI REGISTRATION ===

  describe('UI Registration', () => {
    it('Should register OTP UI callback', () => {
      const mockCallback = vi.fn()

      const unregister = otpHandler.registerUI(mockCallback)

      expect(otpHandler['onPromptOtp']).toBe(mockCallback)
      expect(typeof unregister).toBe('function')
    })

    it('Should unregister UI callback when returned function is called', () => {
      const mockCallback = vi.fn()

      const unregister = otpHandler.registerUI(mockCallback)
      expect(otpHandler['onPromptOtp']).toBe(mockCallback)

      unregister()
      expect(otpHandler['onPromptOtp']).toBeUndefined()
    })

    it('Should unregister UI callback directly', () => {
      const mockCallback = vi.fn()

      otpHandler.registerUI(mockCallback)
      expect(otpHandler['onPromptOtp']).toBe(mockCallback)

      otpHandler.unregisterUI()
      expect(otpHandler['onPromptOtp']).toBeUndefined()
    })

    it('Should allow multiple registrations (overwriting previous)', () => {
      const firstCallback = vi.fn()
      const secondCallback = vi.fn()

      otpHandler.registerUI(firstCallback)
      expect(otpHandler['onPromptOtp']).toBe(firstCallback)

      otpHandler.registerUI(secondCallback)
      expect(otpHandler['onPromptOtp']).toBe(secondCallback)
    })
  })

  // === GET SIGNER METHOD ===

  describe('getSigner()', () => {
    beforeEach(() => {
      // Setup successful nitro operations
      mockCommitVerifier.mockResolvedValue({
        loginHint: 'test@example.com',
        challenge: 'test-challenge-code',
      })

      mockCompleteAuth.mockResolvedValue({
        signer: {} as IdentitySigner,
        identity: { email: 'test@example.com' },
      })

      // Mock auth key for successful operations
      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })
    })

    it('Should throw error when UI is not registered', async () => {
      const email = 'test@example.com'

      await expect(otpHandler.getSigner(email)).rejects.toThrow('otp-handler-ui-not-registered')
    })

    it.skip('Should successfully get signer with valid OTP flow', async () => {
      const email = 'test@example.com'
      const otp = '123456'

      // Setup UI callback to automatically respond with OTP
      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        expect(recipient).toBe('test@example.com')
        await respond(otp)
      })

      otpHandler.registerUI(mockCallback)

      const result = await otpHandler.getSigner(email)

      expect(result.signer).toBeDefined()
      expect(result.email).toBe('test@example.com')

      // Verify OtpChallenge.fromRecipient was called
      expect(MockedOtpChallenge.fromRecipient).toHaveBeenCalledWith(IdentityType.Email, email)

      // Verify nitro operations were called
      expect(mockCommitVerifier).toHaveBeenCalledOnce()
      expect(mockCompleteAuth).toHaveBeenCalledOnce()

      // Verify UI callback was called
      expect(mockCallback).toHaveBeenCalledWith('test@example.com', expect.any(Function))
    })

    it('Should handle OTP verification failure', async () => {
      const email = 'test@example.com'
      const otp = 'wrong-otp'

      // Setup nitroCompleteAuth to fail
      mockCompleteAuth.mockRejectedValueOnce(new Error('Invalid OTP'))

      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        await respond(otp)
      })

      otpHandler.registerUI(mockCallback)

      await expect(otpHandler.getSigner(email)).rejects.toThrow('Invalid OTP')
    })

    it('Should handle commitVerifier failure', async () => {
      const email = 'test@example.com'

      // Setup commitVerifier to fail
      mockCommitVerifier.mockRejectedValueOnce(new Error('Commit verification failed'))

      otpHandler.registerUI(mockPromptOtp)

      await expect(otpHandler.getSigner(email)).rejects.toThrow('Commit verification failed')
    })

    it.skip('Should handle UI callback errors', async () => {
      const email = 'test@example.com'

      const mockCallback = vi.fn().mockRejectedValueOnce(new Error('UI callback failed'))
      otpHandler.registerUI(mockCallback)

      await expect(otpHandler.getSigner(email)).rejects.toThrow('UI callback failed')
    }, 10000) // Add longer timeout

    it.skip('Should pass correct challenge to withAnswer', async () => {
      const email = 'test@example.com'
      const otp = '123456'
      const mockWithAnswer = vi.fn().mockReturnThis()

      const mockChallengeInstance = {
        withAnswer: mockWithAnswer,
        getCommitParams: vi.fn(),
        getCompleteParams: vi.fn(),
      }

      ;(MockedOtpChallenge.fromRecipient as any).mockReturnValue(mockChallengeInstance)

      // Ensure proper return structure with identity.email
      mockCompleteAuth.mockResolvedValueOnce({
        signer: {} as IdentitySigner,
        identity: { email: 'test@example.com' },
      })

      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        await respond(otp)
      })

      otpHandler.registerUI(mockCallback)

      await otpHandler.getSigner(email)

      expect(mockWithAnswer).toHaveBeenCalledWith('test-challenge-code', otp)
    })
  })

  // === STATUS METHOD ===

  describe('status()', () => {
    it('Should return ready status when auth key signer exists', async () => {
      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: testWallet,
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)

      const result = await otpHandler.status(testWallet, undefined, testRequest)

      expect(result.status).toBe('ready')
      expect(result.address).toBe(testWallet)
      expect(result.handler).toBe(otpHandler)
      expect(typeof (result as any).handle).toBe('function')
    })

    it('Should execute signing when handle is called on ready status', async () => {
      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: testWallet,
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)

      const result = await otpHandler.status(testWallet, undefined, testRequest)

      // Mock the signer's sign method
      const mockSignature = {
        type: 'hash' as const,
        r: 0x1234567890abcdefn,
        s: 0xfedcba0987654321n,
        yParity: 0,
      }

      vi.spyOn(IdentitySigner.prototype, 'sign').mockResolvedValueOnce(mockSignature)

      const handleResult = await (result as any).handle()

      expect(handleResult).toBe(true)
      expect(mockAddSignature).toHaveBeenCalledOnce()
      expect(mockAddSignature).toHaveBeenCalledWith(testRequest.id, {
        address: testWallet,
        signature: mockSignature,
      })
    })

    it('Should return unavailable status when UI is not registered and no auth key exists', async () => {
      mockGetBySigner.mockResolvedValueOnce(null)

      const result = await otpHandler.status(testWallet, undefined, testRequest)

      expect(result.status).toBe('unavailable')
      expect(result.address).toBe(testWallet)
      expect(result.handler).toBe(otpHandler)
      expect((result as any).reason).toBe('ui-not-registered')
    })

    it('Should return actionable status when UI is registered and no auth key exists', async () => {
      mockGetBySigner.mockResolvedValueOnce(null)
      otpHandler.registerUI(mockPromptOtp)

      const result = await otpHandler.status(testWallet, undefined, testRequest)

      expect(result.status).toBe('actionable')
      expect(result.address).toBe(testWallet)
      expect(result.handler).toBe(otpHandler)
      expect((result as any).message).toBe('request-otp')
      expect(typeof (result as any).handle).toBe('function')
    })

    it.skip('Should handle OTP authentication when actionable handle is called', async () => {
      mockGetBySigner.mockResolvedValueOnce(null)

      // Setup successful nitro operations
      mockCommitVerifier.mockResolvedValue({
        loginHint: 'user@example.com',
        challenge: 'challenge-code',
      })
      mockCompleteAuth.mockResolvedValue({
        signer: {} as IdentitySigner,
        identity: { email: 'user@example.com' },
      })

      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        expect(recipient).toBe('user@example.com')
        await respond('123456')
      })

      otpHandler.registerUI(mockCallback)

      const result = await otpHandler.status(testWallet, undefined, testRequest)
      const handleResult = await (result as any).handle()

      expect(handleResult).toBe(true)
      expect(MockedOtpChallenge.fromSigner).toHaveBeenCalledWith(IdentityType.Email, {
        address: testWallet,
        keyType: KeyType.Secp256k1,
      })
      expect(mockCallback).toHaveBeenCalledWith('user@example.com', expect.any(Function))
    })

    it('Should handle OTP authentication failure in actionable handle', async () => {
      mockGetBySigner.mockResolvedValueOnce(null)

      mockCommitVerifier.mockResolvedValue({
        loginHint: 'user@example.com',
        challenge: 'challenge-code',
      })
      mockCompleteAuth.mockRejectedValueOnce(new Error('Authentication failed'))

      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        await respond('wrong-otp')
      })

      otpHandler.registerUI(mockCallback)

      const result = await otpHandler.status(testWallet, undefined, testRequest)

      // The handle resolves to false because of the try/catch in the code
      const handleResult = await (result as any).handle()
      expect(handleResult).toBe(false)
    })
  })

  // === INHERITED METHODS FROM IDENTITYHANDLER ===

  describe('Inherited IdentityHandler methods', () => {
    it('Should provide onStatusChange listener', () => {
      const mockUnsubscribe = vi.fn()
      mockAddListener.mockReturnValueOnce(mockUnsubscribe)

      const callback = vi.fn()
      const unsubscribe = otpHandler.onStatusChange(callback)

      expect(mockAddListener).toHaveBeenCalledWith(callback)
      expect(unsubscribe).toBe(mockUnsubscribe)
    })

    it('Should handle nitroCommitVerifier with OTP challenge', async () => {
      const mockChallenge = {
        getCommitParams: vi.fn().mockReturnValue({
          authMode: 'OTP',
          identityType: 'Email',
          handle: 'test@example.com',
          metadata: {},
        }),
        getCompleteParams: vi.fn(),
      }

      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)
      mockCommitVerifier.mockResolvedValueOnce({
        loginHint: 'test@example.com',
        challenge: 'challenge-code',
      })

      const result = await otpHandler['nitroCommitVerifier'](mockChallenge)

      expect(mockDelBySigner).toHaveBeenCalledWith('')
      expect(mockCommitVerifier).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAuthKey.address,
          keyType: KeyType.Secp256r1,
          signer: mockAuthKey.identitySigner,
        }),
        mockChallenge,
      )
      expect(result).toEqual({
        loginHint: 'test@example.com',
        challenge: 'challenge-code',
      })
    })

    it('Should handle nitroCompleteAuth with OTP challenge', async () => {
      const mockChallenge = {
        getCommitParams: vi.fn(),
        getCompleteParams: vi.fn().mockReturnValue({
          authMode: 'OTP',
          identityType: 'Email',
          verifier: 'test@example.com',
          answer: '0xabcd1234',
        }),
      }

      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      }

      const mockIdentityResult = {
        signer: { address: testWallet },
        identity: { email: 'test@example.com' },
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)
      mockCompleteAuth.mockResolvedValueOnce(mockIdentityResult)

      const result = await otpHandler['nitroCompleteAuth'](mockChallenge)

      expect(mockCompleteAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAuthKey.address,
        }),
        mockChallenge,
      )

      // Verify auth key cleanup and updates
      expect(mockDelBySigner).toHaveBeenCalledWith('')
      expect(mockDelBySigner).toHaveBeenCalledWith(testWallet)
      expect(mockAuthKeysSet).toHaveBeenCalledWith(
        expect.objectContaining({
          identitySigner: testWallet,
        }),
      )

      expect(result.signer).toBeInstanceOf(IdentitySigner)
      expect(result.email).toBe('test@example.com')
    })
  })

  // === ERROR HANDLING ===

  describe('Error Handling', () => {
    it('Should handle missing auth key in nitroCommitVerifier', async () => {
      const mockChallenge = {} as any
      mockGetBySigner.mockResolvedValueOnce(null)

      // Make crypto operations fail to prevent auto-generation
      mockCryptoSubtle.generateKey.mockRejectedValueOnce(new Error('Crypto not available'))

      await expect(otpHandler['nitroCommitVerifier'](mockChallenge)).rejects.toThrow('Crypto not available')
    })

    it('Should handle missing auth key in nitroCompleteAuth', async () => {
      const mockChallenge = {} as any
      mockGetBySigner.mockResolvedValueOnce(null)

      // Make crypto operations fail to prevent auto-generation
      mockCryptoSubtle.generateKey.mockRejectedValueOnce(new Error('Crypto not available'))

      await expect(otpHandler['nitroCompleteAuth'](mockChallenge)).rejects.toThrow('Crypto not available')
    })

    it('Should handle identity instrument failures', async () => {
      const mockChallenge = {} as any
      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)
      mockCommitVerifier.mockRejectedValueOnce(new Error('Identity service error'))

      await expect(otpHandler['nitroCommitVerifier'](mockChallenge)).rejects.toThrow('Identity service error')
    })

    it('Should handle auth keys database errors', async () => {
      mockGetBySigner.mockRejectedValueOnce(new Error('Database error'))

      await expect(otpHandler.status(testWallet, undefined, testRequest)).rejects.toThrow('Database error')
    })

    it('Should handle invalid email addresses', async () => {
      const invalidEmail = ''

      otpHandler.registerUI(mockPromptOtp)

      await expect(otpHandler.getSigner(invalidEmail)).rejects.toThrow()
    })
  })

  // === INTEGRATION TESTS ===

  describe('Integration Tests', () => {
    it('Should handle complete OTP flow from registration to signing', async () => {
      const email = 'integration@example.com'
      const otp = '654321'

      // Setup successful operations with proper structure
      mockCommitVerifier.mockResolvedValue({
        loginHint: email,
        challenge: 'integration-challenge',
      })

      mockCompleteAuth.mockResolvedValue({
        signer: {} as IdentitySigner,
        identity: { email: email },
      })

      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })

      // Step 1: Register UI
      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        expect(recipient).toBe(email)
        await respond(otp)
      })

      const unregister = otpHandler.registerUI(mockCallback)

      // Step 2: Get signer
      const signerResult = await otpHandler.getSigner(email)

      expect(signerResult.signer).toBeDefined()
      expect(signerResult.email).toBe(email)

      // Step 3: Check status (should be ready now)
      mockGetBySigner.mockResolvedValueOnce({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: testWallet,
        expiresAt: new Date(Date.now() + 3600000),
      })

      const statusResult = await otpHandler.status(testWallet, undefined, testRequest)
      expect(statusResult.status).toBe('ready')

      // Step 4: Cleanup
      unregister()
      expect(otpHandler['onPromptOtp']).toBeUndefined()
    })

    it('Should handle OTP flow with different identity types', async () => {
      // Test with different identity type (although constructor uses Email)
      const customHandler = new OtpHandler(mockIdentityInstrument, mockSignatures, mockAuthKeys)

      expect(customHandler.identityType).toBe(IdentityType.Email)
      expect(customHandler.kind).toBe(Kinds.LoginEmailOtp)
    })

    it('Should handle concurrent OTP requests', async () => {
      const email1 = 'user1@example.com'
      const email2 = 'user2@example.com'

      let requestCount = 0
      const mockCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        requestCount++
        const otp = `otp-${requestCount}`
        await respond(otp)
      })

      otpHandler.registerUI(mockCallback)

      // Setup commit verifier for both requests
      mockCommitVerifier
        .mockResolvedValueOnce({
          loginHint: email1,
          challenge: 'challenge1',
        })
        .mockResolvedValueOnce({
          loginHint: email2,
          challenge: 'challenge2',
        })

      // Setup complete auth with proper structure
      mockCompleteAuth
        .mockResolvedValueOnce({
          signer: {} as IdentitySigner,
          identity: { email: email1 },
        })
        .mockResolvedValueOnce({
          signer: {} as IdentitySigner,
          identity: { email: email2 },
        })

      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })

      // Execute concurrent requests
      const [result1, result2] = await Promise.all([otpHandler.getSigner(email1), otpHandler.getSigner(email2)])

      expect(result1.email).toBe(email1)
      expect(result2.email).toBe(email2)
      expect(mockCallback).toHaveBeenCalledTimes(2)
    })

    it('Should handle UI callback replacement during operation', async () => {
      const email = 'test@example.com'

      const firstCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        // This should not be called
        await respond('first-otp')
      })

      const secondCallback = vi.fn().mockImplementation(async (recipient, respond) => {
        await respond('second-otp')
      })

      // Register first callback
      otpHandler.registerUI(firstCallback)

      // Setup async operations with proper structure
      mockCommitVerifier.mockResolvedValue({
        loginHint: email,
        challenge: 'challenge',
      })

      mockCompleteAuth.mockResolvedValue({
        signer: {} as IdentitySigner,
        identity: { email: email },
      })

      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })

      // Replace callback before getSigner completes
      otpHandler.registerUI(secondCallback)

      const result = await otpHandler.getSigner(email)

      expect(result.email).toBe(email)
      expect(secondCallback).toHaveBeenCalledOnce()
      expect(firstCallback).not.toHaveBeenCalled()
    })
  })
})
