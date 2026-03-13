import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { Address, Hex } from 'ox'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { IdentityInstrument, IdentityType } from '@0xsequence/identity-instrument'
import { IdTokenHandler, PromptIdTokenHandler } from '../src/sequence/handlers/idtoken.js'
import { Signatures } from '../src/sequence/signatures.js'
import * as Db from '../src/dbs/index.js'
import { IdentitySigner } from '../src/identity/signer.js'
import { BaseSignatureRequest } from '../src/sequence/types/signature-request.js'
import { Kinds } from '../src/sequence/types/signer.js'

describe('IdTokenHandler', () => {
  let idTokenHandler: IdTokenHandler
  let mockNitroInstrument: IdentityInstrument
  let mockSignatures: Signatures
  let mockAuthKeys: Db.AuthKeys
  let mockIdentitySigner: IdentitySigner
  let testWallet: Address.Address
  let testRequest: BaseSignatureRequest
  let mockPromptIdToken: Mock<PromptIdTokenHandler>

  beforeEach(() => {
    vi.clearAllMocks()

    testWallet = '0x1234567890123456789012345678901234567890' as Address.Address

    mockNitroInstrument = {
      commitVerifier: vi.fn(),
      completeAuth: vi.fn(),
    } as unknown as IdentityInstrument

    mockSignatures = {
      addSignature: vi.fn(),
    } as unknown as Signatures

    mockAuthKeys = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      delBySigner: vi.fn(),
      getBySigner: vi.fn(),
      addListener: vi.fn(),
    } as unknown as Db.AuthKeys

    mockIdentitySigner = {
      address: testWallet,
      sign: vi.fn(),
    } as unknown as IdentitySigner

    testRequest = {
      id: 'test-request-id',
      envelope: {
        wallet: testWallet,
        chainId: Network.ChainId.ARBITRUM,
        payload: Payload.fromMessage(Hex.fromString('Test message')),
      },
    } as BaseSignatureRequest

    mockPromptIdToken = vi.fn()

    idTokenHandler = new IdTokenHandler(
      'google-id-token',
      'https://accounts.google.com',
      'test-google-client-id',
      mockNitroInstrument,
      mockSignatures,
      mockAuthKeys,
    )

    vi.spyOn(idTokenHandler as any, 'nitroCommitVerifier').mockResolvedValue({
      verifier: 'unused-verifier',
      loginHint: '',
      challenge: '',
    })

    vi.spyOn(idTokenHandler as any, 'nitroCompleteAuth').mockResolvedValue({
      signer: mockIdentitySigner,
      email: 'user@example.com',
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Constructor', () => {
    it('Should create IdTokenHandler with correct properties', () => {
      const handler = new IdTokenHandler(
        'google-id-token',
        'https://accounts.google.com',
        'test-google-client-id',
        mockNitroInstrument,
        mockSignatures,
        mockAuthKeys,
      )

      expect(handler.signupKind).toBe('google-id-token')
      expect(handler.issuer).toBe('https://accounts.google.com')
      expect(handler.audience).toBe('test-google-client-id')
      expect(handler.identityType).toBe(IdentityType.OIDC)
      expect(handler.kind).toBe(Kinds.LoginGoogleIdToken)
    })

    it('Should initialize without a registered UI callback', () => {
      expect(idTokenHandler['onPromptIdToken']).toBeUndefined()
    })
  })

  describe('UI Registration', () => {
    it('Should register ID token UI callback', () => {
      const unregister = idTokenHandler.registerUI(mockPromptIdToken)

      expect(idTokenHandler['onPromptIdToken']).toBe(mockPromptIdToken)
      expect(typeof unregister).toBe('function')
    })

    it('Should unregister UI callback when returned function is called', () => {
      const unregister = idTokenHandler.registerUI(mockPromptIdToken)
      expect(idTokenHandler['onPromptIdToken']).toBe(mockPromptIdToken)

      unregister()

      expect(idTokenHandler['onPromptIdToken']).toBeUndefined()
    })

    it('Should unregister UI callback directly', () => {
      idTokenHandler.registerUI(mockPromptIdToken)
      expect(idTokenHandler['onPromptIdToken']).toBe(mockPromptIdToken)

      idTokenHandler.unregisterUI()

      expect(idTokenHandler['onPromptIdToken']).toBeUndefined()
    })

    it('Should allow multiple registrations by overwriting the previous callback', () => {
      const secondCallback = vi.fn()

      idTokenHandler.registerUI(mockPromptIdToken)
      expect(idTokenHandler['onPromptIdToken']).toBe(mockPromptIdToken)

      idTokenHandler.registerUI(secondCallback)

      expect(idTokenHandler['onPromptIdToken']).toBe(secondCallback)
    })
  })

  describe('completeAuth()', () => {
    it('Should complete auth using an OIDC ID token challenge', async () => {
      const idToken = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.'

      const [signer, metadata] = await idTokenHandler.completeAuth(idToken)

      expect(idTokenHandler['nitroCommitVerifier']).toHaveBeenCalledWith(
        expect.objectContaining({
          issuer: 'https://accounts.google.com',
          audience: 'test-google-client-id',
          idToken,
        }),
      )
      expect(idTokenHandler['nitroCompleteAuth']).toHaveBeenCalledWith(
        expect.objectContaining({
          issuer: 'https://accounts.google.com',
          audience: 'test-google-client-id',
          idToken,
        }),
      )
      expect(signer).toBe(mockIdentitySigner)
      expect(metadata).toEqual({ email: 'user@example.com' })
    })
  })

  describe('getSigner()', () => {
    it('Should throw when UI is not registered', async () => {
      await expect(idTokenHandler.getSigner()).rejects.toThrow('id-token-handler-ui-not-registered')
    })

    it('Should acquire a signer by prompting for a fresh ID token', async () => {
      const idToken = 'header.payload.signature'
      const completeAuthSpy = vi
        .spyOn(idTokenHandler, 'completeAuth')
        .mockResolvedValue([mockIdentitySigner, { email: 'user@example.com' }])

      mockPromptIdToken.mockImplementation(async (kind, respond) => {
        expect(kind).toBe('google-id-token')
        await respond(idToken)
      })

      idTokenHandler.registerUI(mockPromptIdToken)

      const result = await idTokenHandler.getSigner()

      expect(result).toEqual({
        signer: mockIdentitySigner,
        email: 'user@example.com',
      })
      expect(completeAuthSpy).toHaveBeenCalledWith(idToken)
      expect(mockPromptIdToken).toHaveBeenCalledWith('google-id-token', expect.any(Function))
    })

    it('Should surface authentication failures from completeAuth', async () => {
      const error = new Error('Authentication failed')
      vi.spyOn(idTokenHandler, 'completeAuth').mockRejectedValue(error)

      mockPromptIdToken.mockImplementation(async (_kind, respond) => {
        await respond('header.payload.signature')
      })

      idTokenHandler.registerUI(mockPromptIdToken)

      await expect(idTokenHandler.getSigner()).rejects.toThrow('Authentication failed')
    })

    it('Should surface UI callback errors', async () => {
      mockPromptIdToken.mockRejectedValue(new Error('UI callback failed'))
      idTokenHandler.registerUI(mockPromptIdToken)

      await expect(idTokenHandler.getSigner()).rejects.toThrow('UI callback failed')
    })
  })

  describe('status()', () => {
    it('Should return ready status when an auth key signer is available', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(mockIdentitySigner)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)

      expect(status.status).toBe('ready')
      expect(status.handler).toBe(idTokenHandler)
    })

    it('Should sign the request when ready handle is invoked', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(mockIdentitySigner)
      const signSpy = vi.spyOn(idTokenHandler as any, 'sign').mockResolvedValue(undefined)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)
      const handled = await (status as any).handle()

      expect(handled).toBe(true)
      expect(signSpy).toHaveBeenCalledWith(mockIdentitySigner, testRequest)
    })

    it('Should return unavailable when no auth key signer exists and UI is not registered', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(undefined)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)

      expect(status).toMatchObject({
        address: testWallet,
        handler: idTokenHandler,
        status: 'unavailable',
        reason: 'ui-not-registered',
      })
    })

    it('Should return actionable when no auth key signer exists and UI is registered', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(undefined)
      idTokenHandler.registerUI(mockPromptIdToken)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)

      expect(status.status).toBe('actionable')
      expect(status.address).toBe(testWallet)
      expect(status.handler).toBe(idTokenHandler)
      expect((status as any).message).toBe('request-id-token')
      expect(typeof (status as any).handle).toBe('function')
    })

    it('Should reacquire the signer when actionable handle is invoked', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(undefined)
      const completeAuthSpy = vi
        .spyOn(idTokenHandler, 'completeAuth')
        .mockResolvedValue([mockIdentitySigner, { email: 'user@example.com' }])

      mockPromptIdToken.mockImplementation(async (_kind, respond) => {
        await respond('header.payload.signature')
      })

      idTokenHandler.registerUI(mockPromptIdToken)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)
      const handled = await (status as any).handle()

      expect(handled).toBe(true)
      expect(completeAuthSpy).toHaveBeenCalledWith('header.payload.signature')
    })

    it('Should return false when actionable handle authentication fails', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(undefined)
      vi.spyOn(idTokenHandler, 'completeAuth').mockRejectedValue(new Error('Authentication failed'))

      mockPromptIdToken.mockImplementation(async (_kind, respond) => {
        await respond('header.payload.signature')
      })

      idTokenHandler.registerUI(mockPromptIdToken)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)
      const handled = await (status as any).handle()

      expect(handled).toBe(false)
    })

    it('Should return false when actionable handle authenticates the wrong signer', async () => {
      vi.spyOn(idTokenHandler as any, 'getAuthKeySigner').mockResolvedValue(undefined)
      const wrongSigner = '0x9999999999999999999999999999999999999999' as Address.Address
      vi.spyOn(idTokenHandler, 'completeAuth').mockResolvedValue([
        {
          ...mockIdentitySigner,
          address: wrongSigner,
        } as unknown as IdentitySigner,
        { email: 'other-user@example.com' },
      ])

      mockPromptIdToken.mockImplementation(async (_kind, respond) => {
        await respond('header.payload.signature')
      })

      idTokenHandler.registerUI(mockPromptIdToken)

      const status = await idTokenHandler.status(testWallet, undefined, testRequest)
      const handled = await (status as any).handle()

      expect(handled).toBe(false)
      expect(mockAuthKeys.delBySigner).toHaveBeenCalledWith(wrongSigner)
    })
  })
})
