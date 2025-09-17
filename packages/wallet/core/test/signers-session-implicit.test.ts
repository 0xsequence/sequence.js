import { Address, Bytes, Hex, Secp256k1, Signature } from 'ox'
import { describe, expect, it } from 'vitest'

import { Attestation, Permission, SessionConfig } from '../../primitives/src/index.js'
import { Signers } from '../src/index.js'

function randomAddress(): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

describe('Implicit Session', () => {
  const identityPrivateKey = Secp256k1.randomPrivateKey()
  const identityAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: identityPrivateKey }))
  const implicitPrivateKey = Secp256k1.randomPrivateKey()
  const implicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: implicitPrivateKey }))
  const sessionManagerAddress = randomAddress()

  const createValidAttestation = (): Attestation.Attestation => ({
    approvedSigner: implicitAddress,
    identityType: new Uint8Array(4),
    issuerHash: new Uint8Array(32),
    audienceHash: new Uint8Array(32),
    applicationData: new Uint8Array(),
    authData: {
      redirectUrl: 'https://example.com',
      issuedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  })

  const createValidIdentitySignature = (attestation: Attestation.Attestation): Signature.Signature => {
    return Secp256k1.sign({
      payload: Attestation.hash(attestation),
      privateKey: identityPrivateKey,
    })
  }

  const createValidTopology = (): SessionConfig.SessionsTopology => {
    return SessionConfig.emptySessionsTopology(identityAddress)
  }

  const createImplicitSigner = (attestation: Attestation.Attestation, identitySignature: Signature.Signature) => {
    return new Signers.Session.Implicit(implicitPrivateKey, attestation, identitySignature, sessionManagerAddress)
  }

  describe('constructor', () => {
    it('should throw an error if the attestation is issued in the future', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        authData: {
          redirectUrl: 'https://example.com',
          issuedAt: BigInt(Number.MAX_SAFE_INTEGER),
        },
      }
      const identitySignature = createValidIdentitySignature(attestation)
      expect(
        () => new Signers.Session.Implicit(implicitPrivateKey, attestation, identitySignature, sessionManagerAddress),
      ).toThrow('Attestation issued in the future')
    })

    it('should throw an error if the attestation is for a different signer', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        approvedSigner: randomAddress(),
      }
      const identitySignature = createValidIdentitySignature(attestation)
      expect(
        () => new Signers.Session.Implicit(implicitPrivateKey, attestation, identitySignature, sessionManagerAddress),
      ).toThrow('Invalid attestation')
    })
  })

  describe('isValid', () => {
    it('should return true for valid session with matching identity signer', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when topology has no identity signer', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology: SessionConfig.SessionsTopology = Hex.fromBytes(Bytes.random(32))
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Identity signer not found')
    })

    it('should return false when identity signer does not match', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const differentIdentityAddress = randomAddress()
      const topology = SessionConfig.emptySessionsTopology(differentIdentityAddress) // Different identity
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Identity signer mismatch')
    })

    it('should return true regardless of chainId', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      // Test with different chainIds
      expect(implicitSigner.isValid(topology, 1).isValid).toBe(true)
      expect(implicitSigner.isValid(topology, 137).isValid).toBe(true)
      expect(implicitSigner.isValid(topology, 42161).isValid).toBe(true)
      expect(implicitSigner.isValid(topology, 999999).isValid).toBe(true)
    })

    it('should return true with different identity types', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        identityType: new Uint8Array([0x12, 0x34, 0x56, 0x78]),
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with different issuer hashes', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        issuerHash: Bytes.random(32),
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with different audience hashes', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        audienceHash: Bytes.random(32),
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with different application data', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        applicationData: Bytes.fromString('custom application data'),
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with different redirect URLs', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        authData: {
          redirectUrl: 'https://different-example.com',
          issuedAt: BigInt(Math.floor(Date.now() / 1000)),
        },
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with different issued times', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        authData: {
          redirectUrl: 'https://example.com',
          issuedAt: BigInt(pastTime),
        },
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when identity signature is invalid', () => {
      const attestation = createValidAttestation()
      const wrongPrivateKey = Secp256k1.randomPrivateKey()
      const invalidIdentitySignature = Secp256k1.sign({
        payload: Attestation.hash(attestation),
        privateKey: wrongPrivateKey, // Wrong private key
      })
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, invalidIdentitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Identity signer mismatch')
    })

    it('should return false when attestation is issued in the future', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        authData: {
          redirectUrl: 'https://example.com',
          issuedAt: BigInt(futureTime),
        },
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()

      // This should throw an error during construction due to future issued time
      expect(() => {
        new Signers.Session.Implicit(implicitPrivateKey, attestation, identitySignature, sessionManagerAddress)
      }).toThrow('Attestation issued in the future')
    })

    it('should return false when attestation approvedSigner does not match implicit address', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        approvedSigner: randomAddress(), // Different approved signer
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()

      // This should throw an error during construction due to mismatched approved signer
      expect(() => {
        new Signers.Session.Implicit(implicitPrivateKey, attestation, identitySignature, sessionManagerAddress)
      }).toThrow('Invalid attestation')
    })

    it('should handle edge case with zero issued time', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        authData: {
          redirectUrl: 'https://example.com',
          issuedAt: 0n,
        },
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should handle edge case with empty identity type', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        identityType: new Uint8Array(0), // Empty identity type
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should handle edge case with empty application data', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        applicationData: new Uint8Array(0), // Empty application data
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should handle edge case with empty redirect URL', () => {
      const attestation: Attestation.Attestation = {
        ...createValidAttestation(),
        authData: {
          redirectUrl: '', // Empty redirect URL
          issuedAt: BigInt(Math.floor(Date.now() / 1000)),
        },
      }
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with complex topology structure', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology: SessionConfig.SessionsTopology = [
        SessionConfig.emptySessionsTopology(identityAddress),
        // Add explicit sessions
        {
          type: 'session-permissions',
          signer: randomAddress(),
          chainId: 1,
          valueLimit: 1000000000000000000n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
          permissions: [
            {
              target: randomAddress(),
              rules: [
                {
                  cumulative: false,
                  operation: Permission.ParameterOperation.EQUAL,
                  value: Bytes.padLeft(Bytes.fromHex('0x'), 32),
                  offset: 0n,
                  mask: Bytes.padLeft(Bytes.fromHex('0x'), 32),
                },
              ],
            },
          ],
        },
      ]
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should verify identity signer recovery works correctly', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      // Verify that the recovered identity signer matches the expected one
      const recoveredIdentitySigner = implicitSigner.identitySigner
      expect(recoveredIdentitySigner).toBe(identityAddress)

      const result = implicitSigner.isValid(topology, 1)
      expect(result.isValid).toBe(true)
    })

    it('should handle signature as hex string', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology()

      // Create signer with hex string signature
      const implicitSigner = new Signers.Session.Implicit(
        implicitPrivateKey,
        attestation,
        Signature.toHex(identitySignature),
        sessionManagerAddress,
      )

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when implicit signer is in blacklist', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)

      // Create topology with the implicit signer in the blacklist
      const topology = SessionConfig.addToImplicitBlacklist(
        SessionConfig.emptySessionsTopology(identityAddress),
        implicitAddress,
      )

      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Blacklisted')
    })

    it('should return true when implicit signer is not in blacklist', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)

      // Create topology with a different address in the blacklist
      const differentAddress = randomAddress()
      const topology = SessionConfig.addToImplicitBlacklist(
        SessionConfig.emptySessionsTopology(identityAddress),
        differentAddress,
      )

      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true when blacklist is empty', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)
      const topology = createValidTopology() // No blacklist entries
      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when implicit signer is in blacklist with multiple entries', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)

      // Create topology with multiple blacklist entries including the implicit signer
      let topology = SessionConfig.emptySessionsTopology(identityAddress)
      topology = SessionConfig.addToImplicitBlacklist(topology, randomAddress())
      topology = SessionConfig.addToImplicitBlacklist(topology, implicitAddress) // Add our signer
      topology = SessionConfig.addToImplicitBlacklist(topology, randomAddress())

      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
    })

    it('should return true when implicit signer is not in blacklist with multiple entries', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)

      // Create topology with multiple blacklist entries but not our signer
      let topology = SessionConfig.emptySessionsTopology(identityAddress)
      topology = SessionConfig.addToImplicitBlacklist(topology, randomAddress())
      topology = SessionConfig.addToImplicitBlacklist(topology, randomAddress())
      topology = SessionConfig.addToImplicitBlacklist(topology, randomAddress())

      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when implicit signer is in blacklist even with valid identity signer', () => {
      const attestation = createValidAttestation()
      const identitySignature = createValidIdentitySignature(attestation)

      // Create topology with valid identity signer but implicit signer in blacklist
      const topology = SessionConfig.addToImplicitBlacklist(
        SessionConfig.emptySessionsTopology(identityAddress),
        implicitAddress,
      )

      const implicitSigner = createImplicitSigner(attestation, identitySignature)

      const result = implicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
    })
  })
})
