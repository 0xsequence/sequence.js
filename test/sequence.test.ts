import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Guard } from '../src/sequence'
import { PayloadType } from '../src/client/guard.gen'
import { Address, Bytes, Hex } from 'ox'

// Mock fetch globally for guard API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Sequence', () => {
  describe('GuardSigner', () => {
    let guard: Guard
    let testWallet: Address.Address
    let testMessage: Bytes.Bytes
    let testMessageDigest: Bytes.Bytes

    beforeEach(() => {
      vi.clearAllMocks()
      guard = new Guard('https://guard.sequence.app', '0xaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeae', fetch)
      testWallet = '0x1234567890123456789012345678901234567890' as Address.Address
      testMessage = Bytes.fromString('Test message')
      testMessageDigest = Bytes.fromHex('0x1234567890abcdef1234567890abcdef1234567890')
    })

    afterEach(() => {
      vi.resetAllMocks()
    })

    describe('sign()', () => {
      it('Should successfully sign a payload with guard service', async () => {
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

        const result = await guard.signPayload(
          testWallet,
          42161,
          PayloadType.ConfigUpdate,
          testMessageDigest,
          testMessage,
        )

        expect(result).toBeDefined()
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
        expect(requestBody.signer).toBe('0xaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeae')
        expect(requestBody.request.chainId).toBe(42161)
        expect(requestBody.request.msg).toBe(Hex.fromBytes(testMessageDigest).toString())
        expect(requestBody.request.payloadType).toBe(PayloadType.ConfigUpdate)
        expect(requestBody.request.payloadData).toBe(Hex.fromBytes(testMessage).toString())
        expect(requestBody.request.wallet).toBe(testWallet)
      })

      it('Should handle custom chainId in sign request', async () => {
        const customChainId = 1 // Ethereum mainnet

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

        await guard.signPayload(testWallet, 1, PayloadType.ConfigUpdate, testMessageDigest, testMessage)

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.request.chainId).toBe(1)
      })

      it('Should throw error when guard service fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        await expect(
          guard.signPayload(testWallet, 42161, PayloadType.ConfigUpdate, testMessageDigest, testMessage),
        ).rejects.toThrow('Error signing with guard')
      })

      it('Should throw error when guard service returns invalid response', async () => {
        mockFetch.mockResolvedValueOnce({
          json: async () => {
            throw new Error('Invalid JSON')
          },
          text: async () => {
            throw new Error('Invalid JSON')
          },
          ok: true,
        })

        await expect(
          guard.signPayload(testWallet, 42161, PayloadType.ConfigUpdate, testMessageDigest, testMessage),
        ).rejects.toThrow('Error signing with guard')
      })

      it('Should include proper headers and signer address in request', async () => {
        const mockGuardAddress = '0x9876543210987654321098765432109876543210' as Address.Address
        const customGuard = new Guard('https://guard.sequence.app', mockGuardAddress, fetch)

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

        await customGuard.signPayload(testWallet, 42161, PayloadType.ConfigUpdate, testMessageDigest, testMessage)

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.signer).toBe(mockGuardAddress)
      })

      describe('Error Handling', () => {
        it('Should handle malformed guard service response', async () => {
          mockFetch.mockResolvedValueOnce({
            json: async () => ({
              // Missing 'sig' field
              error: 'Invalid request',
            }),
            text: async () =>
              JSON.stringify({
                error: 'Invalid request',
              }),
            ok: true,
          })

          await expect(
            guard.signPayload(testWallet, 42161, PayloadType.ConfigUpdate, testMessageDigest, testMessage),
          ).rejects.toThrow('Error signing with guard')
        })

        it('Should handle network timeout errors', async () => {
          mockFetch.mockImplementationOnce(
            () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
          )

          await expect(
            guard.signPayload(testWallet, 42161, PayloadType.ConfigUpdate, testMessageDigest, testMessage),
          ).rejects.toThrow('Error signing with guard')
        })

        it('Should handle HTTP error responses', async () => {
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
              error: 'Internal server error',
            }),
            text: async () =>
              JSON.stringify({
                error: 'Internal server error',
              }),
          })

          await expect(
            guard.signPayload(testWallet, 42161, PayloadType.ConfigUpdate, testMessageDigest, testMessage),
          ).rejects.toThrow('Error signing with guard')
        })
      })
    })
  })
})
