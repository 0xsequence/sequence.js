import { describe, expect, it, vi } from 'vitest'
import { Address, Bytes, Hex, Provider } from 'ox'
import { SignatureErc6492 } from 'ox/erc6492'

import { deploy, wrap, decode, isValid } from '../src/erc-6492.js'
import { Context } from '../src/context.js'

describe('ERC-6492', () => {
  const mockContext: Context = {
    factory: '0x1234567890123456789012345678901234567890' as Address.Address,
    stage1: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address.Address, // Fixed: 40 hex chars
    stage2: '0x9876543210987654321098765432109876543210' as Address.Address,
    creationCode: '0x608060405234801561001057600080fd5b50',
  }

  const testAddress = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1' as Address.Address
  const testMessageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testSignature =
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789001'
  const testDeployHash = '0x9999999999999999999999999999999999999999999999999999999999999999' // 32 bytes

  type DeployData = Parameters<typeof wrap>[1]

  describe('deploy', () => {
    it('should create deploy call data with hex string', () => {
      const result = deploy(testDeployHash, mockContext)

      expect(result.to).toBe(mockContext.factory)
      expect(typeof result.data).toBe('string')
      expect(result.data.startsWith('0x')).toBe(true)

      // Should contain the encoded function call with stage1 and deployHash
      expect(result.data).toContain(mockContext.stage1.slice(2)) // Remove 0x prefix for contains check
    })

    it('should create deploy call data with bytes', () => {
      const deployHashBytes = Hex.toBytes(testDeployHash)
      const result = deploy(deployHashBytes, mockContext)

      expect(result.to).toBe(mockContext.factory)
      expect(result.data).toBeInstanceOf(Uint8Array)

      // Convert to hex to check contents
      const dataHex = Bytes.toHex(result.data)
      expect(dataHex).toContain(mockContext.stage1.slice(2))
    })

    it('should return same type as input for deploy hash', () => {
      // Test with hex string
      const hexResult = deploy(testDeployHash, mockContext)
      expect(typeof hexResult.data).toBe('string')

      // Test with bytes
      const bytesResult = deploy(Hex.toBytes(testDeployHash), mockContext)
      expect(bytesResult.data).toBeInstanceOf(Uint8Array)
    })

    it('should work with different contexts', () => {
      const differentContext: Context = {
        factory: '0x9999999999999999999999999999999999999999' as Address.Address,
        stage1: '0x1111111111111111111111111111111111111111' as Address.Address,
        stage2: '0x2222222222222222222222222222222222222222' as Address.Address,
        creationCode: '0x6080604052',
      }

      const result = deploy(testDeployHash, differentContext)
      expect(result.to).toBe(differentContext.factory)
      expect(result.data).toContain(differentContext.stage1.slice(2))
    })
  })

  describe('wrap', () => {
    const deployData: DeployData = {
      to: testAddress,
      data: '0x1234567890abcdef',
    }

    it('should wrap signature with hex string', () => {
      const result = wrap(testSignature, deployData)

      expect(typeof result).toBe('string')
      expect(result.startsWith('0x')).toBe(true)

      // Should end with the magic bytes
      expect(result.endsWith(SignatureErc6492.magicBytes.slice(2))).toBe(true)

      // Should contain the original signature data somewhere
      expect(result.length).toBeGreaterThan(testSignature.length)
    })

    it('should wrap signature with bytes', () => {
      const signatureBytes = Hex.toBytes(testSignature)
      const result = wrap(signatureBytes, deployData)

      expect(result).toBeInstanceOf(Uint8Array)

      // Convert to hex to check magic bytes
      const resultHex = Bytes.toHex(result)
      expect(resultHex.endsWith(SignatureErc6492.magicBytes.slice(2))).toBe(true)
    })

    it('should return same type as input signature', () => {
      // Test with hex string
      const hexResult = wrap(testSignature, deployData)
      expect(typeof hexResult).toBe('string')

      // Test with bytes
      const bytesResult = wrap(Hex.toBytes(testSignature), deployData)
      expect(bytesResult).toBeInstanceOf(Uint8Array)
    })

    it('should handle different deploy data formats', () => {
      // Test with hex data
      const hexDeployData: DeployData = {
        to: testAddress,
        data: '0xdeadbeef',
      }
      const hexResult = wrap(testSignature, hexDeployData)
      expect(typeof hexResult).toBe('string')

      // Test with bytes data
      const bytesDeployData: DeployData = {
        to: testAddress,
        data: Hex.toBytes('0xdeadbeef'),
      }
      const bytesResult = wrap(testSignature, bytesDeployData)
      expect(typeof bytesResult).toBe('string')
    })

    it('should encode all parameters correctly', () => {
      const result = wrap(testSignature, deployData)

      // The wrapped signature should contain encoded: address, bytes (data), bytes (signature)
      expect(result.length).toBeGreaterThan(testSignature.length + deployData.data.length)
      expect(result).toContain(testAddress.slice(2)) // Address without 0x
      expect(result.endsWith(SignatureErc6492.magicBytes.slice(2))).toBe(true)
    })
  })

  describe('decode', () => {
    it('should decode wrapped hex signature correctly', () => {
      const deployData: DeployData = {
        to: testAddress,
        data: '0x1234567890abcdef',
      }

      const wrapped = wrap(testSignature, deployData)
      const result = decode(wrapped)

      expect(result.signature).toBe(testSignature)
      expect(result.erc6492).toBeDefined()
      expect(result.erc6492!.to).toBe(testAddress)
      expect(result.erc6492!.data).toBe(deployData.data)
    })

    it('should decode wrapped bytes signature correctly', () => {
      const deployData = {
        to: testAddress,
        data: Hex.toBytes('0x1234567890abcdef'),
      }

      const signatureBytes = Hex.toBytes(testSignature)
      const wrapped = wrap(signatureBytes, deployData)
      const result = decode(wrapped)

      expect(Bytes.isEqual(result.signature, signatureBytes)).toBe(true)
      expect(result.erc6492).toBeDefined()
      expect(result.erc6492!.to).toBe(testAddress)
      expect(Bytes.isEqual(result.erc6492!.data, deployData.data)).toBe(true)
    })

    it('should return original signature for non-wrapped hex signature', () => {
      const result = decode(testSignature)

      expect(result.signature).toBe(testSignature)
      expect(result.erc6492).toBeUndefined()
    })

    it('should return original signature for non-wrapped bytes signature', () => {
      const signatureBytes = Hex.toBytes(testSignature)
      const result = decode(signatureBytes)

      expect(Bytes.isEqual(result.signature, signatureBytes)).toBe(true)
      expect(result.erc6492).toBeUndefined()
    })

    it('should handle round-trip wrap/decode correctly', () => {
      const deployData: DeployData = {
        to: testAddress,
        data: '0xdeadbeefcafe',
      }

      // Test hex string round-trip
      const wrappedHex = wrap(testSignature, deployData)
      const decodedHex = decode(wrappedHex)

      expect(decodedHex.signature).toBe(testSignature)
      expect(decodedHex.erc6492!.to).toBe(testAddress)
      expect(decodedHex.erc6492!.data).toBe(deployData.data)

      // Test bytes round-trip
      const signatureBytes = Hex.toBytes(testSignature)
      const wrappedBytes = wrap(signatureBytes, deployData)
      const decodedBytes = decode(wrappedBytes)

      expect(Bytes.isEqual(decodedBytes.signature, signatureBytes)).toBe(true)
      expect(decodedBytes.erc6492!.to).toBe(testAddress)
    })

    it('should handle malformed wrapped signature gracefully', () => {
      // Create a signature that ends with magic bytes but has invalid encoding
      const malformedSig = ('0x1234' + SignatureErc6492.magicBytes.slice(2)) as Hex.Hex
      const result = decode(malformedSig)

      // Should return original signature when decoding fails
      expect(result.signature).toBe(malformedSig)
      expect(result.erc6492).toBeUndefined()
    })

    it('should preserve data types in decode results', () => {
      const deployData: DeployData = {
        to: testAddress,
        data: '0x1234567890abcdef',
      }

      // Test with hex input
      const wrappedHex = wrap(testSignature, deployData)
      const resultHex = decode(wrappedHex)
      expect(typeof resultHex.signature).toBe('string')
      expect(typeof resultHex.erc6492!.data).toBe('string')

      // Test with bytes input
      const signatureBytes = Hex.toBytes(testSignature)
      const wrappedBytes = wrap(signatureBytes, deployData)
      const resultBytes = decode(wrappedBytes)
      expect(resultBytes.signature).toBeInstanceOf(Uint8Array)
      expect(resultBytes.erc6492!.data).toBeInstanceOf(Uint8Array)
    })

    it('should handle empty deploy data', () => {
      const deployData: DeployData = {
        to: testAddress,
        data: '0x',
      }

      const wrapped = wrap(testSignature, deployData)
      const result = decode(wrapped)

      expect(result.signature).toBe(testSignature)
      expect(result.erc6492!.data).toBe('0x')
    })
  })

  describe('isValid', () => {
    const mockProvider = {
      request: vi.fn(),
    } as unknown as Provider.Provider

    it('should call provider with correct parameters', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001')

      const result = await isValid(testAddress, testMessageHash, testSignature, mockProvider)

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'eth_call',
        params: [
          {
            data: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
          },
          'latest',
        ],
      })

      expect(result).toBe(true)
    })

    it('should return true when provider returns 1', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001')

      const result = await isValid(testAddress, testMessageHash, testSignature, mockProvider)
      expect(result).toBe(true)
    })

    it('should return false when provider returns 0', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000')

      const result = await isValid(testAddress, testMessageHash, testSignature, mockProvider)
      expect(result).toBe(false)
    })

    it('should return false when provider returns other values', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000002')

      const result = await isValid(testAddress, testMessageHash, testSignature, mockProvider)
      expect(result).toBe(false)
    })

    it('should handle bytes input parameters', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001')

      const messageHashBytes = Hex.toBytes(testMessageHash)
      const signatureBytes = Hex.toBytes(testSignature)

      const result = await isValid(testAddress, messageHashBytes, signatureBytes, mockProvider)

      expect(mockRequest).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should include validation contract deployment code in call data', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001')

      await isValid(testAddress, testMessageHash, testSignature, mockProvider)

      const callArgs = mockRequest.mock.calls[0]![0]
      const callData = (callArgs as any).params[0].data

      // Call data should start with the ERC-6492 validation contract deployment code
      expect(callData.startsWith('0x608060405234801561001057600080fd5b50')).toBe(true)
      expect(callData.length).toBeGreaterThan(1000) // Should be quite long due to contract code
    })

    it('should handle provider request failure', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockRejectedValue(new Error('Network error'))

      await expect(isValid(testAddress, testMessageHash, testSignature, mockProvider)).rejects.toThrow('Network error')
    })

    it('should handle different hex formats in provider response', async () => {
      const mockRequest = vi.mocked(mockProvider.request)

      // Test with short hex (should be 1)
      mockRequest.mockResolvedValue('0x1')
      let result = await isValid(testAddress, testMessageHash, testSignature, mockProvider)
      expect(result).toBe(true)

      // Test with no 0x prefix (should still parse as 0)
      mockRequest.mockResolvedValue('0')
      result = await isValid(testAddress, testMessageHash, testSignature, mockProvider)
      expect(result).toBe(false)
    })

    it('should encode parameters correctly in validation call data', async () => {
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x1')

      await isValid(testAddress, testMessageHash, testSignature, mockProvider)

      const callArgs = mockRequest.mock.calls[0]![0]
      const callData = (callArgs as any).params[0].data

      // The call data should contain the encoded address, message hash, and signature
      // Address is encoded as 32-byte value, so testAddress.slice(2) should appear
      expect(callData).toContain(testAddress.slice(2).toLowerCase())
      // Message hash should appear in the call data
      expect(callData).toContain(testMessageHash.slice(2).toLowerCase())
    })
  })

  describe('Integration tests', () => {
    it('should work with wrapped signatures in validation', async () => {
      const mockProvider = {
        request: vi.fn(),
      } as unknown as Provider.Provider
      const mockRequest = vi.mocked(mockProvider.request)
      mockRequest.mockResolvedValue('0x1')

      const deployData: DeployData = {
        to: testAddress,
        data: '0x1234567890abcdef',
      }

      const wrappedSignature = wrap(testSignature, deployData)
      const result = await isValid(testAddress, testMessageHash, wrappedSignature, mockProvider)

      expect(result).toBe(true)
      expect(mockRequest).toHaveBeenCalled()
    })

    it('should handle complete ERC-6492 workflow', () => {
      // 1. Create deploy call data
      const deployCall = deploy(testDeployHash, mockContext)
      expect(deployCall.to).toBe(mockContext.factory)

      // 2. Wrap signature with deploy data
      const wrappedSig = wrap(testSignature, deployCall)
      expect(wrappedSig.endsWith(SignatureErc6492.magicBytes.slice(2))).toBe(true)

      // 3. Decode wrapped signature
      const decoded = decode(wrappedSig)
      expect(decoded.signature).toBe(testSignature)
      expect(decoded.erc6492).toBeDefined()
      expect(decoded.erc6492!.to).toBe(mockContext.factory)
    })

    it('should preserve type consistency throughout workflow', () => {
      const deployCallBytes = deploy(Hex.toBytes(testDeployHash), mockContext)
      expect(deployCallBytes.data).toBeInstanceOf(Uint8Array)

      const signatureBytes = Hex.toBytes(testSignature)
      const wrappedBytes = wrap(signatureBytes, deployCallBytes)
      expect(wrappedBytes).toBeInstanceOf(Uint8Array)

      const decodedBytes = decode(wrappedBytes)
      expect(decodedBytes.signature).toBeInstanceOf(Uint8Array)
      expect(decodedBytes.erc6492!.data).toBeInstanceOf(Uint8Array)
    })

    it('should handle edge case with minimal data', () => {
      const minimalContext: Context = {
        factory: '0x0000000000000000000000000000000000000000' as Address.Address,
        stage1: '0x0000000000000000000000000000000000000000' as Address.Address,
        stage2: '0x0000000000000000000000000000000000000000' as Address.Address,
        creationCode: '0x',
      }

      const deployCall = deploy('0x0000000000000000000000000000000000000000000000000000000000000000', minimalContext)
      expect(deployCall.to).toBe(minimalContext.factory)

      const wrapped = wrap('0x00', deployCall)
      const decoded = decode(wrapped)

      expect(decoded.signature).toBe('0x00')
      expect(decoded.erc6492).toBeDefined()
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle very long signatures', () => {
      const longSignature = ('0x' + '00'.repeat(1000)) as Hex.Hex
      const deployData: DeployData = { to: testAddress, data: '0x1234' }

      const wrapped = wrap(longSignature, deployData)
      const decoded = decode(wrapped)

      expect(decoded.signature).toBe(longSignature)
      expect(decoded.erc6492).toBeDefined()
    })

    it('should handle empty signatures', () => {
      const emptySignature = '0x'
      const deployData: DeployData = { to: testAddress, data: '0x' }

      const wrapped = wrap(emptySignature, deployData)
      const decoded = decode(wrapped)

      expect(decoded.signature).toBe(emptySignature)
      expect(decoded.erc6492).toBeDefined()
    })

    it('should handle signatures that accidentally contain magic bytes', () => {
      // Create a signature that contains the magic bytes but isn't wrapped
      const magicInSignature = (testSignature + SignatureErc6492.magicBytes.slice(2) + '1234') as Hex.Hex
      const result = decode(magicInSignature)

      // Should try to decode, but if it fails, should return original
      expect(result.signature).toBeDefined()
    })

    it('should handle different address formats', () => {
      const checksumAddress = '0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1' as Address.Address
      const lowercaseAddress = checksumAddress.toLowerCase()

      const deployData1: DeployData = { to: checksumAddress, data: '0x1234' }
      const deployData2: DeployData = { to: lowercaseAddress as Address.Address, data: '0x1234' }

      const wrapped1 = wrap(testSignature, deployData1)
      const wrapped2 = wrap(testSignature, deployData2)

      const decoded1 = decode(wrapped1)
      const decoded2 = decode(wrapped2)

      // Addresses may be normalized to lowercase in decode
      expect(decoded1.erc6492!.to.toLowerCase()).toBe(checksumAddress.toLowerCase())
      expect(decoded2.erc6492!.to).toBe(lowercaseAddress)
    })
  })
})
