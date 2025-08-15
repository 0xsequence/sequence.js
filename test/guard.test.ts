import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Manager } from '../src/sequence'
import { Guard } from '../src/sequence/guard'
import { GuardHandler } from '../src/sequence/handlers/guard'
import { Address, Hex, Signature } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
import { Kinds } from '../src/sequence/types/signer'
import { newManager } from './constants'

// Mock fetch globally for guard API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Guard', () => {
  let manager: Manager
  let guard: Guard
  let testWallet: Address.Address
  let testPayload: Payload.Payload

  beforeEach(async () => {
    vi.clearAllMocks()
    manager = newManager(undefined, undefined, `guard_test_${Date.now()}`)

    // Access guard instance through manager modules
    guard = (manager as any).shared.modules.guard

    testWallet = '0x1234567890123456789012345678901234567890' as Address.Address
    testPayload = Payload.fromMessage(Hex.fromString('Test message'))
  })

  afterEach(async () => {
    await manager.stop()
    vi.resetAllMocks()
  })

  // === CORE GUARD FUNCTIONALITY ===

  describe('sign()', () => {
    it('Should successfully sign a payload with guard service', async () => {
      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: mockSignature,
        }),
      })

      const result = await guard.sign(testWallet, 42161n, testPayload)

      expect(result).toBeDefined()
      expect(result.type).toBe('hash')
      expect(result.r).toBeDefined()
      expect(result.s).toBeDefined()
      expect(result.yParity).toBeDefined()

      // Verify API call was made correctly
      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0]

      expect(url).toContain('/rpc/Guard/SignWith')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')

      const requestBody = JSON.parse(options.body)
      expect(requestBody.request.chainId).toBe(42161)
      expect(requestBody.request.msg).toBeDefined()
      expect(requestBody.request.auxData).toBeDefined()
    })

    it('Should handle custom chainId in sign request', async () => {
      const customChainId = 1n // Ethereum mainnet

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
      })

      await guard.sign(testWallet, customChainId, testPayload)

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.request.chainId).toBe(1)
    })

    it('Should throw error when guard service fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(guard.sign(testWallet, 42161n, testPayload)).rejects.toThrow('Error signing with guard')
    })

    it('Should throw error when guard service returns invalid response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      await expect(guard.sign(testWallet, 42161n, testPayload)).rejects.toThrow('Error signing with guard')
    })

    it('Should include proper headers and signer address in request', async () => {
      const mockGuardAddress = '0x9876543210987654321098765432109876543210' as Address.Address

      // Create manager with custom guard address
      const customManager = newManager(
        {
          guardAddress: mockGuardAddress,
        },
        undefined,
        `guard_custom_${Date.now()}`,
      )

      const customGuard = (customManager as any).shared.modules.guard

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
      })

      await customGuard.sign(testWallet, 42161n, testPayload)

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.signer).toBe(mockGuardAddress)

      await customManager.stop()
    })

    it('Should properly encode auxiliary data with wallet, chainId, and serialized data', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
      })

      await guard.sign(testWallet, 42161n, testPayload)

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.request.auxData).toBeDefined()
      expect(typeof requestBody.request.auxData).toBe('string')
      expect(requestBody.request.auxData.startsWith('0x')).toBe(true)
    })
  })

  describe('witness()', () => {
    it('Should create and save witness signature for wallet', async () => {
      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: mockSignature,
        }),
      })

      // Mock the state provider saveWitnesses method
      const mockSaveWitnesses = vi.fn()
      ;(manager as any).shared.sequence.stateProvider.saveWitnesses = mockSaveWitnesses

      await guard.witness(testWallet)

      // Verify guard sign was called with chainId 0 (witness signatures use chainId 0)
      expect(mockFetch).toHaveBeenCalledOnce()
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.request.chainId).toBe(0)

      // Verify witness was saved
      expect(mockSaveWitnesses).toHaveBeenCalledOnce()
      const [wallet, chainId, payload, witness] = mockSaveWitnesses.mock.calls[0]

      expect(wallet).toBe(testWallet)
      expect(chainId).toBe(0n)
      expect(payload).toBeDefined()
      expect(witness.type).toBe('unrecovered-signer')
      expect(witness.weight).toBe(1n)
      expect(witness.signature).toBeDefined()
    })

    it('Should create consent payload with correct structure', async () => {
      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: mockSignature,
        }),
      })

      const mockSaveWitnesses = vi.fn()
      ;(manager as any).shared.sequence.stateProvider.saveWitnesses = mockSaveWitnesses

      await guard.witness(testWallet)

      // Extract the payload that was signed
      const [, , payload] = mockSaveWitnesses.mock.calls[0]

      // Verify it's a message payload
      expect(payload.type).toBe('message')

      // Parse the message content to verify consent structure
      const messageHex = payload.message
      const messageString = Hex.toString(messageHex)
      const consentData = JSON.parse(messageString)

      expect(consentData.action).toBe('consent-to-be-part-of-wallet')
      expect(consentData.wallet).toBe(testWallet)
      expect(consentData.signer).toBeDefined()
      expect(consentData.timestamp).toBeDefined()
      expect(consentData.extra.signerKind).toBe(Kinds.Guard) // Use the actual constant
    })

    it('Should handle witness creation failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Guard service unavailable'))

      await expect(guard.witness(testWallet)).rejects.toThrow('Error signing with guard')
    })
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
          chainId: 42161n,
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
      })

      // Mock the addSignature method
      const mockAddSignature = vi.fn()
      signatures.addSignature = mockAddSignature

      const mockRequest = {
        id: 'test-request-id',
        envelope: {
          wallet: testWallet,
          chainId: 42161n,
          payload: testPayload,
        },
      }

      const status = await guardHandler.status(testWallet, undefined, mockRequest as any)
      const result = await (status as any).handle()

      expect(result).toBe(true)
      expect(mockAddSignature).toHaveBeenCalledOnce()

      const [requestId, signatureData] = mockAddSignature.mock.calls[0]
      expect(requestId).toBe('test-request-id')
      expect(signatureData.address).toBe(testWallet)
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
          chainId: 42161n,
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

      const customGuard = (customManager as any).shared.modules.guard

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
      })

      await customGuard.sign(testWallet, 42161n, testPayload)

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

  // === ERROR HANDLING ===

  describe('Error Handling', () => {
    it('Should handle malformed guard service response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          // Missing 'sig' field
          error: 'Invalid request',
        }),
      })

      await expect(guard.sign(testWallet, 42161n, testPayload)).rejects.toThrow('Error signing with guard')
    })

    it('Should handle network timeout errors', async () => {
      mockFetch.mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      )

      await expect(guard.sign(testWallet, 42161n, testPayload)).rejects.toThrow('Error signing with guard')
    })

    it('Should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      })

      await expect(guard.sign(testWallet, 42161n, testPayload)).rejects.toThrow('Error signing with guard')
    })
  })

  // === INTEGRATION WITH REAL PAYLOADS ===

  describe('Real Payload Integration', () => {
    it('Should handle transaction payloads', async () => {
      const transactionPayload = Payload.fromCall(1n, 0n, [
        {
          to: '0x1234567890123456789012345678901234567890' as Address.Address,
          value: 1000000000000000000n, // 1 ETH in wei
          data: '0x',
          gasLimit: 21000n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        },
      ])

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
      })

      const result = await guard.sign(testWallet, 42161n, transactionPayload)

      expect(result).toBeDefined()
      expect(result.type).toBe('hash')
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('Should handle message payloads with different content', async () => {
      const complexMessage = JSON.stringify({
        user: 'test@example.com',
        action: 'authenticate',
        timestamp: Date.now(),
        data: { permissions: ['read', 'write'] },
      })

      const messagePayload = Payload.fromMessage(Hex.fromString(complexMessage))

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          sig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        }),
      })

      const result = await guard.sign(testWallet, 42161n, messagePayload)

      expect(result).toBeDefined()
      expect(result.type).toBe('hash')
    })
  })
})
