import { describe, expect, it } from 'vitest'
import { Address, Hex } from 'ox'
import { isSapientSigner, isSigner, Signer, SapientSigner } from '../src/signers/index.js'

describe('Signers Index Type Guards', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890' as Address.Address
  const mockImageHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex.Hex

  describe('isSapientSigner', () => {
    it('Should return true for objects with signSapient method', () => {
      const sapientSigner = {
        address: mockAddress,
        imageHash: mockImageHash,
        signSapient: () => ({ signature: Promise.resolve({} as any) }),
      } as SapientSigner

      expect(isSapientSigner(sapientSigner)).toBe(true)
    })

    it('Should return false for objects without signSapient method', () => {
      const regularSigner = {
        address: mockAddress,
        sign: () => ({ signature: Promise.resolve({} as any) }),
      } as Signer

      expect(isSapientSigner(regularSigner)).toBe(false)
    })

    it('Should return false for objects with sign but not signSapient', () => {
      const mixedObject = {
        address: mockAddress,
        sign: () => ({ signature: Promise.resolve({} as any) }),
        // Missing signSapient method
      }

      expect(isSapientSigner(mixedObject as any)).toBe(false)
    })
  })

  describe('isSigner', () => {
    it('Should return true for objects with sign method', () => {
      const regularSigner = {
        address: mockAddress,
        sign: () => ({ signature: Promise.resolve({} as any) }),
      } as Signer

      expect(isSigner(regularSigner)).toBe(true)
    })

    it('Should return false for objects without sign method', () => {
      const sapientSigner = {
        address: mockAddress,
        imageHash: mockImageHash,
        signSapient: () => ({ signature: Promise.resolve({} as any) }),
      } as SapientSigner

      expect(isSigner(sapientSigner)).toBe(false)
    })

    it('Should return true for objects that have both sign and signSapient', () => {
      const hybridSigner = {
        address: mockAddress,
        imageHash: mockImageHash,
        sign: () => ({ signature: Promise.resolve({} as any) }),
        signSapient: () => ({ signature: Promise.resolve({} as any) }),
      }

      expect(isSigner(hybridSigner as any)).toBe(true)
    })
  })

  describe('Type guard integration', () => {
    it('Should correctly identify different signer types in arrays', () => {
      const regularSigner = {
        address: mockAddress,
        sign: () => ({ signature: Promise.resolve({} as any) }),
      } as Signer

      const sapientSigner = {
        address: mockAddress,
        imageHash: mockImageHash,
        signSapient: () => ({ signature: Promise.resolve({} as any) }),
      } as SapientSigner

      const mixedSigners = [regularSigner, sapientSigner]

      const sapientSigners = mixedSigners.filter(isSapientSigner)
      const regularSigners = mixedSigners.filter(isSigner)

      expect(sapientSigners).toHaveLength(1)
      expect(sapientSigners[0]).toBe(sapientSigner)
      expect(regularSigners).toHaveLength(1)
      expect(regularSigners[0]).toBe(regularSigner)
    })
  })
})
