import { Address, Bytes, Secp256k1 } from 'ox'
import { describe, expect, it } from 'vitest'

import { Permission, SessionConfig } from '../../primitives/src/index.js'
import { Signers } from '../src/index.js'

function randomAddress(): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

describe('Explicit Session', () => {
  describe('isValid', () => {
    const identityAddress = randomAddress()
    const explicitPrivateKey = Secp256k1.randomPrivateKey()
    const explicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: explicitPrivateKey }))
    const targetAddress = randomAddress()
    const currentTime = Math.floor(Date.now() / 1000)
    const futureTime = currentTime + 3600 // 1 hour from now
    const pastTime = currentTime - 3600 // 1 hour ago

    const createValidSessionPermissions = (): Signers.Session.ExplicitParams => ({
      chainId: 1,
      valueLimit: 1000000000000000000n, // 1 ETH
      deadline: BigInt(futureTime),
      permissions: [
        {
          target: targetAddress,
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
    })

    const createValidTopology = (
      sessionPermissions: Signers.Session.ExplicitParams,
    ): SessionConfig.SessionsTopology => {
      return SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
      })
    }

    it('should return true for valid session with matching topology', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when session is expired', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        ...createValidSessionPermissions(),
        deadline: BigInt(pastTime),
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Expired')
    })

    it('should return false when session deadline equals current time', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        ...createValidSessionPermissions(),
        deadline: BigInt(currentTime),
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Expired')
    })

    it('should return false when chainId does not match (session has specific chainId)', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        ...createValidSessionPermissions(),
        chainId: 1,
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 2) // Different chainId

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Chain ID mismatch')
    })

    it('should return true when session chainId is 0 (any chain)', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        ...createValidSessionPermissions(),
        chainId: 0, // Any chain
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 999) // Any chainId

      expect(result.isValid).toBe(true)
    })

    it('should return false when session signer is not found in topology', () => {
      const sessionPermissions = createValidSessionPermissions()
      const differentAddress = randomAddress()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: differentAddress, // Different signer
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission not found')
    })

    it('should return false when topology has no explicit sessions', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.emptySessionsTopology(identityAddress) // No explicit sessions
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission not found')
    })

    it('should return false when deadline does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        deadline: BigInt(futureTime + 100), // Different deadline
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission mismatch')
    })

    it('should return false when chainId does not match in topology', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        chainId: 2, // Different chainId in topology
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission mismatch')
    })

    it('should return false when valueLimit does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        valueLimit: 2000000000000000000n, // Different value limit
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission mismatch')
    })

    it('should return false when permissions length does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          ...sessionPermissions.permissions,
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
        ], // Extra permission
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission mismatch')
    })

    it('should return false when permission target does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: randomAddress(), // Different target
            rules: sessionPermissions.permissions[0]!.rules,
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when permission rules length does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: sessionPermissions.permissions[0]!.target,
            rules: [
              ...sessionPermissions.permissions[0]!.rules,
              {
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.padLeft(Bytes.fromHex('0x'), 32),
                offset: 0n,
                mask: Bytes.padLeft(Bytes.fromHex('0x'), 32),
              },
            ], // Extra rule
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when rule cumulative does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: sessionPermissions.permissions[0]!.target,
            rules: [
              {
                ...sessionPermissions.permissions[0]!.rules[0]!,
                cumulative: true, // Different cumulative value
              },
            ],
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when rule operation does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: sessionPermissions.permissions[0]!.target,
            rules: [
              {
                ...sessionPermissions.permissions[0]!.rules[0]!,
                operation: Permission.ParameterOperation.LESS_THAN_OR_EQUAL, // Different operation
              },
            ],
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when rule value does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: sessionPermissions.permissions[0]!.target,
            rules: [
              {
                ...sessionPermissions.permissions[0]!.rules[0]!,
                value: Bytes.padLeft(Bytes.fromHex('0x01'), 32), // Different value
              },
            ],
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when rule offset does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: sessionPermissions.permissions[0]!.target,
            rules: [
              {
                ...sessionPermissions.permissions[0]!.rules[0]!,
                offset: 32n, // Different offset
              },
            ],
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when rule mask does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          {
            target: sessionPermissions.permissions[0]!.target,
            rules: [
              {
                ...sessionPermissions.permissions[0]!.rules[0]!,
                mask: Bytes.padLeft(Bytes.fromHex('0xff'), 32), // Different mask
              },
            ],
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should return false when topology permission deadline is expired', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        deadline: BigInt(pastTime), // Expired in topology
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission mismatch')
    })

    it('should return false when topology permission chainId does not match', () => {
      const sessionPermissions = createValidSessionPermissions()
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        chainId: 2, // Different chainId in topology
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission mismatch')
    })

    it('should return true with complex permission rules', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        chainId: 1,
        valueLimit: 1000000000000000000n,
        deadline: BigInt(futureTime),
        permissions: [
          {
            target: targetAddress,
            rules: [
              {
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.padLeft(Bytes.fromHex('0xa9059cbb'), 32), // transfer selector
                offset: 0n,
                mask: Permission.MASK.SELECTOR,
              },
              {
                cumulative: true,
                operation: Permission.ParameterOperation.LESS_THAN_OR_EQUAL,
                value: Bytes.fromNumber(1000000000000000000n, { size: 32 }),
                offset: 4n + 32n, // Second parameter
                mask: Permission.MASK.UINT256,
              },
            ],
          },
        ],
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return true with multiple permissions', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        chainId: 1,
        valueLimit: 1000000000000000000n,
        deadline: BigInt(futureTime),
        permissions: [
          {
            target: targetAddress,
            rules: [
              {
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.padLeft(Bytes.fromHex('0xa9059cbb'), 32),
                offset: 0n,
                mask: Permission.MASK.SELECTOR,
              },
            ],
          },
          {
            target: randomAddress(),
            rules: [
              {
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.padLeft(Bytes.fromHex('0x095ea7b3'), 32), // approve selector
                offset: 0n,
                mask: Permission.MASK.SELECTOR,
              },
            ],
          },
        ],
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })

    it('should return false when one of multiple permissions does not match', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        chainId: 1,
        valueLimit: 1000000000000000000n,
        deadline: BigInt(futureTime),
        permissions: [
          {
            target: targetAddress,
            rules: [
              {
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.padLeft(Bytes.fromHex('0xa9059cbb'), 32),
                offset: 0n,
                mask: Permission.MASK.SELECTOR,
              },
            ],
          },
          {
            target: randomAddress(),
            rules: [
              {
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.padLeft(Bytes.fromHex('0x095ea7b3'), 32),
                offset: 0n,
                mask: Permission.MASK.SELECTOR,
              },
            ],
          },
        ],
      }
      const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermissions,
        signer: explicitAddress,
        permissions: [
          sessionPermissions.permissions[0]!, // First permission matches
          {
            target: randomAddress(), // Different target for second permission
            rules: sessionPermissions.permissions[1]!.rules,
          },
        ],
      })
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('Permission rule mismatch')
    })

    it('should handle edge case with zero deadline', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        ...createValidSessionPermissions(),
        deadline: 0n,
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(false) // Zero deadline should be considered expired
    })

    it('should handle edge case with very large deadline', () => {
      const sessionPermissions: Signers.Session.ExplicitParams = {
        ...createValidSessionPermissions(),
        deadline: BigInt(Number.MAX_SAFE_INTEGER),
      }
      const topology = createValidTopology(sessionPermissions)
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermissions)

      const result = explicitSigner.isValid(topology, 1)

      expect(result.isValid).toBe(true)
    })
  })
})
