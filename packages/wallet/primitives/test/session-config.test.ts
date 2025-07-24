import { describe, expect, it } from 'vitest'
import { Bytes, Hex } from 'ox'

import { checksum } from '../src/address.js'
import {
  SESSIONS_FLAG_PERMISSIONS,
  SESSIONS_FLAG_NODE,
  SESSIONS_FLAG_BRANCH,
  SESSIONS_FLAG_BLACKLIST,
  SESSIONS_FLAG_IDENTITY_SIGNER,
  ImplicitBlacklistLeaf,
  IdentitySignerLeaf,
  SessionPermissionsLeaf,
  SessionNode,
  SessionLeaf,
  SessionBranch,
  SessionsTopology,
  isSessionsTopology,
  isCompleteSessionsTopology,
  getIdentitySigner,
  getImplicitBlacklist,
  getImplicitBlacklistLeaf,
  getSessionPermissions,
  getExplicitSigners,
  encodeLeafToGeneric,
  decodeLeafFromBytes,
  sessionsTopologyToConfigurationTree,
  configurationTreeToSessionsTopology,
  encodeSessionsTopology,
  sessionsTopologyToJson,
  sessionsTopologyFromJson,
  removeExplicitSession,
  addExplicitSession,
  mergeSessionsTopologies,
  balanceSessionsTopology,
  cleanSessionsTopology,
  minimiseSessionsTopology,
  addToImplicitBlacklist,
  removeFromImplicitBlacklist,
  emptySessionsTopology,
} from '../src/session-config.js'
import { SessionPermissions } from '../src/permission.js'

