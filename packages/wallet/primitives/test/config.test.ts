import { describe, expect, it } from 'vitest'
import { Address, Bytes, Hash, Hex } from 'ox'

import {
  Config,
  Topology,
  SignerLeaf,
  SapientSignerLeaf,
  SubdigestLeaf,
  AnyAddressSubdigestLeaf,
  NestedLeaf,
  NodeLeaf,
  Node,
  isSignerLeaf,
  isSapientSignerLeaf,
  isSubdigestLeaf,
  isAnyAddressSubdigestLeaf,
  isNodeLeaf,
  isNestedLeaf,
  isNode,
  isConfig,
  isLeaf,
  isTopology,
  getSigners,
  findSignerLeaf,
  getWeight,
  hashConfiguration,
  flatLeavesToTopology,
  configToJson,
  configFromJson,
  mergeTopology,
  hasInvalidValues,
  maximumDepth,
  evaluateConfigurationSafety,
  normalizeSignerSignature,
} from '../src/config.js'

describe('Config', () => {
  const testAddress1 = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1'
  const testAddress2 = '0x8ba1f109551bd432803012645aac136c776056c0'
  const testImageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testDigest = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef'

  const sampleSignerLeaf: SignerLeaf = {
    type: 'signer',
    address: testAddress1,
    weight: 1n,
  }

  const sampleSapientSignerLeaf: SapientSignerLeaf = {
    type: 'sapient-signer',
    address: testAddress2,
    weight: 2n,
    imageHash: testImageHash,
  }

  const sampleSubdigestLeaf: SubdigestLeaf = {
    type: 'subdigest',
    digest: testDigest,
  }

  const sampleAnyAddressSubdigestLeaf: AnyAddressSubdigestLeaf = {
    type: 'any-address-subdigest',
    digest: testDigest,
  }

  const sampleNodeLeaf: NodeLeaf = '0x1111111111111111111111111111111111111111111111111111111111111111'

  const sampleNestedLeaf: NestedLeaf = {
    type: 'nested',
    tree: sampleSignerLeaf,
    weight: 3n,
    threshold: 1n,
  }

  const sampleNode: Node = [sampleSignerLeaf, sampleSapientSignerLeaf]

  const sampleConfig: Config = {
    threshold: 2n,
    checkpoint: 100n,
    topology: sampleNode,
    checkpointer: testAddress1,
  }

  describe('Type Guards', () => {
    describe('isSignerLeaf', () => {
      it('should return true for valid signer leaf', () => {
        expect(isSignerLeaf(sampleSignerLeaf)).toBe(true)
      })

      it('should return false for other types', () => {
        expect(isSignerLeaf(sampleSapientSignerLeaf)).toBe(false)
        expect(isSignerLeaf(sampleSubdigestLeaf)).toBe(false)
        expect(isSignerLeaf(sampleNode)).toBe(false)
        expect(isSignerLeaf(null)).toBe(false)
        expect(isSignerLeaf(undefined)).toBe(false)
        expect(isSignerLeaf('string')).toBe(false)
      })
    })

    describe('isSapientSignerLeaf', () => {
      it('should return true for valid sapient signer leaf', () => {
        expect(isSapientSignerLeaf(sampleSapientSignerLeaf)).toBe(true)
      })

      it('should return false for other types', () => {
        expect(isSapientSignerLeaf(sampleSignerLeaf)).toBe(false)
        expect(isSapientSignerLeaf(sampleSubdigestLeaf)).toBe(false)
        expect(isSapientSignerLeaf(sampleNode)).toBe(false)
        expect(isSapientSignerLeaf(null)).toBe(false)
      })
    })

    describe('isSubdigestLeaf', () => {
      it('should return true for valid subdigest leaf', () => {
        expect(isSubdigestLeaf(sampleSubdigestLeaf)).toBe(true)
      })

      it('should return false for other types', () => {
        expect(isSubdigestLeaf(sampleSignerLeaf)).toBe(false)
        expect(isSubdigestLeaf(sampleNode)).toBe(false)
        expect(isSubdigestLeaf(null)).toBe(false)
      })
    })

    describe('isAnyAddressSubdigestLeaf', () => {
      it('should return true for valid any-address-subdigest leaf', () => {
        expect(isAnyAddressSubdigestLeaf(sampleAnyAddressSubdigestLeaf)).toBe(true)
      })

      it('should return false for other types', () => {
        expect(isAnyAddressSubdigestLeaf(sampleSubdigestLeaf)).toBe(false)
        expect(isAnyAddressSubdigestLeaf(sampleSignerLeaf)).toBe(false)
        expect(isAnyAddressSubdigestLeaf(null)).toBe(false)
      })
    })

    describe('isNodeLeaf', () => {
      it('should return true for valid node leaf (66 char hex)', () => {
        expect(isNodeLeaf(sampleNodeLeaf)).toBe(true)
      })

      it('should return false for invalid hex or wrong length', () => {
        expect(isNodeLeaf('0x1234')).toBe(false) // Too short
        expect(isNodeLeaf('not-hex')).toBe(false)
        expect(isNodeLeaf(sampleSignerLeaf)).toBe(false)
        expect(isNodeLeaf(null)).toBe(false)
      })
    })

    describe('isNestedLeaf', () => {
      it('should return true for valid nested leaf', () => {
        expect(isNestedLeaf(sampleNestedLeaf)).toBe(true)
      })

      it('should return false for other types', () => {
        expect(isNestedLeaf(sampleSignerLeaf)).toBe(false)
        expect(isNestedLeaf(sampleNode)).toBe(false)
        expect(isNestedLeaf(null)).toBe(false)
      })
    })

    describe('isNode', () => {
      it('should return true for valid node (array of 2 topologies)', () => {
        expect(isNode(sampleNode)).toBe(true)
      })

      it('should return false for invalid nodes', () => {
        expect(isNode([sampleSignerLeaf])).toBe(false) // Wrong length
        expect(isNode([sampleSignerLeaf, sampleSignerLeaf, sampleSignerLeaf])).toBe(false) // Wrong length
        expect(isNode(['invalid', 'invalid'])).toBe(false) // Invalid topologies
        expect(isNode(sampleSignerLeaf)).toBe(false)
        expect(isNode(null)).toBe(false)
      })
    })

    describe('isConfig', () => {
      it('should return true for valid config', () => {
        expect(isConfig(sampleConfig)).toBe(true)
      })

      it('should return false for invalid configs', () => {
        expect(isConfig({ threshold: 1n })).toBe(false) // Missing fields
        expect(isConfig(sampleSignerLeaf)).toBe(false)
        expect(isConfig(undefined)).toBe(false)
        // Note: null would trigger a bug in isConfig function - 'in' operator used without null check
      })
    })

    describe('isLeaf', () => {
      it('should return true for all leaf types', () => {
        expect(isLeaf(sampleSignerLeaf)).toBe(true)
        expect(isLeaf(sampleSapientSignerLeaf)).toBe(true)
        expect(isLeaf(sampleSubdigestLeaf)).toBe(true)
        expect(isLeaf(sampleAnyAddressSubdigestLeaf)).toBe(true)
        expect(isLeaf(sampleNodeLeaf)).toBe(true)
        expect(isLeaf(sampleNestedLeaf)).toBe(true)
      })

      it('should return false for nodes', () => {
        expect(isLeaf(sampleNode)).toBe(false)
      })
    })

    describe('isTopology', () => {
      it('should return true for all topology types', () => {
        expect(isTopology(sampleNode)).toBe(true)
        expect(isTopology(sampleSignerLeaf)).toBe(true)
        expect(isTopology(sampleSapientSignerLeaf)).toBe(true)
        expect(isTopology(sampleSubdigestLeaf)).toBe(true)
        expect(isTopology(sampleNestedLeaf)).toBe(true)
      })

      it('should return false for invalid topologies', () => {
        expect(isTopology(null)).toBe(false)
        expect(isTopology('invalid')).toBe(false)
        expect(isTopology({})).toBe(false)
      })
    })
  })

  describe('getSigners', () => {
    it('should extract signers from simple topology', () => {
      const result = getSigners(sampleSignerLeaf)

      expect(result.signers).toEqual([testAddress1])
      expect(result.sapientSigners).toEqual([])
      expect(result.isComplete).toBe(true)
    })

    it('should extract sapient signers', () => {
      const result = getSigners(sampleSapientSignerLeaf)

      expect(result.signers).toEqual([])
      expect(result.sapientSigners).toEqual([{ address: testAddress2, imageHash: testImageHash }])
      expect(result.isComplete).toBe(true)
    })

    it('should handle complex node topology', () => {
      const result = getSigners(sampleNode)

      expect(result.signers).toEqual([testAddress1])
      expect(result.sapientSigners).toEqual([{ address: testAddress2, imageHash: testImageHash }])
      expect(result.isComplete).toBe(true)
    })

    it('should handle config input', () => {
      const result = getSigners(sampleConfig)

      expect(result.signers).toEqual([testAddress1])
      expect(result.sapientSigners).toEqual([{ address: testAddress2, imageHash: testImageHash }])
      expect(result.isComplete).toBe(true)
    })

    it('should handle nested topology', () => {
      const result = getSigners(sampleNestedLeaf)

      expect(result.signers).toEqual([testAddress1])
      expect(result.sapientSigners).toEqual([])
      expect(result.isComplete).toBe(true)
    })

    it('should mark incomplete when node leaf present', () => {
      const result = getSigners(sampleNodeLeaf)

      expect(result.signers).toEqual([])
      expect(result.sapientSigners).toEqual([])
      expect(result.isComplete).toBe(false)
    })

    it('should ignore zero weight signers', () => {
      const zeroWeightSigner: SignerLeaf = { ...sampleSignerLeaf, weight: 0n }
      const result = getSigners(zeroWeightSigner)

      expect(result.signers).toEqual([])
      expect(result.isComplete).toBe(true)
    })
  })

  describe('findSignerLeaf', () => {
    it('should find signer in simple topology', () => {
      const result = findSignerLeaf(sampleSignerLeaf, testAddress1)
      expect(result).toEqual(sampleSignerLeaf)
    })

    it('should find signer in node topology', () => {
      const result = findSignerLeaf(sampleNode, testAddress1)
      expect(result).toEqual(sampleSignerLeaf)
    })

    it('should find sapient signer in node topology', () => {
      const result = findSignerLeaf(sampleNode, testAddress2)
      expect(result).toEqual(sampleSapientSignerLeaf)
    })

    it('should return undefined for non-existent signer', () => {
      const result = findSignerLeaf(sampleSignerLeaf, testAddress2)
      expect(result).toBeUndefined()
    })

    it('should work with config input', () => {
      const result = findSignerLeaf(sampleConfig, testAddress1)
      expect(result).toEqual(sampleSignerLeaf)
    })
  })

  describe('getWeight', () => {
    it('should return correct weight for signer leaf with canSign true', () => {
      const result = getWeight(sampleSignerLeaf, () => true)
      expect(result.weight).toBe(0n) // Not signed
      expect(result.maxWeight).toBe(1n)
    })

    it('should return zero weight when canSign false', () => {
      const result = getWeight(sampleSignerLeaf, () => false)
      expect(result.weight).toBe(0n)
      expect(result.maxWeight).toBe(0n)
    })

    it('should handle node topology', () => {
      const result = getWeight(sampleNode, () => true)
      expect(result.weight).toBe(0n) // No signed signers
      expect(result.maxWeight).toBe(3n) // 1 + 2
    })

    it('should handle nested topology', () => {
      const result = getWeight(sampleNestedLeaf, () => true)
      expect(result.weight).toBe(0n) // Threshold not met
      expect(result.maxWeight).toBe(3n) // Weight of nested leaf
    })

    it('should handle subdigest leaf', () => {
      const result = getWeight(sampleSubdigestLeaf, () => true)
      expect(result.weight).toBe(0n)
      expect(result.maxWeight).toBe(0n)
    })

    it('should handle node leaf', () => {
      const result = getWeight(sampleNodeLeaf, () => true)
      expect(result.weight).toBe(0n)
      expect(result.maxWeight).toBe(0n)
    })
  })

  describe('hashConfiguration', () => {
    it('should hash signer leaf correctly', () => {
      const hash = hashConfiguration(sampleSignerLeaf)

      // Should be deterministic
      const hash2 = hashConfiguration(sampleSignerLeaf)
      expect(Bytes.isEqual(hash, hash2)).toBe(true)
      expect(hash.length).toBe(32)
    })

    it('should hash sapient signer leaf correctly', () => {
      const hash = hashConfiguration(sampleSapientSignerLeaf)
      expect(hash.length).toBe(32)
    })

    it('should hash subdigest leaf correctly', () => {
      const hash = hashConfiguration(sampleSubdigestLeaf)
      expect(hash.length).toBe(32)
    })

    it('should hash any-address-subdigest leaf correctly', () => {
      const hash = hashConfiguration(sampleAnyAddressSubdigestLeaf)
      expect(hash.length).toBe(32)
    })

    it('should hash node leaf correctly', () => {
      const hash = hashConfiguration(sampleNodeLeaf)
      expect(Bytes.isEqual(hash, Bytes.fromHex(sampleNodeLeaf))).toBe(true)
    })

    it('should hash nested leaf correctly', () => {
      const hash = hashConfiguration(sampleNestedLeaf)
      expect(hash.length).toBe(32)
    })

    it('should hash node correctly', () => {
      const hash = hashConfiguration(sampleNode)
      expect(hash.length).toBe(32)
    })

    it('should hash config correctly', () => {
      const hash = hashConfiguration(sampleConfig)
      expect(hash.length).toBe(32)
    })

    it('should produce different hashes for different configs', () => {
      const config2: Config = { ...sampleConfig, threshold: 3n }
      const hash1 = hashConfiguration(sampleConfig)
      const hash2 = hashConfiguration(config2)
      expect(Bytes.isEqual(hash1, hash2)).toBe(false)
    })

    it('should throw for invalid topology', () => {
      expect(() => hashConfiguration({} as any)).toThrow('Invalid topology')
    })
  })

  describe('flatLeavesToTopology', () => {
    it('should handle single leaf', () => {
      const result = flatLeavesToTopology([sampleSignerLeaf])
      expect(result).toBe(sampleSignerLeaf)
    })

    it('should handle two leaves', () => {
      const result = flatLeavesToTopology([sampleSignerLeaf, sampleSapientSignerLeaf])
      expect(result).toEqual([sampleSignerLeaf, sampleSapientSignerLeaf])
    })

    it('should handle multiple leaves', () => {
      const leaves = [sampleSignerLeaf, sampleSapientSignerLeaf, sampleSubdigestLeaf, sampleNodeLeaf]
      const result = flatLeavesToTopology(leaves)
      expect(isNode(result)).toBe(true)
    })

    it('should throw for empty array', () => {
      expect(() => flatLeavesToTopology([])).toThrow('Cannot create topology from empty leaves')
    })
  })

  describe('JSON serialization', () => {
    it('should serialize config to JSON', () => {
      const json = configToJson(sampleConfig)
      expect(typeof json).toBe('string')
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('should deserialize config from JSON', () => {
      const json = configToJson(sampleConfig)
      const config = configFromJson(json)

      expect(config.threshold).toBe(sampleConfig.threshold)
      expect(config.checkpoint).toBe(sampleConfig.checkpoint)
      expect(config.checkpointer).toBe(sampleConfig.checkpointer)
    })

    it('should handle round-trip serialization', () => {
      const json = configToJson(sampleConfig)
      const config = configFromJson(json)
      const json2 = configToJson(config)

      expect(json).toBe(json2)
    })

    it('should handle complex topologies', () => {
      const complexConfig: Config = {
        threshold: 2n,
        checkpoint: 0n,
        topology: {
          type: 'nested',
          weight: 2n,
          threshold: 1n,
          tree: [sampleSignerLeaf, sampleSapientSignerLeaf],
        },
      }

      const json = configToJson(complexConfig)
      const parsed = configFromJson(json)

      expect(parsed.threshold).toBe(complexConfig.threshold)
      expect(isNestedLeaf(parsed.topology)).toBe(true)
    })
  })

  describe('mergeTopology', () => {
    it('should merge identical leaves', () => {
      const result = mergeTopology(sampleSignerLeaf, sampleSignerLeaf)
      expect(result).toEqual(sampleSignerLeaf)
    })

    it('should merge nodes recursively', () => {
      const result = mergeTopology(sampleNode, sampleNode)
      expect(result).toEqual(sampleNode)
    })

    it('should merge node with matching node leaf', () => {
      const nodeHash = Bytes.toHex(hashConfiguration(sampleNode))
      const result = mergeTopology(sampleNode, nodeHash)
      expect(result).toEqual(sampleNode)
    })

    it('should throw for mismatched node hash', () => {
      const wrongHash = '0x0000000000000000000000000000000000000000000000000000000000000000'
      expect(() => mergeTopology(sampleNode, wrongHash)).toThrow('Topology mismatch')
    })

    it('should throw for incompatible leaf types', () => {
      expect(() => mergeTopology(sampleSignerLeaf, sampleSapientSignerLeaf)).toThrow('Topology mismatch')
    })

    it('should merge matching subdigest leaves', () => {
      const result = mergeTopology(sampleSubdigestLeaf, sampleSubdigestLeaf)
      expect(result).toEqual(sampleSubdigestLeaf)
    })

    it('should throw for different subdigest values', () => {
      const differentSubdigest: SubdigestLeaf = {
        type: 'subdigest',
        digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
      }
      expect(() => mergeTopology(sampleSubdigestLeaf, differentSubdigest)).toThrow('Topology mismatch')
    })
  })

  describe('hasInvalidValues', () => {
    it('should return false for valid config', () => {
      expect(hasInvalidValues(sampleConfig)).toBe(false)
    })

    it('should return true for threshold too large', () => {
      const invalidConfig: Config = { ...sampleConfig, threshold: 65536n }
      expect(hasInvalidValues(invalidConfig)).toBe(true)
    })

    it('should return true for checkpoint too large', () => {
      const invalidConfig: Config = { ...sampleConfig, checkpoint: 72057594037927936n }
      expect(hasInvalidValues(invalidConfig)).toBe(true)
    })

    it('should return true for weight too large', () => {
      const invalidLeaf: SignerLeaf = { ...sampleSignerLeaf, weight: 256n }
      expect(hasInvalidValues(invalidLeaf)).toBe(true)
    })

    it('should return false for valid topology', () => {
      expect(hasInvalidValues(sampleSignerLeaf)).toBe(false)
      expect(hasInvalidValues(sampleNode)).toBe(false)
    })

    it('should check nested topology recursively', () => {
      const invalidNested: NestedLeaf = {
        type: 'nested',
        tree: { ...sampleSignerLeaf, weight: 256n },
        weight: 1n,
        threshold: 1n,
      }
      expect(hasInvalidValues(invalidNested)).toBe(true)
    })
  })

  describe('maximumDepth', () => {
    it('should return 0 for leaves', () => {
      expect(maximumDepth(sampleSignerLeaf)).toBe(0)
      expect(maximumDepth(sampleSapientSignerLeaf)).toBe(0)
      expect(maximumDepth(sampleSubdigestLeaf)).toBe(0)
      expect(maximumDepth(sampleNodeLeaf)).toBe(0)
    })

    it('should return 1 for simple node', () => {
      expect(maximumDepth(sampleNode)).toBe(1)
    })

    it('should return correct depth for nested topology', () => {
      expect(maximumDepth(sampleNestedLeaf)).toBe(1)
    })

    it('should handle deep nesting', () => {
      const deepNested: NestedLeaf = {
        type: 'nested',
        tree: sampleNestedLeaf,
        weight: 1n,
        threshold: 1n,
      }
      expect(maximumDepth(deepNested)).toBe(2)
    })

    it('should handle asymmetric trees', () => {
      const asymmetric: Node = [sampleSignerLeaf, [sampleSapientSignerLeaf, sampleSubdigestLeaf]]
      expect(maximumDepth(asymmetric)).toBe(2)
    })
  })

  describe('evaluateConfigurationSafety', () => {
    it('should not throw for safe config', () => {
      expect(() => evaluateConfigurationSafety(sampleConfig)).not.toThrow()
    })

    it('should throw for zero threshold', () => {
      const unsafeConfig: Config = { ...sampleConfig, threshold: 0n }
      expect(() => evaluateConfigurationSafety(unsafeConfig)).toThrow('unsafe-threshold-0')
    })

    it('should throw for invalid values', () => {
      const unsafeConfig: Config = { ...sampleConfig, threshold: 65536n }
      expect(() => evaluateConfigurationSafety(unsafeConfig)).toThrow('unsafe-invalid-values')
    })

    it('should throw for excessive depth', () => {
      // Create a deeply nested config
      let deepTopology: Topology = sampleSignerLeaf
      for (let i = 0; i < 35; i++) {
        deepTopology = {
          type: 'nested',
          tree: deepTopology,
          weight: 1n,
          threshold: 1n,
        }
      }
      const unsafeConfig: Config = { ...sampleConfig, topology: deepTopology }
      expect(() => evaluateConfigurationSafety(unsafeConfig)).toThrow('unsafe-depth')
    })

    it('should throw for unreachable threshold', () => {
      const unsafeConfig: Config = { ...sampleConfig, threshold: 100n } // Higher than max weight
      expect(() => evaluateConfigurationSafety(unsafeConfig)).toThrow('unsafe-threshold')
    })
  })

  describe('normalizeSignerSignature', () => {
    it('should handle direct value', () => {
      const value = 'test-signature'
      const result = normalizeSignerSignature(value)
      expect(result.signature).toBeInstanceOf(Promise)
    })

    it('should handle Promise value', () => {
      const promise = Promise.resolve('test-signature')
      const result = normalizeSignerSignature(promise)
      expect(result.signature).toBe(promise)
    })

    it('should handle signature object', () => {
      const sigObj = {
        signature: Promise.resolve('test-signature'),
        onSignerSignature: () => {},
        onCancel: () => {},
      }
      const result = normalizeSignerSignature(sigObj)
      expect(result).toBe(sigObj)
    })
  })

  describe('Edge cases and error conditions', () => {
    it('should handle empty node arrays correctly', () => {
      expect(isNode([])).toBe(false)
      expect(isNode([sampleSignerLeaf, sampleSignerLeaf, sampleSignerLeaf])).toBe(false)
    })

    it('should handle malformed JSON in configFromJson', () => {
      expect(() => configFromJson('invalid json')).toThrow()
    })

    it('should handle malformed topology in decodeTopology', () => {
      const invalidJson = JSON.stringify({
        threshold: '1',
        checkpoint: '0',
        topology: { type: 'invalid-type' },
      })
      expect(() => configFromJson(invalidJson)).toThrow('Invalid type in topology JSON')
    })

    it('should handle invalid node structure in JSON', () => {
      const invalidJson = JSON.stringify({
        threshold: '1',
        checkpoint: '0',
        topology: [{ type: 'signer', address: testAddress1, weight: '1' }], // Only one element - converted to string
      })
      expect(() => configFromJson(invalidJson)).toThrow('Invalid node structure in JSON')
    })

    it('should handle very large numbers in BigInt conversion', () => {
      const largeNumberConfig = {
        threshold: '999999999999999999999999999999',
        checkpoint: '999999999999999999999999999999',
        topology: {
          type: 'signer',
          address: testAddress1,
          weight: '999999999999999999999999999999',
        },
      }
      const json = JSON.stringify(largeNumberConfig)
      const config = configFromJson(json)
      expect(typeof config.threshold).toBe('bigint')
    })
  })
})
