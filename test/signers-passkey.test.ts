import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Hex, Bytes } from 'ox'
import { Payload, Extensions } from '@0xsequence/wallet-primitives'
import {
  Passkey,
  PasskeyOptions,
  isWitnessMessage,
  WitnessMessage,
  CreatePasskeyOptions,
} from '../src/signers/passkey.js'
import { State } from '../src/index.js'

// Add mock for WebAuthnP256 at the top
vi.mock('ox', async () => {
  const actual = await vi.importActual('ox')
  return {
    ...actual,
    WebAuthnP256: {
      createCredential: vi.fn(),
      sign: vi.fn(),
    },
  }
})

describe('Passkey Signers', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890' as Address.Address
  const mockImageHash =
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex.Hex
  const mockWallet = '0xfedcbafedcbafedcbafedcbafedcbafedcbafedcba' as Address.Address

  const mockPublicKey: Extensions.Passkeys.PublicKey = {
    x: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex.Hex,
    y: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex.Hex,
    requireUserVerification: true,
  }

  const mockExtensions: Pick<Extensions.Extensions, 'passkeys'> = {
    passkeys: mockAddress,
  }

  const mockMetadata: Extensions.Passkeys.PasskeyMetadata = {
    credentialId: 'test-credential-id',
  }

  describe('isWitnessMessage type guard', () => {
    it('Should return true for valid WitnessMessage objects', () => {
      const validMessage: WitnessMessage = {
        action: 'consent-to-be-part-of-wallet',
        wallet: mockWallet,
        publicKey: mockPublicKey,
        timestamp: Date.now(),
      }

      expect(isWitnessMessage(validMessage)).toBe(true)
    })

    it('Should return true for valid WitnessMessage with metadata', () => {
      const validMessageWithMetadata: WitnessMessage = {
        action: 'consent-to-be-part-of-wallet',
        wallet: mockWallet,
        publicKey: mockPublicKey,
        timestamp: Date.now(),
        metadata: mockMetadata,
      }

      expect(isWitnessMessage(validMessageWithMetadata)).toBe(true)
    })

    it('Should return false for objects with wrong action', () => {
      const invalidMessage = {
        action: 'wrong-action',
        wallet: mockWallet,
        publicKey: mockPublicKey,
        timestamp: Date.now(),
      }

      expect(isWitnessMessage(invalidMessage)).toBe(false)
    })

    it('Should return false for objects missing action', () => {
      const invalidMessage = {
        wallet: mockWallet,
        publicKey: mockPublicKey,
        timestamp: Date.now(),
      }

      expect(isWitnessMessage(invalidMessage)).toBe(false)
    })

    it('Should return false for null or undefined', () => {
      expect(isWitnessMessage(null)).toBe(false)
      expect(isWitnessMessage(undefined)).toBe(false)
    })

    it('Should return false for non-objects', () => {
      expect(isWitnessMessage('string')).toBe(false)
      expect(isWitnessMessage(123)).toBe(false)
      expect(isWitnessMessage(true)).toBe(false)
    })
  })

  describe('Passkey Constructor', () => {
    it('Should construct with basic options', () => {
      const options: PasskeyOptions = {
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
      }

      const passkey = new Passkey(options)

      expect(passkey.address).toBe(mockExtensions.passkeys)
      expect(passkey.publicKey).toBe(mockPublicKey)
      expect(passkey.credentialId).toBe('test-credential')
      expect(passkey.embedMetadata).toBe(false) // default value
      expect(passkey.metadata).toBeUndefined()
    })

    it('Should construct with embedMetadata option', () => {
      const options: PasskeyOptions = {
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
        embedMetadata: true,
      }

      const passkey = new Passkey(options)

      expect(passkey.embedMetadata).toBe(true)
    })

    it('Should construct with metadata option', () => {
      const options: PasskeyOptions = {
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
        metadata: mockMetadata,
      }

      const passkey = new Passkey(options)

      expect(passkey.metadata).toBe(mockMetadata)
    })

    it('Should compute imageHash from publicKey', () => {
      // Mock the Extensions.Passkeys.rootFor function
      const mockImageHash = '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba' as Hex.Hex
      vi.spyOn(Extensions.Passkeys, 'rootFor').mockReturnValue(mockImageHash)

      const options: PasskeyOptions = {
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
      }

      const passkey = new Passkey(options)

      expect(passkey.imageHash).toBe(mockImageHash)
      expect(Extensions.Passkeys.rootFor).toHaveBeenCalledWith(mockPublicKey)
    })

    it('Should handle all options together', () => {
      const options: PasskeyOptions = {
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
        embedMetadata: true,
        metadata: mockMetadata,
      }

      const passkey = new Passkey(options)

      expect(passkey.address).toBe(mockExtensions.passkeys)
      expect(passkey.publicKey).toBe(mockPublicKey)
      expect(passkey.credentialId).toBe('test-credential')
      expect(passkey.embedMetadata).toBe(true)
      expect(passkey.metadata).toBe(mockMetadata)
    })
  })

  describe('loadFromWitness static method', () => {
    let mockStateReader: State.Reader

    beforeEach(() => {
      mockStateReader = {
        getWitnessForSapient: vi.fn(),
      } as any
      vi.clearAllMocks()
    })

    it('Should throw error when witness not found', async () => {
      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(undefined)

      await expect(Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash)).rejects.toThrow(
        'Witness for wallet not found',
      )

      expect(mockStateReader.getWitnessForSapient).toHaveBeenCalledWith(
        mockWallet,
        mockExtensions.passkeys,
        mockImageHash,
      )
    })

    it('Should throw error when witness payload is not a message', async () => {
      const mockWitness = {
        payload: { type: 'call', calls: [] }, // Not a message type
        signature: { data: '0x123456' },
      }

      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(mockWitness as any)

      await expect(Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash)).rejects.toThrow(
        'Witness payload is not a message',
      )
    })

    it('Should throw error when witness message is invalid JSON', async () => {
      const mockWitness = {
        payload: {
          type: 'message',
          message: Hex.fromString('invalid json'),
        },
        signature: { data: '0x123456' },
      }

      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(mockWitness as any)

      await expect(
        Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash),
      ).rejects.toThrow()
    })

    it('Should throw error when witness message is not a witness message', async () => {
      const invalidMessage = {
        action: 'wrong-action',
        wallet: mockWallet,
      }

      const mockWitness = {
        payload: {
          type: 'message',
          message: Hex.fromString(JSON.stringify(invalidMessage)),
        },
        signature: { data: '0x123456' },
      }

      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(mockWitness as any)

      await expect(Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash)).rejects.toThrow(
        'Witness payload is not a witness message',
      )
    })

    it('Should throw error when metadata is string or undefined', async () => {
      const witnessMessage: WitnessMessage = {
        action: 'consent-to-be-part-of-wallet',
        wallet: mockWallet,
        publicKey: {
          ...mockPublicKey,
          metadata: 'string-metadata' as any,
        },
        timestamp: Date.now(),
      }

      const mockWitness = {
        payload: {
          type: 'message',
          message: Hex.fromString(JSON.stringify(witnessMessage)),
        },
        signature: { data: '0x123456' },
      }

      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(mockWitness as any)

      await expect(Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash)).rejects.toThrow(
        'Metadata does not contain credential id',
      )
    })

    it('Should successfully load passkey from valid witness with publicKey metadata', async () => {
      const validWitnessMessage: WitnessMessage = {
        action: 'consent-to-be-part-of-wallet',
        wallet: mockWallet,
        publicKey: {
          ...mockPublicKey,
          metadata: mockMetadata,
        },
        timestamp: Date.now(),
      }

      const mockEncodedSignature = new Uint8Array([1, 2, 3, 4])
      const mockDecodedSignature = {
        embedMetadata: true,
      }

      const mockWitness = {
        payload: {
          type: 'message',
          message: Hex.fromString(JSON.stringify(validWitnessMessage)),
        },
        signature: { data: Bytes.toHex(mockEncodedSignature) },
      }

      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(mockWitness as any)
      vi.spyOn(Extensions.Passkeys, 'decode').mockReturnValue(mockDecodedSignature as any)

      const result = await Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash)

      expect(result).toBeInstanceOf(Passkey)
      expect(result.credentialId).toBe(mockMetadata.credentialId)
      expect(result.publicKey).toEqual(validWitnessMessage.publicKey)
      expect(result.embedMetadata).toBe(true)
      expect(result.metadata).toEqual(mockMetadata)
    })

    it('Should successfully load passkey from valid witness with separate metadata field', async () => {
      const validWitnessMessage: WitnessMessage = {
        action: 'consent-to-be-part-of-wallet',
        wallet: mockWallet,
        publicKey: mockPublicKey,
        timestamp: Date.now(),
        metadata: mockMetadata,
      }

      const mockEncodedSignature = new Uint8Array([1, 2, 3, 4])
      const mockDecodedSignature = {
        embedMetadata: false,
      }

      const mockWitness = {
        payload: {
          type: 'message',
          message: Hex.fromString(JSON.stringify(validWitnessMessage)),
        },
        signature: { data: Bytes.toHex(mockEncodedSignature) },
      }

      vi.mocked(mockStateReader.getWitnessForSapient).mockResolvedValue(mockWitness as any)
      vi.spyOn(Extensions.Passkeys, 'decode').mockReturnValue(mockDecodedSignature as any)

      const result = await Passkey.loadFromWitness(mockStateReader, mockExtensions, mockWallet, mockImageHash)

      expect(result).toBeInstanceOf(Passkey)
      expect(result.credentialId).toBe(mockMetadata.credentialId)
      expect(result.publicKey).toEqual(mockPublicKey)
      expect(result.embedMetadata).toBe(false)
      expect(result.metadata).toEqual(mockMetadata)
    })
  })

  describe('create static method', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('Should use default credential name when none provided', async () => {
      const mockCredential = {
        id: 'test-credential-id',
        publicKey: { x: 123n, y: 456n },
      }

      const { WebAuthnP256 } = await import('ox')
      vi.mocked(WebAuthnP256.createCredential).mockResolvedValue(mockCredential as any)
      vi.spyOn(Extensions.Passkeys, 'toTree').mockReturnValue({} as any)

      const result = await Passkey.create(mockExtensions)

      expect(WebAuthnP256.createCredential).toHaveBeenCalledWith({
        user: {
          name: expect.stringMatching(/^Sequence \(\d+\)$/),
        },
      })

      expect(result).toBeInstanceOf(Passkey)
      expect(result.credentialId).toBe('test-credential-id')
    })

    it('Should use custom credential name when provided', async () => {
      const mockCredential = {
        id: 'test-credential-id',
        publicKey: { x: 123n, y: 456n },
      }

      const { WebAuthnP256 } = await import('ox')
      vi.mocked(WebAuthnP256.createCredential).mockResolvedValue(mockCredential as any)
      vi.spyOn(Extensions.Passkeys, 'toTree').mockReturnValue({} as any)

      const options: CreatePasskeyOptions = {
        credentialName: 'Custom Credential Name',
      }

      await Passkey.create(mockExtensions, options)

      expect(WebAuthnP256.createCredential).toHaveBeenCalledWith({
        user: {
          name: 'Custom Credential Name',
        },
      })
    })

    it('Should handle embedMetadata option', async () => {
      const mockCredential = {
        id: 'test-credential-id',
        publicKey: { x: 123n, y: 456n },
      }

      const { WebAuthnP256 } = await import('ox')
      vi.mocked(WebAuthnP256.createCredential).mockResolvedValue(mockCredential as any)
      vi.spyOn(Extensions.Passkeys, 'toTree').mockReturnValue({} as any)

      const options: CreatePasskeyOptions = {
        embedMetadata: true,
      }

      const result = await Passkey.create(mockExtensions, options)

      expect(result.embedMetadata).toBe(true)
      expect(result.publicKey.metadata).toBeDefined()
    })

    it('Should save tree when stateProvider is provided', async () => {
      const mockCredential = {
        id: 'test-credential-id',
        publicKey: { x: 123n, y: 456n },
      }

      const mockStateProvider = {
        saveTree: vi.fn().mockResolvedValue(undefined),
      } as any

      const mockTree = { mockTree: true }

      const { WebAuthnP256 } = await import('ox')
      vi.mocked(WebAuthnP256.createCredential).mockResolvedValue(mockCredential as any)
      vi.spyOn(Extensions.Passkeys, 'toTree').mockReturnValue(mockTree as any)

      const options: CreatePasskeyOptions = {
        stateProvider: mockStateProvider,
      }

      await Passkey.create(mockExtensions, options)

      expect(mockStateProvider.saveTree).toHaveBeenCalledWith(mockTree)
    })
  })

  describe('signSapient method', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('Should generate correct signature structure', async () => {
      const passkey = new Passkey({
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
      })

      // Mock imageHash to match
      vi.spyOn(passkey, 'imageHash', 'get').mockReturnValue(mockImageHash)

      const mockWebAuthnResponse = {
        signature: { r: 123n, s: 456n },
        metadata: {
          authenticatorData: '0xdeadbeef',
          clientDataJSON: '{"test":"data"}',
        },
      }

      const mockEncodedSignature = new Uint8Array([1, 2, 3, 4])

      const { WebAuthnP256 } = await import('ox')
      vi.mocked(WebAuthnP256.sign).mockResolvedValue(mockWebAuthnResponse as any)
      vi.spyOn(Extensions.Passkeys, 'encode').mockReturnValue(mockEncodedSignature)
      vi.spyOn(Payload, 'hash').mockReturnValue(new Uint8Array([1, 2, 3, 4]))

      const mockPayload = Payload.fromMessage(Hex.fromString('test message'))
      const result = await passkey.signSapient(mockWallet, 1, mockPayload, mockImageHash)

      expect(result).toEqual({
        address: mockExtensions.passkeys,
        data: Bytes.toHex(mockEncodedSignature),
        type: 'sapient_compact',
      })

      expect(WebAuthnP256.sign).toHaveBeenCalledWith({
        challenge: expect.any(String),
        credentialId: 'test-credential',
        userVerification: 'required',
      })
    })

    it('Should use discouraged user verification when requireUserVerification is false', async () => {
      const publicKeyNoVerification = {
        ...mockPublicKey,
        requireUserVerification: false,
      }

      const passkey = new Passkey({
        extensions: mockExtensions,
        publicKey: publicKeyNoVerification,
        credentialId: 'test-credential',
      })

      vi.spyOn(passkey, 'imageHash', 'get').mockReturnValue(mockImageHash)

      const mockWebAuthnResponse = {
        signature: { r: 123n, s: 456n },
        metadata: {
          authenticatorData: '0xdeadbeef',
          clientDataJSON: '{"test":"data"}',
        },
      }

      const { WebAuthnP256 } = await import('ox')
      vi.mocked(WebAuthnP256.sign).mockResolvedValue(mockWebAuthnResponse as any)
      vi.spyOn(Extensions.Passkeys, 'encode').mockReturnValue(new Uint8Array([1, 2, 3, 4]))
      vi.spyOn(Payload, 'hash').mockReturnValue(new Uint8Array([1, 2, 3, 4]))

      const mockPayload = Payload.fromMessage(Hex.fromString('test message'))
      await passkey.signSapient(mockWallet, 1, mockPayload, mockImageHash)

      expect(WebAuthnP256.sign).toHaveBeenCalledWith({
        challenge: expect.any(String),
        credentialId: 'test-credential',
        userVerification: 'discouraged',
      })
    })
  })

  describe('witness method', () => {
    let mockStateWriter: State.Writer
    let passkey: Passkey

    beforeEach(() => {
      mockStateWriter = {
        saveWitnesses: vi.fn().mockResolvedValue(undefined),
      } as any

      passkey = new Passkey({
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
        metadata: mockMetadata,
      })

      vi.clearAllMocks()
    })

    it('Should create witness with correct message structure', async () => {
      const mockSignature = {
        address: mockExtensions.passkeys,
        data: '0xabcdef' as const,
        type: 'sapient_compact' as const,
      }

      vi.spyOn(passkey, 'signSapient').mockResolvedValue(mockSignature)

      await passkey.witness(mockStateWriter, mockWallet)

      expect(mockStateWriter.saveWitnesses).toHaveBeenCalledTimes(1)

      const [wallet, chainId, payload, witness] = vi.mocked(mockStateWriter.saveWitnesses).mock.calls[0]

      expect(wallet).toBe(mockWallet)
      expect(chainId).toBe(0)

      // Check the payload contains the witness message
      const messagePayload = payload as { type: 'message'; message: Hex.Hex }
      const witnessMessage = JSON.parse(Hex.toString(messagePayload.message))

      expect(witnessMessage.action).toBe('consent-to-be-part-of-wallet')
      expect(witnessMessage.wallet).toBe(mockWallet)
      expect(witnessMessage.publicKey).toEqual(mockPublicKey)
      expect(witnessMessage.metadata).toEqual(mockMetadata)
      expect(typeof witnessMessage.timestamp).toBe('number')

      // Check the witness structure
      const rawLeaf = witness as { type: 'unrecovered-signer'; weight: bigint; signature: any }
      expect(rawLeaf.type).toBe('unrecovered-signer')
      expect(rawLeaf.weight).toBe(1n)
      expect(rawLeaf.signature).toBe(mockSignature)
    })

    it('Should include extra data in witness message', async () => {
      const extraData = { customField: 'test-value', version: '1.0' }

      const mockSignature = {
        address: mockExtensions.passkeys,
        data: '0xabcdef' as const,
        type: 'sapient_compact' as const,
      }

      vi.spyOn(passkey, 'signSapient').mockResolvedValue(mockSignature)

      await passkey.witness(mockStateWriter, mockWallet, extraData)

      const [, , payload] = vi.mocked(mockStateWriter.saveWitnesses).mock.calls[0]

      const messagePayload = payload as { type: 'message'; message: Hex.Hex }
      const witnessMessage = JSON.parse(Hex.toString(messagePayload.message))

      expect(witnessMessage.customField).toBe('test-value')
      expect(witnessMessage.version).toBe('1.0')
    })

    it('Should call signSapient with correct parameters', async () => {
      const mockSignature = {
        address: mockExtensions.passkeys,
        data: '0xabcdef' as const,
        type: 'sapient_compact' as const,
      }

      const signSapientSpy = vi.spyOn(passkey, 'signSapient').mockResolvedValue(mockSignature)

      await passkey.witness(mockStateWriter, mockWallet)

      expect(signSapientSpy).toHaveBeenCalledWith(
        mockWallet,
        0,
        expect.any(Object), // The payload
        passkey.imageHash,
      )
    })
  })

  describe('Error handling for imageHash mismatch', () => {
    it('Should throw error when signSapient called with wrong imageHash', async () => {
      const passkey = new Passkey({
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
      })

      const wrongImageHash = '0x9999999999999999999999999999999999999999999999999999999999999999' as Hex.Hex
      const mockPayload = Payload.fromMessage(Hex.fromString('test message'))

      await expect(passkey.signSapient(mockWallet, 1, mockPayload, wrongImageHash)).rejects.toThrow(
        'Unexpected image hash',
      )
    })
  })

  describe('Properties and getters', () => {
    it('Should expose all properties correctly', () => {
      const options: PasskeyOptions = {
        extensions: mockExtensions,
        publicKey: mockPublicKey,
        credentialId: 'test-credential',
        embedMetadata: true,
        metadata: mockMetadata,
      }

      const passkey = new Passkey(options)

      // Test all public properties
      expect(passkey.credentialId).toBe('test-credential')
      expect(passkey.publicKey).toBe(mockPublicKey)
      expect(passkey.address).toBe(mockExtensions.passkeys)
      expect(passkey.embedMetadata).toBe(true)
      expect(passkey.metadata).toBe(mockMetadata)
      expect(passkey.imageHash).toBeDefined()
    })
  })
})