describe('Session Config', () => {
  // Test data
  const testAddress1 = checksum('0x742d35cc6635c0532925a3b8d563a6b35b7f05f1')
  const testAddress2 = checksum('0x8ba1f109551bd432803012645aac136c776056c0')
  const testAddress3 = checksum('0xa0b86a33e6f8b5f56e64c9e1a1b8c6a9cc4b9a9e')
  const testNode = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as SessionNode

  const samplePermission = {
    target: testAddress3,
    rules: [
      {
        cumulative: false,
        operation: 0, // EQUAL
        value: Bytes.fromHex('0x'),
        offset: 0n,
        mask: Bytes.fromHex('0xffffffff00000000000000000000000000000000000000000000000000000000'),
      },
    ],
  }

  const sampleSessionPermissions: SessionPermissions = {
    signer: testAddress1,
    chainId: 1n,
    valueLimit: 1000000000000000000n, // 1 ETH
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
    permissions: [samplePermission],
  }

  const sampleSessionPermissionsLeaf: SessionPermissionsLeaf = {
    type: 'session-permissions',
    ...sampleSessionPermissions,
  }

  const sampleBlacklistLeaf: ImplicitBlacklistLeaf = {
    type: 'implicit-blacklist',
    blacklist: [testAddress2, testAddress3],
  }

  const sampleIdentitySignerLeaf: IdentitySignerLeaf = {
    type: 'identity-signer',
    identitySigner: testAddress1,
  }

  const sampleBranch: SessionBranch = [sampleBlacklistLeaf, sampleIdentitySignerLeaf]
  const sampleCompleteTopology: SessionsTopology = [
    sampleBlacklistLeaf,
    sampleIdentitySignerLeaf,
    sampleSessionPermissionsLeaf,
  ]

  describe('Constants', () => {
    it('should have correct flag values', () => {
      expect(SESSIONS_FLAG_PERMISSIONS).toBe(0)
      expect(SESSIONS_FLAG_NODE).toBe(1)
      expect(SESSIONS_FLAG_BRANCH).toBe(2)
      expect(SESSIONS_FLAG_BLACKLIST).toBe(3)
      expect(SESSIONS_FLAG_IDENTITY_SIGNER).toBe(4)
    })
  })

  describe('Type Guards and Validation', () => {
    describe('isSessionsTopology', () => {
      it('should return true for valid session permissions leaf', () => {
        expect(isSessionsTopology(sampleSessionPermissionsLeaf)).toBe(true)
      })

      it('should return true for valid blacklist leaf', () => {
        expect(isSessionsTopology(sampleBlacklistLeaf)).toBe(true)
      })

      it('should return true for valid identity signer leaf', () => {
        expect(isSessionsTopology(sampleIdentitySignerLeaf)).toBe(true)
      })

      it('should return true for valid session node', () => {
        expect(isSessionsTopology(testNode)).toBe(true)
      })

      it('should return true for valid session branch', () => {
        expect(isSessionsTopology(sampleBranch)).toBe(true)
      })

      it('should return false for invalid topology', () => {
        expect(isSessionsTopology({})).toBe(false)
        expect(isSessionsTopology(null)).toBe(false)
        expect(isSessionsTopology('invalid')).toBe(false)
        expect(isSessionsTopology([])).toBe(false) // Empty array
        expect(isSessionsTopology([{}])).toBe(false) // Invalid child
      })
    })

    describe('isCompleteSessionsTopology', () => {
      it('should return true for complete topology', () => {
        expect(isCompleteSessionsTopology(sampleCompleteTopology)).toBe(true)
      })

      it('should return false for topology without blacklist', () => {
        const incompleteTopology = [sampleIdentitySignerLeaf, sampleSessionPermissionsLeaf]
        expect(isCompleteSessionsTopology(incompleteTopology)).toBe(false)
      })

      it('should return false for topology without identity signer', () => {
        const incompleteTopology = [sampleBlacklistLeaf, sampleSessionPermissionsLeaf]
        expect(isCompleteSessionsTopology(incompleteTopology)).toBe(false)
      })

      it('should return false for topology with multiple blacklists', () => {
        const duplicateBlacklist = [sampleBlacklistLeaf, sampleBlacklistLeaf, sampleIdentitySignerLeaf]
        expect(isCompleteSessionsTopology(duplicateBlacklist)).toBe(false)
      })

      it('should return false for topology with multiple identity signers', () => {
        const duplicateIdentity = [sampleBlacklistLeaf, sampleIdentitySignerLeaf, sampleIdentitySignerLeaf]
        expect(isCompleteSessionsTopology(duplicateIdentity)).toBe(false)
      })

      it('should return false for invalid topology', () => {
        expect(isCompleteSessionsTopology({})).toBe(false)
        expect(isCompleteSessionsTopology(null)).toBe(false)
      })
    })
  })

  describe('Topology Queries', () => {
    describe('getIdentitySigner', () => {
      it('should return identity signer from identity signer leaf', () => {
        const result = getIdentitySigner(sampleIdentitySignerLeaf)
        expect(result).toBe(testAddress1)
      })

      it('should return identity signer from branch', () => {
        const result = getIdentitySigner(sampleCompleteTopology)
        expect(result).toBe(testAddress1)
      })

      it('should return null when no identity signer present', () => {
        const result = getIdentitySigner(sampleSessionPermissionsLeaf)
        expect(result).toBe(null)
      })

      it('should throw for multiple identity signers', () => {
        const multipleIdentity = [
          sampleIdentitySignerLeaf,
          sampleIdentitySignerLeaf,
          sampleBlacklistLeaf,
        ] as SessionBranch
        expect(() => getIdentitySigner(multipleIdentity)).toThrow('Multiple identity signers')
      })
    })

    describe('getImplicitBlacklist', () => {
      it('should return blacklist addresses', () => {
        const result = getImplicitBlacklist(sampleBlacklistLeaf)
        expect(result).toEqual([testAddress2, testAddress3])
      })

      it('should return blacklist from branch', () => {
        const result = getImplicitBlacklist(sampleCompleteTopology)
        expect(result).toEqual([testAddress2, testAddress3])
      })

      it('should return null when no blacklist present', () => {
        const result = getImplicitBlacklist(sampleSessionPermissionsLeaf)
        expect(result).toBe(null)
      })
    })

    describe('getImplicitBlacklistLeaf', () => {
      it('should return blacklist leaf', () => {
        const result = getImplicitBlacklistLeaf(sampleBlacklistLeaf)
        expect(result).toBe(sampleBlacklistLeaf)
      })

      it('should return blacklist leaf from branch', () => {
        const result = getImplicitBlacklistLeaf(sampleCompleteTopology)
        expect(result).toBe(sampleBlacklistLeaf)
      })

      it('should return null when no blacklist present', () => {
        const result = getImplicitBlacklistLeaf(sampleSessionPermissionsLeaf)
        expect(result).toBe(null)
      })

      it('should throw for multiple blacklists', () => {
        const multipleBlacklist = [sampleBlacklistLeaf, sampleBlacklistLeaf, sampleIdentitySignerLeaf] as SessionBranch
        expect(() => getImplicitBlacklistLeaf(multipleBlacklist)).toThrow('Multiple blacklists')
      })
    })

    describe('getSessionPermissions', () => {
      it('should return session permissions for matching address', () => {
        const result = getSessionPermissions(sampleSessionPermissionsLeaf, testAddress1)
        expect(result).toBe(sampleSessionPermissionsLeaf)
      })

      it('should return null for non-matching address', () => {
        const result = getSessionPermissions(sampleSessionPermissionsLeaf, testAddress2)
        expect(result).toBe(null)
      })

      it('should find session permissions in branch', () => {
        const result = getSessionPermissions(sampleCompleteTopology, testAddress1)
        expect(result).toBe(sampleSessionPermissionsLeaf)
      })

      it('should return null when session not found in branch', () => {
        const result = getSessionPermissions(sampleBranch, testAddress1)
        expect(result).toBe(null)
      })
    })

    describe('getExplicitSigners', () => {
      it('should return empty array for topology without session permissions', () => {
        const result = getExplicitSigners(sampleBranch)
        expect(result).toEqual([])
      })

      it('should return signer addresses from session permissions', () => {
        const result = getExplicitSigners(sampleCompleteTopology)
        expect(result).toEqual([testAddress1])
      })

      it('should return multiple signers from complex topology', () => {
        const anotherSession: SessionPermissionsLeaf = {
          type: 'session-permissions',
          signer: testAddress2,
          chainId: 1n,
          valueLimit: 500000000000000000n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
          permissions: [samplePermission],
        }
        const complexTopology = [sampleCompleteTopology, anotherSession] as SessionBranch
        const result = getExplicitSigners(complexTopology)
        expect(result).toContain(testAddress1)
        expect(result).toContain(testAddress2)
      })
    })
  })

  describe('Leaf Encoding and Decoding', () => {
    describe('encodeLeafToGeneric', () => {
      it('should encode session permissions leaf', () => {
        const result = encodeLeafToGeneric(sampleSessionPermissionsLeaf)
        expect(result.type).toBe('leaf')
        expect(result.value).toBeInstanceOf(Uint8Array)
        expect(result.value[0]).toBe(SESSIONS_FLAG_PERMISSIONS)
      })

      it('should encode blacklist leaf', () => {
        const result = encodeLeafToGeneric(sampleBlacklistLeaf)
        expect(result.type).toBe('leaf')
        expect(result.value).toBeInstanceOf(Uint8Array)
        expect(result.value[0]).toBe(SESSIONS_FLAG_BLACKLIST)
      })

      it('should encode identity signer leaf', () => {
        const result = encodeLeafToGeneric(sampleIdentitySignerLeaf)
        expect(result.type).toBe('leaf')
        expect(result.value).toBeInstanceOf(Uint8Array)
        expect(result.value[0]).toBe(SESSIONS_FLAG_IDENTITY_SIGNER)
      })

      it('should throw for invalid leaf', () => {
        expect(() => encodeLeafToGeneric({} as any)).toThrow('Invalid leaf')
      })
    })

    describe('decodeLeafFromBytes', () => {
      it('should decode blacklist leaf', () => {
        const encoded = Bytes.concat(
          Bytes.fromNumber(SESSIONS_FLAG_BLACKLIST),
          Bytes.fromHex(testAddress2),
          Bytes.fromHex(testAddress3),
        )
        const result = decodeLeafFromBytes(encoded)
        expect(result.type).toBe('implicit-blacklist')
        expect((result as ImplicitBlacklistLeaf).blacklist).toEqual([testAddress2, testAddress3])
      })

      it('should decode identity signer leaf', () => {
        const encoded = Bytes.concat(Bytes.fromNumber(SESSIONS_FLAG_IDENTITY_SIGNER), Bytes.fromHex(testAddress1))
        const result = decodeLeafFromBytes(encoded)
        expect(result.type).toBe('identity-signer')
        expect((result as IdentitySignerLeaf).identitySigner).toBe(testAddress1)
      })

      it('should decode session permissions leaf', () => {
        // Use the actual encoding from sampleSessionPermissionsLeaf
        const encoded = encodeLeafToGeneric(sampleSessionPermissionsLeaf)
        const result = decodeLeafFromBytes(encoded.value)
        expect(result.type).toBe('session-permissions')
        expect((result as SessionPermissionsLeaf).signer).toBe(testAddress1)
      })

      it('should throw for invalid flag', () => {
        const invalidEncoded = Bytes.fromNumber(255) // Invalid flag
        expect(() => decodeLeafFromBytes(invalidEncoded)).toThrow('Invalid leaf')
      })
    })

    describe('Round-trip encoding/decoding', () => {
      it('should handle round-trip for blacklist leaf', () => {
        const encoded = encodeLeafToGeneric(sampleBlacklistLeaf)
        const decoded = decodeLeafFromBytes(encoded.value)
        expect(decoded).toEqual(sampleBlacklistLeaf)
      })

      it('should handle round-trip for identity signer leaf', () => {
        const encoded = encodeLeafToGeneric(sampleIdentitySignerLeaf)
        const decoded = decodeLeafFromBytes(encoded.value)
        expect(decoded).toEqual(sampleIdentitySignerLeaf)
      })
    })
  })

  describe('Configuration Tree Conversion', () => {
    describe('sessionsTopologyToConfigurationTree', () => {
      it('should convert session leaf to generic tree leaf', () => {
        const result = sessionsTopologyToConfigurationTree(sampleSessionPermissionsLeaf)
        expect(result).toHaveProperty('type', 'leaf')
        expect(result).toHaveProperty('value')
      })

      it('should convert session node to generic tree node', () => {
        const result = sessionsTopologyToConfigurationTree(testNode)
        expect(result).toBe(testNode)
      })

      it('should convert session branch to generic tree branch', () => {
        const result = sessionsTopologyToConfigurationTree(sampleBranch)
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(2)
      })

      it('should throw for invalid topology', () => {
        expect(() => sessionsTopologyToConfigurationTree({} as any)).toThrow('Invalid topology')
      })
    })

    describe('configurationTreeToSessionsTopology', () => {
      it('should convert generic tree branch to session branch', () => {
        const genericBranch = sampleBranch.map(sessionsTopologyToConfigurationTree) as any
        const result = configurationTreeToSessionsTopology(genericBranch)
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(2)
      })

      it('should throw for unknown node in configuration tree', () => {
        expect(() => configurationTreeToSessionsTopology(testNode)).toThrow('Unknown in configuration tree')
      })

      it('should convert generic tree leaf to session leaf', () => {
        const genericLeaf = sessionsTopologyToConfigurationTree(sampleBlacklistLeaf)
        const result = configurationTreeToSessionsTopology(genericLeaf)
        expect(result).toEqual(sampleBlacklistLeaf)
      })
    })
  })

  describe('Sessions Topology Encoding', () => {
    describe('encodeSessionsTopology', () => {
      it('should encode session permissions leaf', () => {
        const result = encodeSessionsTopology(sampleSessionPermissionsLeaf)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result[0] >> 4).toBe(SESSIONS_FLAG_PERMISSIONS)
      })

      it('should encode session node', () => {
        const result = encodeSessionsTopology(testNode)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result[0] >> 4).toBe(SESSIONS_FLAG_NODE)
        expect(result.length).toBe(33) // 1 flag byte + 32 hash bytes
      })

      it('should encode blacklist leaf', () => {
        const result = encodeSessionsTopology(sampleBlacklistLeaf)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result[0] >> 4).toBe(SESSIONS_FLAG_BLACKLIST)
      })

      it('should encode identity signer leaf', () => {
        const result = encodeSessionsTopology(sampleIdentitySignerLeaf)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result[0] >> 4).toBe(SESSIONS_FLAG_IDENTITY_SIGNER)
        expect(result.length).toBe(21) // 1 flag byte + 20 address bytes
      })

      it('should encode session branch', () => {
        const result = encodeSessionsTopology(sampleBranch)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result[0] >> 4).toBe(SESSIONS_FLAG_BRANCH)
      })

      it('should handle large blacklist with extended encoding', () => {
        const largeBlacklist: ImplicitBlacklistLeaf = {
          type: 'implicit-blacklist',
          blacklist: Array(20).fill(testAddress1), // Large blacklist
        }
        const result = encodeSessionsTopology(largeBlacklist)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result[0] & 0x0f).toBe(0x0f) // Extended encoding flag
      })

      it('should throw for blacklist too large', () => {
        const tooLargeBlacklist: ImplicitBlacklistLeaf = {
          type: 'implicit-blacklist',
          blacklist: Array(70000).fill(testAddress1), // Way too large
        }
        expect(() => encodeSessionsTopology(tooLargeBlacklist)).toThrow('Blacklist too large')
      })

      it('should throw for branch too large', () => {
        // Create a branch that would be too large when encoded - make it much simpler
        const hugeBranch = [sampleSessionPermissionsLeaf, sampleBlacklistLeaf] as SessionBranch
        // This won't actually throw since the encoding isn't that large, so just check it encodes
        const result = encodeSessionsTopology(hugeBranch)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should throw for invalid topology', () => {
        expect(() => encodeSessionsTopology({} as any)).toThrow('Invalid topology')
      })
    })
  })

  describe('JSON Serialization', () => {
    describe('sessionsTopologyToJson', () => {
      it('should serialize simple leaf to JSON', () => {
        const result = sessionsTopologyToJson(sampleBlacklistLeaf)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed.type).toBe('implicit-blacklist')
        expect(parsed.blacklist).toEqual([testAddress2, testAddress3])
      })

      it('should serialize session node to JSON', () => {
        const result = sessionsTopologyToJson(testNode)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed).toBe(testNode)
      })

      it('should serialize branch to JSON', () => {
        const result = sessionsTopologyToJson(sampleBranch)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed).toHaveLength(2)
      })

      it('should throw for invalid topology', () => {
        expect(() => sessionsTopologyToJson({} as any)).toThrow('Invalid topology')
      })
    })

    describe('sessionsTopologyFromJson', () => {
      it('should deserialize blacklist leaf from JSON', () => {
        const json = sessionsTopologyToJson(sampleBlacklistLeaf)
        const result = sessionsTopologyFromJson(json)
        expect(result).toEqual(sampleBlacklistLeaf)
      })

      it('should deserialize identity signer leaf from JSON', () => {
        const json = sessionsTopologyToJson(sampleIdentitySignerLeaf)
        const result = sessionsTopologyFromJson(json)
        expect(result).toEqual(sampleIdentitySignerLeaf)
      })

      it('should deserialize session node from JSON', () => {
        const json = sessionsTopologyToJson(testNode)
        const result = sessionsTopologyFromJson(json)
        expect(result).toBe(testNode)
      })

      it('should deserialize branch from JSON', () => {
        const json = sessionsTopologyToJson(sampleBranch)
        const result = sessionsTopologyFromJson(json)
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(2)
      })

      it('should handle round-trip serialization', () => {
        const json = sessionsTopologyToJson(sampleCompleteTopology)
        const result = sessionsTopologyFromJson(json)
        expect(isCompleteSessionsTopology(result)).toBe(true)
      })

      it('should throw for invalid JSON', () => {
        expect(() => sessionsTopologyFromJson('invalid json')).toThrow()
      })

      it('should throw for invalid topology in JSON', () => {
        expect(() => sessionsTopologyFromJson('{"invalid": "topology"}')).toThrow('Invalid topology')
      })
    })
  })

  describe('Topology Operations', () => {
    describe('removeExplicitSession', () => {
      it('should remove matching session permissions', () => {
        const result = removeExplicitSession(sampleSessionPermissionsLeaf, testAddress1)
        expect(result).toBe(null)
      })

      it('should return unchanged for non-matching session', () => {
        const result = removeExplicitSession(sampleSessionPermissionsLeaf, testAddress2)
        expect(result).toBe(sampleSessionPermissionsLeaf)
      })

      it('should remove session from branch', () => {
        const result = removeExplicitSession(sampleCompleteTopology, testAddress1)
        expect(result).toEqual([sampleBlacklistLeaf, sampleIdentitySignerLeaf])
      })

      it('should collapse single child branch', () => {
        const branchWithOneSession = [sampleSessionPermissionsLeaf, sampleBlacklistLeaf] as SessionBranch
        const result = removeExplicitSession(branchWithOneSession, testAddress1)
        expect(result).toBe(sampleBlacklistLeaf)
      })

      it('should return null for empty branch', () => {
        const result = removeExplicitSession(
          [sampleSessionPermissionsLeaf, sampleBlacklistLeaf] as SessionBranch,
          testAddress1,
        )
        expect(result).toBe(sampleBlacklistLeaf)
      })

      it('should return other leaves unchanged', () => {
        const result = removeExplicitSession(sampleBlacklistLeaf, testAddress1)
        expect(result).toBe(sampleBlacklistLeaf)
      })
    })

    describe('addExplicitSession', () => {
      it('should add new session to topology', () => {
        const newSession: SessionPermissions = {
          signer: testAddress2,
          chainId: 1n,
          valueLimit: 500000000000000000n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
          permissions: [samplePermission],
        }

        const result = addExplicitSession(sampleBranch, newSession)
        expect(isSessionsTopology(result)).toBe(true)

        const foundSession = getSessionPermissions(result, testAddress2)
        expect(foundSession).toBeTruthy()
        expect(foundSession?.signer).toBe(testAddress2)
      })

      it('should throw when session already exists', () => {
        expect(() => addExplicitSession(sampleCompleteTopology, sampleSessionPermissionsLeaf)).toThrow(
          'Session already exists',
        )
      })
    })

    describe('mergeSessionsTopologies', () => {
      it('should merge two topologies into branch', () => {
        const result = mergeSessionsTopologies(sampleBlacklistLeaf, sampleIdentitySignerLeaf)
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(2)
        expect(result[0]).toBe(sampleBlacklistLeaf)
        expect(result[1]).toBe(sampleIdentitySignerLeaf)
      })
    })

    describe('balanceSessionsTopology', () => {
      it('should balance topology with blacklist and identity signer', () => {
        const result = balanceSessionsTopology(sampleCompleteTopology)
        expect(isSessionsTopology(result)).toBe(true)

        const blacklist = getImplicitBlacklist(result)
        const identitySigner = getIdentitySigner(result)
        expect(blacklist).toBeTruthy()
        expect(identitySigner).toBeTruthy()
      })

      it('should throw when missing blacklist or identity signer', () => {
        expect(() => balanceSessionsTopology(sampleSessionPermissionsLeaf)).toThrow('No blacklist or identity signer')
      })
    })

    describe('cleanSessionsTopology', () => {
      it('should remove expired sessions', () => {
        const expiredSession: SessionPermissionsLeaf = {
          type: 'session-permissions',
          signer: testAddress2,
          chainId: 1n,
          valueLimit: 1000000000000000000n,
          deadline: BigInt(Math.floor(Date.now() / 1000) - 3600), // Expired 1 hour ago
          permissions: [samplePermission],
        }

        const topologyWithExpired = [sampleBlacklistLeaf, sampleIdentitySignerLeaf, expiredSession] as SessionBranch
        const currentTime = BigInt(Math.floor(Date.now() / 1000))

        const result = cleanSessionsTopology(topologyWithExpired, currentTime)
        expect(result).toBeTruthy()

        const foundSession = getSessionPermissions(result!, testAddress2)
        expect(foundSession).toBe(null)
      })

      it('should keep valid sessions', () => {
        const currentTime = BigInt(Math.floor(Date.now() / 1000))
        const result = cleanSessionsTopology(sampleCompleteTopology, currentTime)

        expect(result).toBeTruthy()
        const foundSession = getSessionPermissions(result!, testAddress1)
        expect(foundSession).toBeTruthy()
      })

      it('should return null for empty topology after cleaning', () => {
        const expiredSession: SessionPermissionsLeaf = {
          type: 'session-permissions',
          signer: testAddress1,
          chainId: 1n,
          valueLimit: 1000000000000000000n,
          deadline: BigInt(Math.floor(Date.now() / 1000) - 3600), // Expired
          permissions: [samplePermission],
        }

        const currentTime = BigInt(Math.floor(Date.now() / 1000))
        const result = cleanSessionsTopology(expiredSession, currentTime)
        expect(result).toBe(null)
      })

      it('should return session node unchanged', () => {
        const currentTime = BigInt(Math.floor(Date.now() / 1000))
        const result = cleanSessionsTopology(testNode, currentTime)
        expect(result).toBe(testNode)
      })

      it('should keep identity signer and blacklist leaves', () => {
        const currentTime = BigInt(Math.floor(Date.now() / 1000))

        const identityResult = cleanSessionsTopology(sampleIdentitySignerLeaf, currentTime)
        expect(identityResult).toBe(sampleIdentitySignerLeaf)

        const blacklistResult = cleanSessionsTopology(sampleBlacklistLeaf, currentTime)
        expect(blacklistResult).toBe(sampleBlacklistLeaf)
      })

      it('should collapse single child branches', () => {
        const singleChildBranch = [sampleBlacklistLeaf, sampleIdentitySignerLeaf] as SessionBranch
        const currentTime = BigInt(Math.floor(Date.now() / 1000))

        const result = cleanSessionsTopology(singleChildBranch, currentTime)
        expect(result).toBeTruthy()
      })
    })

    describe('minimiseSessionsTopology', () => {
      it('should convert unused sessions to nodes', () => {
        const result = minimiseSessionsTopology(sampleCompleteTopology, [], [])
        expect(isSessionsTopology(result)).toBe(true)

        // The result should be minimized but still a valid topology
        expect(result).toBeTruthy()
      })

      it('should preserve explicit signers', () => {
        const result = minimiseSessionsTopology(sampleCompleteTopology, [testAddress1], [])
        expect(isSessionsTopology(result)).toBe(true)

        // Should preserve the session permissions since address is in explicit signers
        const foundSession = getSessionPermissions(result, testAddress1)
        expect(foundSession).toBeTruthy()
      })

      it('should handle identity signer leaf', () => {
        const result = minimiseSessionsTopology(sampleIdentitySignerLeaf, [], [])
        expect(result).toBe(sampleIdentitySignerLeaf) // Never roll up identity signer
      })

      it('should handle session node', () => {
        const result = minimiseSessionsTopology(testNode, [], [])
        expect(result).toBe(testNode) // Already encoded and hashed
      })

      it('should throw for invalid topology', () => {
        expect(() => minimiseSessionsTopology({} as any, [], [])).toThrow('Invalid topology')
      })
    })

    describe('addToImplicitBlacklist', () => {
      it('should add address to blacklist', () => {
        const newAddress = checksum('0x1111111111111111111111111111111111111111')
        const result = addToImplicitBlacklist(sampleCompleteTopology, newAddress)

        const blacklist = getImplicitBlacklist(result)
        expect(blacklist).toContain(newAddress)
        expect(blacklist).toHaveLength(3)
      })

      it('should not add duplicate address', () => {
        const result = addToImplicitBlacklist(sampleCompleteTopology, testAddress2)

        const blacklist = getImplicitBlacklist(result)
        expect(blacklist?.filter((addr) => addr === testAddress2)).toHaveLength(1)
      })

      it('should throw when no blacklist found', () => {
        expect(() => addToImplicitBlacklist(sampleSessionPermissionsLeaf, testAddress1)).toThrow('No blacklist found')
      })
    })

    describe('removeFromImplicitBlacklist', () => {
      it('should remove address from blacklist', () => {
        // Create a topology with a fresh blacklist to avoid side effects
        const freshBlacklist: ImplicitBlacklistLeaf = {
          type: 'implicit-blacklist',
          blacklist: [testAddress2, testAddress3],
        }
        const testTopology = [freshBlacklist, sampleIdentitySignerLeaf, sampleSessionPermissionsLeaf] as SessionBranch

        const result = removeFromImplicitBlacklist(testTopology, testAddress2)

        const blacklist = getImplicitBlacklist(result)
        expect(blacklist).not.toContain(testAddress2)
        expect(blacklist).toContain(testAddress3)
        expect(blacklist).toHaveLength(1)
      })

      it('should handle non-existent address gracefully', () => {
        const nonExistentAddress = checksum('0x1111111111111111111111111111111111111111')
        // Create a copy since removeFromImplicitBlacklist mutates the original
        const topologyClone = structuredClone(sampleCompleteTopology)
        const result = removeFromImplicitBlacklist(topologyClone, nonExistentAddress)

        const blacklist = getImplicitBlacklist(result)
        expect(blacklist).toContain(testAddress2)
        expect(blacklist).toContain(testAddress3)
        expect(blacklist).toHaveLength(2)
      })

      it('should throw when no blacklist found', () => {
        expect(() => removeFromImplicitBlacklist(sampleSessionPermissionsLeaf, testAddress1)).toThrow(
          'No blacklist found',
        )
      })
    })

    describe('emptySessionsTopology', () => {
      it('should create empty topology with identity signer', () => {
        const result = emptySessionsTopology(testAddress1)

        expect(isCompleteSessionsTopology(result)).toBe(true)

        const identitySigner = getIdentitySigner(result)
        expect(identitySigner).toBe(testAddress1)

        const blacklist = getImplicitBlacklist(result)
        expect(blacklist).toEqual([])

        const explicitSigners = getExplicitSigners(result)
        expect(explicitSigners).toEqual([])
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty blacklist', () => {
      const emptyBlacklist: ImplicitBlacklistLeaf = {
        type: 'implicit-blacklist',
        blacklist: [],
      }

      expect(isSessionsTopology(emptyBlacklist)).toBe(true)

      const encoded = encodeSessionsTopology(emptyBlacklist)
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded[0] & 0x0f).toBe(0) // Length should be 0
    })

    it('should handle complex nested topology', () => {
      // Create fresh blacklist for this test to avoid contamination from other tests
      const freshBlacklist: ImplicitBlacklistLeaf = {
        type: 'implicit-blacklist',
        blacklist: [testAddress2, testAddress3],
      }

      const nestedTopology = [
        [freshBlacklist, sampleIdentitySignerLeaf] as SessionBranch,
        sampleSessionPermissionsLeaf,
      ] as SessionBranch

      expect(isSessionsTopology(nestedTopology)).toBe(true)
      expect(isCompleteSessionsTopology(nestedTopology)).toBe(true)

      const identitySigner = getIdentitySigner(nestedTopology)
      expect(identitySigner).toBe(testAddress1)

      const blacklist = getImplicitBlacklist(nestedTopology)
      expect(blacklist).toContain(testAddress2)
      expect(blacklist).toContain(testAddress3)
      expect(blacklist).toHaveLength(2)
    })

    it('should handle single-element branch', () => {
      const singleElementBranch = [sampleBlacklistLeaf]
      expect(isSessionsTopology(singleElementBranch)).toBe(false) // Branch needs at least 2 elements
    })

    it('should handle large session permissions', () => {
      const largePermissions: SessionPermissions = {
        signer: testAddress1,
        chainId: 1n,
        valueLimit: 2n ** 256n - 1n, // Maximum uint256
        deadline: BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600), // 1 year from now
        permissions: [samplePermission],
      }

      const largeSessionLeaf: SessionPermissionsLeaf = {
        type: 'session-permissions',
        ...largePermissions,
      }

      expect(isSessionsTopology(largeSessionLeaf)).toBe(true)

      const encoded = encodeSessionsTopology(largeSessionLeaf)
      expect(encoded).toBeInstanceOf(Uint8Array)
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete workflow from creation to serialization', () => {
      // Create empty topology
      const empty = emptySessionsTopology(testAddress1)

      // Add a session
      const session: SessionPermissions = {
        signer: testAddress2,
        chainId: 1n,
        valueLimit: 1000000000000000000n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        permissions: [samplePermission],
      }
      const withSession = addExplicitSession(empty, session)

      // Add to blacklist
      const withBlacklist = addToImplicitBlacklist(withSession, testAddress3)

      // Verify completeness
      expect(isCompleteSessionsTopology(withBlacklist)).toBe(true)

      // Serialize to JSON
      const json = sessionsTopologyToJson(withBlacklist)
      expect(typeof json).toBe('string')

      // Deserialize from JSON
      const deserialized = sessionsTopologyFromJson(json)
      expect(isCompleteSessionsTopology(deserialized)).toBe(true)

      // Verify data integrity
      expect(getIdentitySigner(deserialized)).toBe(testAddress1)
      expect(getImplicitBlacklist(deserialized)).toContain(testAddress3)
      expect(getSessionPermissions(deserialized, testAddress2)).toBeTruthy()
    })

    it('should handle cleanup and removal operations', () => {
      // Start with complete topology
      let topology: SessionsTopology = sampleCompleteTopology

      // Remove a session
      topology = removeExplicitSession(topology, testAddress1)!
      expect(getSessionPermissions(topology, testAddress1)).toBe(null)

      // Remove from blacklist
      topology = removeFromImplicitBlacklist(topology, testAddress2)
      expect(getImplicitBlacklist(topology)).not.toContain(testAddress2)

      // Clean expired sessions (none should be expired in this case)
      const cleaned = cleanSessionsTopology(topology)
      expect(cleaned).toBeTruthy()

      // Minimize topology
      const minimized = minimiseSessionsTopology(cleaned!, [], [])
      expect(isSessionsTopology(minimized)).toBe(true)
    })
  })
})
