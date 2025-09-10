import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Manager } from '../src/sequence'
import * as Guard from '@0xsequence/guard'
import { GuardHandler } from '../src/sequence/handlers/guard'
import { Address, Bytes, Hex, TypedData } from 'ox'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { Signers } from '@0xsequence/wallet-core'
import { Kinds } from '../src/sequence/types/signer'
import { newManager } from './constants'
import { GuardRole, Guards } from '../src/sequence/guards'

// Mock fetch globally for guard API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('GuardHandler', () => {
  let manager: Manager
  let guards: Guards
  let testWallet: Address.Address
  let testPayload: Payload.Payload
  let testMessageDigest: Bytes.Bytes
  let testMessage: Hex.Hex

  beforeEach(async () => {
    vi.clearAllMocks()
    manager = newManager(undefined, undefined, `guard_test_${Date.now()}`)

    // Access guard instance through manager modules
    guards = (manager as any).shared.modules.guards

    testWallet = '0x1234567890123456789012345678901234567890' as Address.Address
    testPayload = Payload.fromMessage(Hex.fromString('Test message'))
    testMessage = TypedData.encode(Payload.toTyped(testWallet, Network.ChainId.ARBITRUM, testPayload))
    testMessageDigest = Payload.hash(testWallet, Network.ChainId.ARBITRUM, testPayload)
  })

  afterEach(async () => {
    await manager.stop()
    vi.resetAllMocks()
  })

  // === GUARD HANDLER INTEGRATION ===

  describe('GuardHandler Integration', () => {
    const previousSignature = {
      type: 'hash',
      address: '0x1234567890123456789012345678901234567890' as Address.Address,
      signature: {
        type: 'hash',
        r: 1n,
        s: 2n,
        yParity: 0,
      },
    }

    it('Should create guard handler with correct kind', () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      expect(guardHandler.kind).toBe(Kinds.Guard) // Use the actual constant
    })

    it('Should return unavailable status if no UI is registered', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
          signatures: [previousSignature],
        },
      }

      const status = await guardHandler.status(
        guards.getByRole(GuardRole.Wallet).address,
        undefined,
        mockRequest as any,
      )
      expect(status.status).toBe('unavailable')
      expect((status as any).reason).toBe('guard-ui-not-registered')
    })

    it('Should return unavailable status if no signatures present', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
          signatures: [],
        },
      }

      guardHandler.registerUI(vi.fn())

      const status = await guardHandler.status(
        guards.getByRole(GuardRole.Wallet).address,
        undefined,
        mockRequest as any,
      )

      expect(status.status).toBe('unavailable')
      expect((status as any).reason).toBe('must-not-sign-first')
    })

    it('Should return ready status for guard signer', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
          signatures: [previousSignature],
        },
      }

      guardHandler.registerUI(vi.fn())

      const status = await guardHandler.status(
        guards.getByRole(GuardRole.Wallet).address,
        undefined,
        mockRequest as any,
      )

      expect(status.status).toBe('ready')
      expect(status.address).toBe(guards.getByRole(GuardRole.Wallet).address)
      expect(status.handler).toBe(guardHandler)
      expect(typeof (status as any).handle).toBe('function')
    })

    it('Should handle signature through guard handler', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: mockSignature,
        }),
        text: async () =>
          JSON.stringify({
            sig: mockSignature,
          }),
        ok: true,
      })

      guardHandler.registerUI(vi.fn())

      // Mock the addSignature method
      const mockAddSignature = vi.fn()
      signatures.addSignature = mockAddSignature

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
          signatures: [previousSignature],
        },
      }

      const status = await guardHandler.status(
        guards.getByRole(GuardRole.Wallet).address,
        undefined,
        mockRequest as any,
      )
      const result = await (status as any).handle()

      expect(result).toBe(true)
      expect(mockAddSignature).toHaveBeenCalledOnce()

      const [requestId, signatureData] = mockAddSignature.mock.calls[0]
      expect(requestId).toBe('test-request-id')
      expect(signatureData.address).toBe(guards.getByRole(GuardRole.Wallet).address)
      expect(signatureData.signature).toBeDefined()
    })

    it('Should handle guard service errors in handler', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      mockFetch.mockRejectedValueOnce(new Error('Service error'))

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
          signatures: [previousSignature],
        },
      }

      guardHandler.registerUI(vi.fn())

      const status = await guardHandler.status(
        guards.getByRole(GuardRole.Wallet).address,
        undefined,
        mockRequest as any,
      )

      await expect((status as any).handle()).rejects.toThrow('Error signing with guard')
    })

    it('Should handle 2FA', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guards)

      const mock2FAError = {
        code: 6600,
      }
      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      mockFetch
        .mockResolvedValueOnce({
          json: async () => mock2FAError,
          text: async () => JSON.stringify(mock2FAError),
          ok: false,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            sig: mockSignature,
          }),
          text: async () =>
            JSON.stringify({
              sig: mockSignature,
            }),
          ok: true,
        })

      // Mock the addSignature method
      const mockAddSignature = vi.fn()
      signatures.addSignature = mockAddSignature

      const mockCallback = vi.fn().mockImplementation(async (codeType, respond) => {
        expect(codeType).toBe('TOTP')
        await respond('123456')
      })

      guardHandler.registerUI(mockCallback)

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
          signatures: [previousSignature],
        },
      }

      const status = await guardHandler.status(
        guards.getByRole(GuardRole.Wallet).address,
        undefined,
        mockRequest as any,
      )
      const result = await (status as any).handle()

      expect(result).toBe(true)
      expect(mockCallback).toHaveBeenCalledOnce()
      expect(mockAddSignature).toHaveBeenCalledOnce()

      const [requestId, signatureData] = mockAddSignature.mock.calls[0]
      expect(requestId).toBe('test-request-id')
      expect(signatureData.address).toBe(guards.getByRole(GuardRole.Wallet).address)
      expect(signatureData.signature).toBeDefined()
    })
  })

  // === CONFIGURATION TESTING ===

  describe('Guard Configuration', () => {
    it('Should use custom guard URL from manager options', async () => {
      const customGuardUrl = 'https://test-guard.example.com'

      const customManager = newManager(
        {
          guardUrl: customGuardUrl,
        },
        undefined,
        `guard_url_${Date.now()}`,
      )

      const customGuard = (customManager as any).shared.modules.guards as Guards

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
        text: async () =>
          JSON.stringify({
            sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
          }),
        ok: true,
      })

      await customGuard.getByRole(GuardRole.Wallet).signEnvelope({
        payload: {
          type: 'config-update',
          imageHash: '0x123456789012345678901234567890123456789012345678901234567890123' as Hex.Hex,
        },
        wallet: testWallet,
        chainId: Network.ChainId.ARBITRUM,
        configuration: {
          threshold: 1n,
          checkpoint: 0n,
          topology: {
            type: 'signer',
            address: '0x1234567890123456789012345678901234567890' as Address.Address,
            weight: 1n,
          },
        },
        signatures: [],
      })

      expect(mockFetch.mock.calls[0][0]).toContain(customGuardUrl)

      await customManager.stop()
    })

    it('Should use default guard configuration when not specified', () => {
      // The guard should be created with default URL and address from ManagerOptionsDefaults
      expect(guards).toBeDefined()

      // Verify the shared configuration contains the defaults
      const sharedConfig = (manager as any).shared.sequence
      expect(sharedConfig.guardUrl).toBeDefined()
      expect(sharedConfig.guardAddresses).toBeDefined()
    })
  })
})
