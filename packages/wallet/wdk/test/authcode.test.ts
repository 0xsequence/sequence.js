import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex, Bytes } from 'ox'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { IdentityInstrument, IdentityType, KeyType, AuthCodeChallenge } from '@0xsequence/identity-instrument'
import { AuthCodeHandler } from '../src/sequence/handlers/authcode'
import { Signatures } from '../src/sequence/signatures'
import * as Db from '../src/dbs'
import { IdentitySigner } from '../src/identity/signer'
import { BaseSignatureRequest } from '../src/sequence/types/signature-request'

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
    location: {
      pathname: '/test-path',
      href: '',
    },
  },
  writable: true,
})

// Mock URLSearchParams
class MockURLSearchParams {
  private params: Record<string, string> = {}

  constructor(params?: Record<string, string>) {
    if (params) {
      this.params = { ...params }
    }
  }

  toString() {
    return Object.entries(this.params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
  }
}

// @ts-ignore - Override global URLSearchParams for testing
global.URLSearchParams = MockURLSearchParams as any

// Mock dependencies with proper vi.fn() types
const mockCommitVerifier = vi.fn()
const mockCompleteAuth = vi.fn()
const mockAddSignature = vi.fn()
const mockAuthCommitmentsSet = vi.fn()
const mockAuthCommitmentsGet = vi.fn()
const mockAuthCommitmentsDel = vi.fn()
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

const mockAuthCommitments = {
  set: mockAuthCommitmentsSet,
  get: mockAuthCommitmentsGet,
  del: mockAuthCommitmentsDel,
} as unknown as Db.AuthCommitments

const mockAuthKeys = {
  getBySigner: mockGetBySigner,
  delBySigner: mockDelBySigner,
  set: mockAuthKeysSet,
  addListener: mockAddListener,
} as unknown as Db.AuthKeys

describe('AuthCodeHandler', () => {
  let authCodeHandler: AuthCodeHandler
  let testWallet: Address.Address
  let testCommitment: Db.AuthCommitment
  let testRequest: BaseSignatureRequest

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

    testCommitment = {
      id: 'test-state-123',
      kind: 'google-pkce',
      metadata: {},
      target: '/test-target',
      isSignUp: false,
      signer: testWallet,
    }

    testRequest = {
      id: 'test-request-id',
      envelope: {
        wallet: testWallet,
        chainId: Network.ChainId.ARBITRUM,
        payload: Payload.fromMessage(Hex.fromString('Test message')),
      },
    } as BaseSignatureRequest

    authCodeHandler = new AuthCodeHandler(
      'google-pkce',
      'https://accounts.google.com',
      'test-audience',
      mockIdentityInstrument,
      mockSignatures,
      mockAuthCommitments,
      mockAuthKeys,
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // === CONSTRUCTOR AND PROPERTIES ===

  describe('Constructor', () => {
    it('Should create AuthCodeHandler with Google PKCE configuration', () => {
      const handler = new AuthCodeHandler(
        'google-pkce',
        'https://accounts.google.com',
        'google-client-id',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      expect(handler.signupKind).toBe('google-pkce')
      expect(handler.issuer).toBe('https://accounts.google.com')
      expect(handler.audience).toBe('google-client-id')
      expect(handler.identityType).toBe(IdentityType.OIDC)
    })

    it('Should create AuthCodeHandler with Apple configuration', () => {
      const handler = new AuthCodeHandler(
        'apple',
        'https://appleid.apple.com',
        'apple-client-id',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      expect(handler.signupKind).toBe('apple')
      expect(handler.issuer).toBe('https://appleid.apple.com')
      expect(handler.audience).toBe('apple-client-id')
    })

    it('Should initialize with empty redirect URI', () => {
      expect(authCodeHandler['redirectUri']).toBe('')
    })
  })

  // === KIND GETTER ===

  describe('kind getter', () => {
    it('Should return login-google-pkce for Google PKCE handler', () => {
      const googleHandler = new AuthCodeHandler(
        'google-pkce',
        'https://accounts.google.com',
        'test-audience',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      expect(googleHandler.kind).toBe('login-google-pkce')
    })

    it('Should return login-apple for Apple handler', () => {
      const appleHandler = new AuthCodeHandler(
        'apple',
        'https://appleid.apple.com',
        'test-audience',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      expect(appleHandler.kind).toBe('login-apple')
    })
  })

  // === REDIRECT URI MANAGEMENT ===

  describe('setRedirectUri()', () => {
    it('Should set redirect URI', () => {
      const testUri = 'https://example.com/callback'

      authCodeHandler.setRedirectUri(testUri)

      expect(authCodeHandler['redirectUri']).toBe(testUri)
    })

    it('Should update redirect URI when called multiple times', () => {
      authCodeHandler.setRedirectUri('https://first.com/callback')
      authCodeHandler.setRedirectUri('https://second.com/callback')

      expect(authCodeHandler['redirectUri']).toBe('https://second.com/callback')
    })
  })

  // === COMMIT AUTH FLOW ===

  describe('commitAuth()', () => {
    beforeEach(() => {
      authCodeHandler.setRedirectUri('https://example.com/callback')
    })

    it('Should create auth commitment and return OAuth URL', async () => {
      const target = '/test-target'
      const isSignUp = true
      const signer = testWallet

      const result = await authCodeHandler.commitAuth(target, isSignUp, undefined, signer)

      // Verify commitment was saved
      expect(mockAuthCommitmentsSet).toHaveBeenCalledOnce()
      const commitmentCall = mockAuthCommitmentsSet.mock.calls[0][0]

      expect(commitmentCall.kind).toBe('google-pkce')
      expect(commitmentCall.signer).toBe(signer)
      expect(commitmentCall.target).toBe(target)
      expect(commitmentCall.metadata).toEqual({})
      expect(commitmentCall.isSignUp).toBe(isSignUp)
      expect(commitmentCall.id).toBeDefined()
      expect(typeof commitmentCall.id).toBe('string')

      // Verify OAuth URL structure
      expect(result).toContain('https://accounts.google.com/o/oauth2/v2/auth?')
      expect(result).toContain('client_id=test-audience')
      expect(result).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback') // Fix URL encoding
      expect(result).toContain('response_type=code')
      expect(result).toContain('scope=openid')
      expect(result).toContain(`state=${commitmentCall.id}`)
    })

    it('Should use provided state parameter', async () => {
      const customState = 'custom-state-123'

      const result = await authCodeHandler.commitAuth('/target', false, customState)

      // Verify commitment uses custom state
      const commitmentCall = mockAuthCommitmentsSet.mock.calls[0][0]
      expect(commitmentCall.id).toBe(customState)
      expect(result).toContain(`state=${customState}`)
    })

    it('Should generate random state when not provided', async () => {
      const result = await authCodeHandler.commitAuth('/target', false)

      const commitmentCall = mockAuthCommitmentsSet.mock.calls[0][0]
      expect(commitmentCall.id).toBeDefined()
      expect(typeof commitmentCall.id).toBe('string')
      expect(commitmentCall.id.startsWith('0x')).toBe(true)
      expect(commitmentCall.id.length).toBe(66) // 0x + 64 hex chars
    })

    it('Should handle Apple OAuth URL', async () => {
      const appleHandler = new AuthCodeHandler(
        'apple',
        'https://appleid.apple.com',
        'apple-client-id',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )
      appleHandler.setRedirectUri('https://example.com/callback')

      const result = await appleHandler.commitAuth('/target', false)

      expect(result).toContain('https://appleid.apple.com/auth/authorize?')
      expect(result).toContain('client_id=apple-client-id')
    })

    it('Should create commitment without signer', async () => {
      const result = await authCodeHandler.commitAuth('/target', true)

      const commitmentCall = mockAuthCommitmentsSet.mock.calls[0][0]
      expect(commitmentCall.signer).toBeUndefined()
      expect(commitmentCall.isSignUp).toBe(true)
    })
  })

  // === COMPLETE AUTH FLOW ===

  describe('completeAuth()', () => {
    it('Should complete auth flow with code and return signer', async () => {
      const authCode = 'test-auth-code-123'
      const mockSigner = {} as IdentitySigner
      const mockEmail = 'test@example.com'

      mockCommitVerifier.mockResolvedValueOnce(undefined)
      mockCompleteAuth.mockResolvedValueOnce({
        signer: { address: testWallet },
        identity: { email: mockEmail },
      })

      // Mock getAuthKey to return a key for the commitVerifier and completeAuth calls
      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })

      const [signer, metadata] = await authCodeHandler.completeAuth(testCommitment, authCode)

      // Verify commitVerifier was called
      expect(mockCommitVerifier).toHaveBeenCalledOnce()
      const commitVerifierCall = mockCommitVerifier.mock.calls[0]
      expect(commitVerifierCall[1]).toBeInstanceOf(AuthCodeChallenge)

      // Verify completeAuth was called
      expect(mockCompleteAuth).toHaveBeenCalledOnce()
      const completeAuthCall = mockCompleteAuth.mock.calls[0]
      expect(completeAuthCall[1]).toBeInstanceOf(AuthCodeChallenge)

      // Verify results
      expect(signer).toBeInstanceOf(IdentitySigner)
      expect(metadata.email).toBe(mockEmail)
    })

    it('Should complete auth flow with existing signer', async () => {
      const authCode = 'test-auth-code-123'
      const commitmentWithSigner = { ...testCommitment, signer: testWallet }

      mockCommitVerifier.mockResolvedValueOnce(undefined)
      mockCompleteAuth.mockResolvedValueOnce({
        signer: { address: testWallet },
        identity: { email: 'test@example.com' },
      })

      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })

      const [signer, metadata] = await authCodeHandler.completeAuth(commitmentWithSigner, authCode)

      expect(signer).toBeDefined()
      expect(metadata.email).toBe('test@example.com')
    })

    it('Should handle commitVerifier failure', async () => {
      const authCode = 'test-auth-code-123'

      mockGetBySigner.mockResolvedValue(null)

      // The actual error comes from trying to access commitment.signer
      await expect(authCodeHandler.completeAuth(testCommitment, authCode)).rejects.toThrow(
        'Cannot read properties of undefined',
      )
    })

    it('Should handle completeAuth failure', async () => {
      const authCode = 'test-auth-code-123'

      mockCommitVerifier.mockResolvedValueOnce(undefined)
      mockCompleteAuth.mockRejectedValueOnce(new Error('OAuth verification failed'))

      mockGetBySigner.mockResolvedValue({
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      })

      await expect(authCodeHandler.completeAuth(testCommitment, authCode)).rejects.toThrow('OAuth verification failed')
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

      const result = await authCodeHandler.status(testWallet, undefined, testRequest)

      expect(result.status).toBe('ready')
      expect(result.address).toBe(testWallet)
      expect(result.handler).toBe(authCodeHandler)
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

      const result = await authCodeHandler.status(testWallet, undefined, testRequest)

      // Mock the signer's sign method
      const mockSignature = {
        type: 'hash' as const,
        r: 0x1234567890abcdefn,
        s: 0xfedcba0987654321n,
        yParity: 0,
      }

      // We need to mock the IdentitySigner's sign method
      vi.spyOn(IdentitySigner.prototype, 'sign').mockResolvedValueOnce(mockSignature)

      const handleResult = await (result as any).handle()

      expect(handleResult).toBe(true)
      expect(mockAddSignature).toHaveBeenCalledOnce()
      expect(mockAddSignature).toHaveBeenCalledWith(testRequest.id, {
        address: testWallet,
        signature: mockSignature,
      })
    })

    it('Should return actionable status when no auth key signer exists', async () => {
      mockGetBySigner.mockResolvedValueOnce(null)

      const result = await authCodeHandler.status(testWallet, undefined, testRequest)

      expect(result.status).toBe('actionable')
      expect(result.address).toBe(testWallet)
      expect(result.handler).toBe(authCodeHandler)
      expect((result as any).message).toBe('request-redirect')
      expect(typeof (result as any).handle).toBe('function')
    })

    it('Should redirect to OAuth when handle is called on actionable status', async () => {
      authCodeHandler.setRedirectUri('https://example.com/callback')
      mockGetBySigner.mockResolvedValueOnce(null)

      const result = await authCodeHandler.status(testWallet, undefined, testRequest)

      const handleResult = await (result as any).handle()

      expect(handleResult).toBe(true)
      expect(window.location.href).toContain('https://accounts.google.com/o/oauth2/v2/auth')
      expect(mockAuthCommitmentsSet).toHaveBeenCalledOnce()

      const commitmentCall = mockAuthCommitmentsSet.mock.calls[0][0]
      expect(commitmentCall.target).toBe(window.location.pathname)
      expect(commitmentCall.isSignUp).toBe(false)
      expect(commitmentCall.signer).toBe(testWallet)
    })
  })

  // === OAUTH URL METHOD ===

  describe('oauthUrl()', () => {
    it('Should return Google OAuth URL for Google issuer', () => {
      const googleHandler = new AuthCodeHandler(
        'google-pkce',
        'https://accounts.google.com',
        'test-audience',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      const url = googleHandler['oauthUrl']()
      expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    })

    it('Should return Apple OAuth URL for Apple issuer', () => {
      const appleHandler = new AuthCodeHandler(
        'apple',
        'https://appleid.apple.com',
        'test-audience',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      const url = appleHandler['oauthUrl']()
      expect(url).toBe('https://appleid.apple.com/auth/authorize')
    })

    it('Should throw error for unsupported issuer', () => {
      const unsupportedHandler = new AuthCodeHandler(
        'google-pkce',
        'https://unsupported.provider.com',
        'test-audience',
        mockIdentityInstrument,
        mockSignatures,
        mockAuthCommitments,
        mockAuthKeys,
      )

      expect(() => unsupportedHandler['oauthUrl']()).toThrow('unsupported-issuer')
    })
  })

  // === INHERITED METHODS FROM IDENTITYHANDLER ===

  describe('Inherited IdentityHandler methods', () => {
    it('Should provide onStatusChange listener', () => {
      const mockUnsubscribe = vi.fn()
      mockAddListener.mockReturnValueOnce(mockUnsubscribe)

      const callback = vi.fn()
      const unsubscribe = authCodeHandler.onStatusChange(callback)

      expect(mockAddListener).toHaveBeenCalledWith(callback)
      expect(unsubscribe).toBe(mockUnsubscribe)
    })

    it('Should handle nitroCommitVerifier with auth key cleanup', async () => {
      const mockChallenge = {} as any
      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)
      mockCommitVerifier.mockResolvedValueOnce('result')

      const result = await authCodeHandler['nitroCommitVerifier'](mockChallenge)

      expect(mockDelBySigner).toHaveBeenCalledWith('')
      expect(mockCommitVerifier).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAuthKey.address,
          keyType: KeyType.WebCrypto_Secp256r1,
          signer: mockAuthKey.identitySigner,
        }),
        mockChallenge,
      )
      expect(result).toBe('result')
    })

    it('Should handle nitroCompleteAuth with auth key management', async () => {
      const mockChallenge = {} as any
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

      const result = await authCodeHandler['nitroCompleteAuth'](mockChallenge)

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
    it('Should handle missing auth key in commitVerifier', async () => {
      const mockChallenge = {} as any
      mockGetBySigner.mockResolvedValueOnce(null)

      // Make crypto operations fail to prevent auto-generation of auth key
      mockCryptoSubtle.generateKey.mockRejectedValueOnce(new Error('Crypto not available'))

      await expect(authCodeHandler['nitroCommitVerifier'](mockChallenge)).rejects.toThrow('Crypto not available')
    })

    it('Should handle missing auth key in completeAuth', async () => {
      const mockChallenge = {} as any
      mockGetBySigner.mockResolvedValueOnce(null)

      // Make crypto operations fail to prevent auto-generation of auth key
      mockCryptoSubtle.generateKey.mockRejectedValueOnce(new Error('Crypto not available'))

      await expect(authCodeHandler['nitroCompleteAuth'](mockChallenge)).rejects.toThrow('Crypto not available')
    })

    it('Should handle identity instrument failures in commitVerifier', async () => {
      const mockChallenge = {} as any
      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValueOnce(mockAuthKey)
      mockCommitVerifier.mockRejectedValueOnce(new Error('Identity service error'))

      await expect(authCodeHandler['nitroCommitVerifier'](mockChallenge)).rejects.toThrow('Identity service error')
    })

    it('Should handle auth commitments database errors', async () => {
      mockAuthCommitmentsSet.mockRejectedValueOnce(new Error('Database error'))

      await expect(authCodeHandler.commitAuth('/target', false)).rejects.toThrow('Database error')
    })

    it('Should handle auth keys database errors', async () => {
      mockGetBySigner.mockRejectedValueOnce(new Error('Database error'))

      await expect(authCodeHandler.status(testWallet, undefined, testRequest)).rejects.toThrow('Database error')
    })
  })

  // === INTEGRATION TESTS ===

  describe('Integration Tests', () => {
    it('Should handle complete OAuth flow from commitment to completion', async () => {
      authCodeHandler.setRedirectUri('https://example.com/callback')

      // Step 1: Commit auth
      const commitUrl = await authCodeHandler.commitAuth('/test-target', false, 'test-state', testWallet)

      expect(commitUrl).toContain('state=test-state')
      expect(mockAuthCommitmentsSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-state',
          kind: 'google-pkce',
          target: '/test-target',
          isSignUp: false,
          signer: testWallet,
        }),
      )

      // Step 2: Complete auth
      const mockAuthKey = {
        address: '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1',
        privateKey: {} as CryptoKey,
        identitySigner: '',
        expiresAt: new Date(Date.now() + 3600000),
      }

      mockGetBySigner.mockResolvedValue(mockAuthKey)
      mockCommitVerifier.mockResolvedValueOnce(undefined)
      mockCompleteAuth.mockResolvedValueOnce({
        signer: { address: testWallet },
        identity: { email: 'test@example.com' },
      })

      const [signer, metadata] = await authCodeHandler.completeAuth(testCommitment, 'auth-code-123')

      expect(signer).toBeInstanceOf(IdentitySigner)
      expect(metadata.email).toBe('test@example.com')
    })

    it('Should handle different OAuth providers correctly', async () => {
      const providers = [
        {
          signupKind: 'google-pkce' as const,
          issuer: 'https://accounts.google.com',
          expectedUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        },
        {
          signupKind: 'apple' as const,
          issuer: 'https://appleid.apple.com',
          expectedUrl: 'https://appleid.apple.com/auth/authorize',
        },
      ]

      for (const provider of providers) {
        const handler = new AuthCodeHandler(
          provider.signupKind,
          provider.issuer,
          'test-audience',
          mockIdentityInstrument,
          mockSignatures,
          mockAuthCommitments,
          mockAuthKeys,
        )
        handler.setRedirectUri('https://example.com/callback')

        const url = await handler.commitAuth('/target', false)
        expect(url).toContain(provider.expectedUrl)
        expect(handler.kind).toBe(`login-${provider.signupKind}`)
      }
    })

    it('Should handle signup vs login flows correctly', async () => {
      authCodeHandler.setRedirectUri('https://example.com/callback')

      // Test signup flow
      await authCodeHandler.commitAuth('/signup-target', true, 'signup-state')

      const signupCall = mockAuthCommitmentsSet.mock.calls[0][0]
      expect(signupCall.isSignUp).toBe(true)
      expect(signupCall.target).toBe('/signup-target')

      // Test login flow
      await authCodeHandler.commitAuth('/login-target', false, 'login-state')

      const loginCall = mockAuthCommitmentsSet.mock.calls[1][0]
      expect(loginCall.isSignUp).toBe(false)
      expect(loginCall.target).toBe('/login-target')
    })
  })
})
