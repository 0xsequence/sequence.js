import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex, Bytes } from 'ox'
import * as Identity from '@0xsequence/identity-instrument'
import { AuthCodePkceHandler } from '../src/sequence/handlers/authcode-pkce'
import { Signatures } from '../src/sequence/signatures'
import * as Db from '../src/dbs'
import { IdentitySigner } from '../src/identity/signer'

describe('AuthCodePkceHandler', () => {
  let handler: AuthCodePkceHandler
  let mockNitroInstrument: Identity.IdentityInstrument
  let mockSignatures: Signatures
  let mockCommitments: Db.AuthCommitments
  let mockAuthKeys: Db.AuthKeys
  let mockIdentitySigner: IdentitySigner

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock IdentityInstrument
    mockNitroInstrument = {
      commitVerifier: vi.fn(),
      completeAuth: vi.fn(),
    } as unknown as Identity.IdentityInstrument

    // Mock Signatures
    mockSignatures = {
      addSignature: vi.fn(),
    } as unknown as Signatures

    // Mock AuthCommitments database
    mockCommitments = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      list: vi.fn(),
    } as unknown as Db.AuthCommitments

    // Mock AuthKeys database
    mockAuthKeys = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      delBySigner: vi.fn(),
      getBySigner: vi.fn(),
      addListener: vi.fn(),
    } as unknown as Db.AuthKeys

    // Mock IdentitySigner
    mockIdentitySigner = {
      address: '0x1234567890123456789012345678901234567890',
      sign: vi.fn(),
    } as unknown as IdentitySigner

    // Create handler instance
    handler = new AuthCodePkceHandler(
      'google-pkce',
      'https://accounts.google.com',
      'test-google-client-id',
      mockNitroInstrument,
      mockSignatures,
      mockCommitments,
      mockAuthKeys,
    )

    // Set redirect URI for tests
    handler.setRedirectUri('https://example.com/auth/callback')

    // Mock inherited methods
    vi.spyOn(handler as any, 'nitroCommitVerifier').mockImplementation(async (challenge) => {
      return {
        verifier: 'mock-verifier-code',
        loginHint: 'user@example.com',
        challenge: 'mock-challenge-hash',
      }
    })

    vi.spyOn(handler as any, 'nitroCompleteAuth').mockImplementation(async (challenge) => {
      return {
        signer: mockIdentitySigner,
        email: 'user@example.com',
      }
    })

    vi.spyOn(handler as any, 'oauthUrl').mockReturnValue('https://accounts.google.com/oauth/authorize')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('commitAuth', () => {
    it('Should create Google PKCE auth commitment and return OAuth URL', async () => {
      const target = 'https://example.com/success'
      const isSignUp = true

      const result = await handler.commitAuth(target, isSignUp)

      // Verify nitroCommitVerifier was called with correct challenge
      expect(handler['nitroCommitVerifier']).toHaveBeenCalledWith(
        expect.objectContaining({
          issuer: 'https://accounts.google.com',
          audience: 'test-google-client-id',
        }),
      )

      // Verify commitment was saved
      expect(mockCommitments.set).toHaveBeenCalledWith({
        id: expect.any(String),
        kind: 'google-pkce',
        verifier: 'mock-verifier-code',
        challenge: 'mock-challenge-hash',
        target,
        metadata: {},
        isSignUp,
      })

      // Verify OAuth URL is constructed correctly
      expect(result).toMatch(/^https:\/\/accounts\.google\.com\/oauth\/authorize\?/)
      expect(result).toContain('code_challenge=mock-challenge-hash')
      expect(result).toContain('code_challenge_method=S256')
      expect(result).toContain('client_id=test-google-client-id')
      expect(result).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fcallback')
      expect(result).toContain('login_hint=user%40example.com')
      expect(result).toContain('response_type=code')
      expect(result).toContain('scope=openid+profile+email') // + is valid URL encoding for spaces
      expect(result).toContain('state=')
    })

    it('Should use provided state instead of generating random one', async () => {
      const target = 'https://example.com/success'
      const isSignUp = false
      const customState = 'custom-state-123'

      const result = await handler.commitAuth(target, isSignUp, customState)

      // Verify commitment was saved with custom state
      expect(mockCommitments.set).toHaveBeenCalledWith({
        id: customState,
        kind: 'google-pkce',
        verifier: 'mock-verifier-code',
        challenge: 'mock-challenge-hash',
        target,
        metadata: {},
        isSignUp,
      })

      // Verify URL contains custom state
      expect(result).toContain(`state=${customState}`)
    })

    it('Should include signer in challenge when provided', async () => {
      const target = 'https://example.com/success'
      const isSignUp = true
      const signer = '0x9876543210987654321098765432109876543210'

      await handler.commitAuth(target, isSignUp, undefined, signer)

      // Verify nitroCommitVerifier was called with signer in challenge
      expect(handler['nitroCommitVerifier']).toHaveBeenCalledWith(
        expect.objectContaining({
          signer: { address: signer, keyType: Identity.KeyType.Ethereum_Secp256k1 },
        }),
      )
    })

    it('Should generate random state when not provided', async () => {
      const target = 'https://example.com/success'
      const isSignUp = true

      const result = await handler.commitAuth(target, isSignUp)

      // Verify that a state parameter is present and looks like a hex string
      expect(result).toMatch(/state=0x[a-f0-9]+/)
      expect(mockCommitments.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^0x[a-f0-9]+$/),
        }),
      )
    })

    it('Should handle different signup and login scenarios', async () => {
      const target = 'https://example.com/success'

      // Test signup
      await handler.commitAuth(target, true)
      expect(mockCommitments.set).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isSignUp: true,
        }),
      )

      // Test login
      await handler.commitAuth(target, false)
      expect(mockCommitments.set).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isSignUp: false,
        }),
      )
    })

    it('Should handle errors from nitroCommitVerifier', async () => {
      vi.spyOn(handler as any, 'nitroCommitVerifier').mockRejectedValue(new Error('Nitro service unavailable'))

      await expect(handler.commitAuth('https://example.com/success', true)).rejects.toThrow('Nitro service unavailable')
    })

    it('Should handle database errors during commitment storage', async () => {
      vi.mocked(mockCommitments.set).mockRejectedValue(new Error('Database write failed'))

      await expect(handler.commitAuth('https://example.com/success', true)).rejects.toThrow('Database write failed')
    })
  })

  describe('completeAuth', () => {
    let mockCommitment: Db.AuthCommitment

    beforeEach(() => {
      mockCommitment = {
        id: 'test-commitment-123',
        kind: 'google-pkce',
        verifier: 'test-verifier-code',
        challenge: 'test-challenge-hash',
        target: 'https://example.com/success',
        metadata: { scope: 'openid profile email' },
        isSignUp: true,
      }
    })

    it('Should complete auth and return signer with metadata', async () => {
      const authCode = 'auth-code-from-google'

      const result = await handler.completeAuth(mockCommitment, authCode)

      // Verify nitroCompleteAuth was called with correct challenge
      expect(handler['nitroCompleteAuth']).toHaveBeenCalledWith(
        expect.objectContaining({
          verifier: 'test-verifier-code',
          authCode: authCode,
        }),
      )

      // Verify commitment was deleted
      expect(mockCommitments.del).toHaveBeenCalledWith(mockCommitment.id)

      // Verify return value
      expect(result).toEqual([
        mockIdentitySigner,
        {
          scope: 'openid profile email',
          email: 'user@example.com',
        },
      ])
    })

    it('Should merge commitment metadata with email from auth response', async () => {
      mockCommitment.metadata = {
        customField: 'customValue',
        scope: 'openid profile email',
      }

      const result = await handler.completeAuth(mockCommitment, 'auth-code')

      expect(result[1]).toEqual({
        customField: 'customValue',
        scope: 'openid profile email',
        email: 'user@example.com',
      })
    })

    it('Should throw error when verifier is missing from commitment', async () => {
      const invalidCommitment = {
        ...mockCommitment,
        verifier: undefined,
      }

      await expect(handler.completeAuth(invalidCommitment, 'auth-code')).rejects.toThrow(
        'Missing verifier in commitment',
      )

      // Verify nitroCompleteAuth was not called
      expect(handler['nitroCompleteAuth']).not.toHaveBeenCalled()
    })

    it('Should handle errors from nitroCompleteAuth', async () => {
      vi.spyOn(handler as any, 'nitroCompleteAuth').mockRejectedValue(new Error('Invalid auth code'))

      await expect(handler.completeAuth(mockCommitment, 'invalid-code')).rejects.toThrow('Invalid auth code')

      // Verify commitment was not deleted on error
      expect(mockCommitments.del).not.toHaveBeenCalled()
    })

    it('Should handle database errors during commitment deletion', async () => {
      vi.mocked(mockCommitments.del).mockRejectedValue(new Error('Database delete failed'))

      // nitroCompleteAuth should succeed, but del should fail
      await expect(handler.completeAuth(mockCommitment, 'auth-code')).rejects.toThrow('Database delete failed')
    })

    it('Should work with empty metadata', async () => {
      mockCommitment.metadata = {}

      const result = await handler.completeAuth(mockCommitment, 'auth-code')

      expect(result[1]).toEqual({
        email: 'user@example.com',
      })
    })

    it('Should preserve all existing metadata fields', async () => {
      mockCommitment.metadata = {
        sessionId: 'session-123',
        returnUrl: '/dashboard',
        userAgent: 'Chrome/123',
      }

      const result = await handler.completeAuth(mockCommitment, 'auth-code')

      expect(result[1]).toEqual({
        sessionId: 'session-123',
        returnUrl: '/dashboard',
        userAgent: 'Chrome/123',
        email: 'user@example.com',
      })
    })
  })

  describe('Integration and Edge Cases', () => {
    it('Should have correct kind property', () => {
      expect(handler.kind).toBe('login-google-pkce')
    })

    it('Should handle redirect URI configuration', () => {
      const newRedirectUri = 'https://newdomain.com/callback'
      handler.setRedirectUri(newRedirectUri)

      // Verify redirect URI is used in OAuth URL construction
      const mockUrl = 'https://accounts.google.com/oauth/authorize'
      vi.spyOn(handler as any, 'oauthUrl').mockReturnValue(mockUrl)

      return handler.commitAuth('https://example.com/success', true).then((result) => {
        expect(result).toContain(`redirect_uri=${encodeURIComponent(newRedirectUri)}`)
      })
    })

    it('Should work with different issuer and audience configurations', () => {
      const customHandler = new AuthCodePkceHandler(
        'google-pkce',
        'https://custom-issuer.com',
        'custom-client-id',
        mockNitroInstrument,
        mockSignatures,
        mockCommitments,
        mockAuthKeys,
      )

      expect(customHandler['issuer']).toBe('https://custom-issuer.com')
      expect(customHandler['audience']).toBe('custom-client-id')
      expect(customHandler.signupKind).toBe('google-pkce')
    })
  })
})
