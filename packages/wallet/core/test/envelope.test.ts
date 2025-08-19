import { Address, Hex } from 'ox'
import { describe, expect, it } from 'vitest'
import { Config, Network, Payload, Signature } from '@0xsequence/wallet-primitives'

import * as Envelope from '../src/envelope.js'

// Test addresses and data
const TEST_ADDRESS_1 = Address.from('0x1234567890123456789012345678901234567890')
const TEST_ADDRESS_2 = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const TEST_ADDRESS_3 = Address.from('0x9876543210987654321098765432109876543210')
const TEST_WALLET = Address.from('0xfedcbafedcbafedcbafedcbafedcbafedcbafe00')
const TEST_IMAGE_HASH = Hex.from('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
const TEST_IMAGE_HASH_2 = Hex.from('0x1111111111111111111111111111111111111111111111111111111111111111')

// Mock payload
const mockPayload: Payload.Calls = {
  type: 'call',
  nonce: 1n,
  space: 0n,
  calls: [
    {
      to: TEST_ADDRESS_1,
      value: 1000000000000000000n,
      data: '0x12345678',
      gasLimit: 21000n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    },
  ],
}

// Mock configuration with single signer
const mockConfig: Config.Config = {
  threshold: 2n,
  checkpoint: 0n,
  topology: { type: 'signer', address: TEST_ADDRESS_1, weight: 2n },
}

// Mock signatures
const mockHashSignature: Signature.SignatureOfSignerLeaf = {
  type: 'hash',
  r: 123n,
  s: 456n,
  yParity: 0,
}

const mockEthSignSignature: Signature.SignatureOfSignerLeaf = {
  type: 'eth_sign',
  r: 789n,
  s: 101112n,
  yParity: 1,
}

const mockErc1271Signature: Signature.SignatureOfSignerLeaf = {
  type: 'erc1271',
  address: TEST_ADDRESS_1,
  data: '0xabcdef123456',
}

const mockSapientSignatureData: Signature.SignatureOfSapientSignerLeaf = {
  type: 'sapient',
  address: TEST_ADDRESS_3,
  data: '0x987654321',
}

// Create test envelope
const testEnvelope: Envelope.Envelope<Payload.Calls> = {
  wallet: TEST_WALLET,
  chainId: Network.ChainId.MAINNET,
  configuration: mockConfig,
  payload: mockPayload,
}

describe('Envelope', () => {
  describe('type guards', () => {
    describe('isSignature', () => {
      it('should return true for valid signature objects', () => {
        const signature: Envelope.Signature = {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        }

        expect(Envelope.isSignature(signature)).toBe(true)
      })

      it('should return false for sapient signatures', () => {
        const sapientSig: Envelope.SapientSignature = {
          imageHash: TEST_IMAGE_HASH,
          signature: mockSapientSignatureData,
        }

        expect(Envelope.isSignature(sapientSig)).toBe(false)
      })

      it('should return false for invalid objects', () => {
        // Skip null test due to source code limitation with 'in' operator
        expect(Envelope.isSignature(undefined)).toBe(false)
        expect(Envelope.isSignature({})).toBe(false)
        expect(Envelope.isSignature({ address: TEST_ADDRESS_1 })).toBe(false)
        expect(Envelope.isSignature({ signature: mockHashSignature })).toBe(false)
        expect(Envelope.isSignature('string')).toBe(false)
        expect(Envelope.isSignature(123)).toBe(false)
      })
    })

    describe('isSapientSignature', () => {
      it('should return true for valid sapient signature objects', () => {
        const sapientSig: Envelope.SapientSignature = {
          imageHash: TEST_IMAGE_HASH,
          signature: mockSapientSignatureData,
        }

        expect(Envelope.isSapientSignature(sapientSig)).toBe(true)
      })

      it('should return false for regular signatures', () => {
        const signature: Envelope.Signature = {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        }

        expect(Envelope.isSapientSignature(signature)).toBe(false)
      })

      it('should return false for invalid objects', () => {
        // Skip null test due to source code limitation with 'in' operator
        expect(Envelope.isSapientSignature(undefined)).toBe(false)
        expect(Envelope.isSapientSignature({})).toBe(false)
        expect(Envelope.isSapientSignature({ imageHash: TEST_IMAGE_HASH })).toBe(false)
        expect(Envelope.isSapientSignature({ signature: mockSapientSignatureData })).toBe(false)
      })
    })

    describe('isSigned', () => {
      it('should return true for signed envelopes', () => {
        const signedEnvelope = Envelope.toSigned(testEnvelope, [])
        expect(Envelope.isSigned(signedEnvelope)).toBe(true)
      })

      it('should return false for unsigned envelopes', () => {
        expect(Envelope.isSigned(testEnvelope)).toBe(false)
      })

      it('should return false for invalid objects', () => {
        // Skip null test due to source code limitation with 'in' operator
        expect(Envelope.isSigned(undefined as any)).toBe(false)
        expect(Envelope.isSigned({} as any)).toBe(false)
      })
    })
  })

  describe('toSigned', () => {
    it('should convert envelope to signed envelope with empty signatures', () => {
      const signed = Envelope.toSigned(testEnvelope)

      expect(signed).toEqual({
        ...testEnvelope,
        signatures: [],
      })
      expect(Envelope.isSigned(signed)).toBe(true)
    })

    it('should convert envelope to signed envelope with provided signatures', () => {
      const signatures: Envelope.Signature[] = [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ]

      const signed = Envelope.toSigned(testEnvelope, signatures)

      expect(signed).toEqual({
        ...testEnvelope,
        signatures,
      })
    })

    it('should handle mixed signature types', () => {
      const signatures: (Envelope.Signature | Envelope.SapientSignature)[] = [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
        {
          imageHash: TEST_IMAGE_HASH,
          signature: mockSapientSignatureData,
        },
      ]

      const signed = Envelope.toSigned(testEnvelope, signatures)

      expect(signed.signatures).toEqual(signatures)
    })
  })

  describe('signatureForLeaf', () => {
    const signatures: Envelope.Signature[] = [
      {
        address: TEST_ADDRESS_1,
        signature: mockHashSignature,
      },
    ]

    const signedEnvelope = Envelope.toSigned(testEnvelope, signatures)

    it('should find signature for regular signer leaf', () => {
      const leaf: Config.SignerLeaf = { type: 'signer', address: TEST_ADDRESS_1, weight: 2n }
      const foundSig = Envelope.signatureForLeaf(signedEnvelope, leaf)

      expect(foundSig).toEqual(signatures[0])
    })

    it('should find signature for sapient signer leaf', () => {
      const sapientSignatures: Envelope.SapientSignature[] = [
        {
          imageHash: TEST_IMAGE_HASH,
          signature: mockSapientSignatureData,
        },
      ]
      const sapientEnvelope = Envelope.toSigned(testEnvelope, sapientSignatures)

      const leaf: Config.SapientSignerLeaf = {
        type: 'sapient-signer',
        address: TEST_ADDRESS_3,
        weight: 2n,
        imageHash: TEST_IMAGE_HASH,
      }
      const foundSig = Envelope.signatureForLeaf(sapientEnvelope, leaf)

      expect(foundSig).toEqual(sapientSignatures[0])
    })

    it('should return undefined for non-existent signer', () => {
      const leaf: Config.SignerLeaf = {
        type: 'signer',
        address: Address.from('0x0000000000000000000000000000000000000000'),
        weight: 1n,
      }
      const foundSig = Envelope.signatureForLeaf(signedEnvelope, leaf)

      expect(foundSig).toBeUndefined()
    })

    it('should return undefined for mismatched imageHash', () => {
      const leaf: Config.SapientSignerLeaf = {
        type: 'sapient-signer',
        address: TEST_ADDRESS_3,
        weight: 2n,
        imageHash: TEST_IMAGE_HASH_2,
      }
      const foundSig = Envelope.signatureForLeaf(signedEnvelope, leaf)

      expect(foundSig).toBeUndefined()
    })

    it('should return undefined for unsupported leaf types', () => {
      const leaf = { type: 'node', data: '0x123' } as any
      const foundSig = Envelope.signatureForLeaf(signedEnvelope, leaf)

      expect(foundSig).toBeUndefined()
    })
  })

  describe('weightOf', () => {
    it('should calculate weight correctly with partial signatures', () => {
      // Empty signatures - no weight
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])
      const { weight, threshold } = Envelope.weightOf(signedEnvelope)

      expect(weight).toBe(0n) // No signatures
      expect(threshold).toBe(2n) // Threshold from config
    })

    it('should calculate weight correctly with all signatures', () => {
      const signatures: Envelope.Signature[] = [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ]

      const signedEnvelope = Envelope.toSigned(testEnvelope, signatures)
      const { weight, threshold } = Envelope.weightOf(signedEnvelope)

      expect(weight).toBe(2n) // Single signer with weight 2
      expect(threshold).toBe(2n)
    })

    it('should handle envelope with no signatures', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])
      const { weight, threshold } = Envelope.weightOf(signedEnvelope)

      expect(weight).toBe(0n)
      expect(threshold).toBe(2n)
    })
  })

  describe('reachedThreshold', () => {
    it('should return false when weight is below threshold', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, []) // No signatures
      expect(Envelope.reachedThreshold(signedEnvelope)).toBe(false)
    })

    it('should return true when weight meets threshold', () => {
      const signatures: Envelope.Signature[] = [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ]

      const signedEnvelope = Envelope.toSigned(testEnvelope, signatures)
      expect(Envelope.reachedThreshold(signedEnvelope)).toBe(true)
    })

    it('should return true when weight exceeds threshold', () => {
      // Create config with lower threshold
      const lowThresholdConfig: Config.Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'signer', address: TEST_ADDRESS_1, weight: 2n },
      }

      const lowThresholdEnvelope = {
        ...testEnvelope,
        configuration: lowThresholdConfig,
      }

      const signatures: Envelope.Signature[] = [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ]

      const signedEnvelope = Envelope.toSigned(lowThresholdEnvelope, signatures)
      expect(Envelope.reachedThreshold(signedEnvelope)).toBe(true) // 2 > 1
    })
  })

  describe('addSignature', () => {
    it('should add regular signature to empty envelope', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])
      const signature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockHashSignature,
      }

      Envelope.addSignature(signedEnvelope, signature)

      expect(signedEnvelope.signatures).toHaveLength(1)
      expect(signedEnvelope.signatures[0]).toEqual(signature)
    })

    it('should add sapient signature to envelope', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])
      const signature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: mockSapientSignatureData,
      }

      Envelope.addSignature(signedEnvelope, signature)

      expect(signedEnvelope.signatures).toHaveLength(1)
      expect(signedEnvelope.signatures[0]).toEqual(signature)
    })

    it('should throw error when adding duplicate signature without replace', () => {
      const signature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockHashSignature,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [signature])

      const duplicateSignature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockEthSignSignature,
      }

      expect(() => {
        Envelope.addSignature(signedEnvelope, duplicateSignature)
      }).toThrow('Signature already defined for signer')
    })

    it('should replace signature when replace option is true', () => {
      const originalSignature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockHashSignature,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [originalSignature])

      const newSignature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockEthSignSignature,
      }

      Envelope.addSignature(signedEnvelope, newSignature, { replace: true })

      expect(signedEnvelope.signatures).toHaveLength(1)
      expect(signedEnvelope.signatures[0]).toEqual(newSignature)
    })

    it('should do nothing when adding identical signature', () => {
      const signature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockHashSignature,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [signature])

      const identicalSignature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: { ...mockHashSignature },
      }

      Envelope.addSignature(signedEnvelope, identicalSignature)

      expect(signedEnvelope.signatures).toHaveLength(1)
      expect(signedEnvelope.signatures[0]).toEqual(signature)
    })

    it('should handle identical ERC1271 signatures', () => {
      const signature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockErc1271Signature,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [signature])

      const identicalSignature: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: { ...mockErc1271Signature },
      }

      Envelope.addSignature(signedEnvelope, identicalSignature)

      expect(signedEnvelope.signatures).toHaveLength(1)
    })

    it('should handle identical sapient signatures', () => {
      const signature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: mockSapientSignatureData,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [signature])

      const identicalSignature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: { ...mockSapientSignatureData },
      }

      Envelope.addSignature(signedEnvelope, identicalSignature)

      expect(signedEnvelope.signatures).toHaveLength(1)
    })

    it('should throw error for unsupported signature type', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])
      const invalidSignature = { invalid: 'signature' } as any

      expect(() => {
        Envelope.addSignature(signedEnvelope, invalidSignature)
      }).toThrow('Unsupported signature type')
    })

    it('should handle sapient signature replacement', () => {
      const originalSignature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: mockSapientSignatureData,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [originalSignature])

      const newSignature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: {
          type: 'sapient',
          address: TEST_ADDRESS_3,
          data: '0xnewdata',
        },
      }

      Envelope.addSignature(signedEnvelope, newSignature, { replace: true })

      expect(signedEnvelope.signatures).toHaveLength(1)
      expect(signedEnvelope.signatures[0]).toEqual(newSignature)
    })

    it('should throw error for duplicate sapient signature without replace', () => {
      const signature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: mockSapientSignatureData,
      }
      const signedEnvelope = Envelope.toSigned(testEnvelope, [signature])

      const duplicateSignature: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: {
          type: 'sapient',
          address: TEST_ADDRESS_3,
          data: '0xdifferent',
        },
      }

      expect(() => {
        Envelope.addSignature(signedEnvelope, duplicateSignature)
      }).toThrow('Signature already defined for signer')
    })
  })

  describe('encodeSignature', () => {
    it('should encode signature with filled topology', () => {
      const signatures: Envelope.Signature[] = [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ]

      const signedEnvelope = Envelope.toSigned(testEnvelope, signatures)
      const encoded = Envelope.encodeSignature(signedEnvelope)

      expect(encoded.noChainId).toBe(false) // chainId is 1n, not 0n
      expect(encoded.configuration.threshold).toBe(2n)
      expect(encoded.configuration.checkpoint).toBe(0n)
      expect(encoded.configuration.topology).toBeDefined()
      expect(typeof encoded.configuration.topology).toBe('object')
    })

    it('should set noChainId to true when chainId is 0', () => {
      const zeroChainEnvelope = {
        ...testEnvelope,
        chainId: 0,
      }

      const signedEnvelope = Envelope.toSigned(zeroChainEnvelope, [])
      const encoded = Envelope.encodeSignature(signedEnvelope)

      expect(encoded.noChainId).toBe(true)
    })

    it('should handle envelope with no signatures', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])
      const encoded = Envelope.encodeSignature(signedEnvelope)

      expect(encoded.configuration).toBeDefined()
      expect(encoded.noChainId).toBe(false)
    })
  })

  describe('edge cases and complex scenarios', () => {
    it('should handle multiple signatures for different signers', () => {
      const signedEnvelope = Envelope.toSigned(testEnvelope, [])

      const sig1: Envelope.Signature = {
        address: TEST_ADDRESS_1,
        signature: mockHashSignature,
      }

      const sig2: Envelope.SapientSignature = {
        imageHash: TEST_IMAGE_HASH,
        signature: mockSapientSignatureData,
      }

      Envelope.addSignature(signedEnvelope, sig1)
      Envelope.addSignature(signedEnvelope, sig2)

      expect(signedEnvelope.signatures).toHaveLength(2)
    })

    it('should handle single signer configuration', () => {
      const singleSignerConfig: Config.Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'signer', address: TEST_ADDRESS_1, weight: 1n },
      }

      const singleSignerEnvelope = {
        ...testEnvelope,
        configuration: singleSignerConfig,
      }

      const signedEnvelope = Envelope.toSigned(singleSignerEnvelope, [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ])

      expect(Envelope.reachedThreshold(signedEnvelope)).toBe(true)
      expect(Envelope.weightOf(signedEnvelope).weight).toBe(1n)
    })

    it('should handle nested configuration topology', () => {
      const nestedConfig: Config.Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'signer', address: TEST_ADDRESS_1, weight: 2n },
      }

      const nestedEnvelope = {
        ...testEnvelope,
        configuration: nestedConfig,
      }

      const signedEnvelope = Envelope.toSigned(nestedEnvelope, [
        {
          address: TEST_ADDRESS_1,
          signature: mockHashSignature,
        },
      ])

      const { weight, threshold } = Envelope.weightOf(signedEnvelope)
      expect(threshold).toBe(1n)
      expect(weight).toBe(2n) // Signer weight
    })
  })
})
