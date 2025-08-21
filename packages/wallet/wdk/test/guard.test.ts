import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Manager } from '../src/sequence'
import * as Guard from '@0xsequence/guard'
import { GuardHandler } from '../src/sequence/handlers/guard'
import { Address, Bytes, Hex, TypedData } from 'ox'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { Kinds } from '../src/sequence/types/signer'
import { newManager } from './constants'

// Mock fetch globally for guard API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('GuardHandler', () => {
  let manager: Manager
  let guard: Guard.GuardSigner
  let testWallet: Address.Address
  let testPayload: Payload.Payload
  let testMessageDigest: Bytes.Bytes
  let testMessage: Hex.Hex

  beforeEach(async () => {
    vi.clearAllMocks()
    manager = newManager(undefined, undefined, `guard_test_${Date.now()}`)

    // Access guard instance through manager modules
    guard = (manager as any).shared.modules.guard

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
    it('Should create guard handler with correct kind', () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guard)

      expect(guardHandler.kind).toBe(Kinds.Guard) // Use the actual constant
    })

    it('Should return ready status for guard signer', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guard)

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
        },
      }

      const status = await guardHandler.status(testWallet, undefined, mockRequest as any)

      expect(status.status).toBe('ready')
      expect(status.address).toBe(testWallet)
      expect(status.handler).toBe(guardHandler)
      expect(typeof (status as any).handle).toBe('function')
    })

    it('Should handle signature through guard handler', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guard)

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

      // Mock the addSignature method
      const mockAddSignature = vi.fn()
      signatures.addSignature = mockAddSignature

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
        },
      }

      const status = await guardHandler.status(testWallet, undefined, mockRequest as any)
      const result = await (status as any).handle()

      expect(result).toBe(true)
      expect(mockAddSignature).toHaveBeenCalledOnce()

      const [requestId, signatureData] = mockAddSignature.mock.calls[0]
      expect(requestId).toBe('test-request-id')
      expect(signatureData.address).toBe(guard.address)
      expect(signatureData.signature).toBeDefined()
    })

    it('Should handle guard service errors in handler', async () => {
      const signatures = (manager as any).shared.modules.signatures
      const guardHandler = new GuardHandler(signatures, guard)

      mockFetch.mockRejectedValueOnce(new Error('Service error'))

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: Network.ChainId.ARBITRUM,
          payload: testPayload,
        },
      }

      const status = await guardHandler.status(testWallet, undefined, mockRequest as any)

      await expect((status as any).handle()).rejects.toThrow('Error signing with guard')
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

      const customGuard = (customManager as any).shared.modules.guard as Guard.GuardSigner

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

      await customGuard.sign(testWallet, Network.ChainId.ARBITRUM, testMessageDigest, testMessage)

      expect(mockFetch.mock.calls[0][0]).toContain(customGuardUrl)

      await customManager.stop()
    })

    it('Should use default guard configuration when not specified', () => {
      // The guard should be created with default URL and address from ManagerOptionsDefaults
      expect(guard).toBeDefined()

      // Verify the shared configuration contains the defaults
      const sharedConfig = (manager as any).shared.sequence
      expect(sharedConfig.guardUrl).toBeDefined()
      expect(sharedConfig.guardAddress).toBeDefined()
    })
  })
})
