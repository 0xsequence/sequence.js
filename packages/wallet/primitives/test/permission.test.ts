import { describe, expect, it } from 'vitest'
import { Address, Bytes } from 'ox'

import {
  ParameterOperation,
  ParameterRule,
  Permission,
  SessionPermissions,
  MAX_PERMISSIONS_COUNT,
  MAX_RULES_COUNT,
  MASK,
  encodeSessionPermissions,
  encodePermission,
  decodeSessionPermissions,
  permissionStructAbi,
  abiEncodePermission,
  sessionPermissionsToJson,
  encodeSessionPermissionsForJson,
  permissionToJson,
  parameterRuleToJson,
  sessionPermissionsFromJson,
  sessionPermissionsFromParsed,
  permissionFromJson,
} from '../src/permission.js'

describe('Permission', () => {
  // Test data
  const testAddress = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1'
  const testAddress2 = '0x8ba1f109551bd432803012645aac136c776056c0'
  const testChainId = 1n
  const testValueLimit = 1000000000000000000n // 1 ETH
  const testDeadline = 1893456000n // Jan 1, 2030

  const sampleParameterRule: ParameterRule = {
    cumulative: false,
    operation: ParameterOperation.EQUAL,
    value: Bytes.fromHex('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    offset: 4n, // After function selector
    mask: MASK.UINT256,
  }

  const sampleParameterRuleCumulative: ParameterRule = {
    cumulative: true,
    operation: ParameterOperation.LESS_THAN_OR_EQUAL,
    value: Bytes.fromHex('0x0000000000000000000000000000000000000000000000000de0b6b3a7640000'), // 1 ETH
    offset: 36n, // Value parameter in transfer
    mask: MASK.UINT256,
  }

  const samplePermission: Permission = {
    target: testAddress,
    rules: [sampleParameterRule],
  }

  const complexPermission: Permission = {
    target: testAddress2,
    rules: [sampleParameterRule, sampleParameterRuleCumulative],
  }

  const sampleSessionPermissions: SessionPermissions = {
    signer: testAddress,
    chainId: testChainId,
    valueLimit: testValueLimit,
    deadline: testDeadline,
    permissions: [samplePermission],
  }

  const complexSessionPermissions: SessionPermissions = {
    signer: testAddress2,
    chainId: 137n, // Polygon
    valueLimit: 5000000000000000000n, // 5 ETH
    deadline: testDeadline,
    permissions: [samplePermission, complexPermission],
  }

  describe('Constants', () => {
    it('should have correct max counts', () => {
      expect(MAX_PERMISSIONS_COUNT).toBe(127) // 2^7 - 1
      expect(MAX_RULES_COUNT).toBe(255) // 2^8 - 1
    })
  })

  describe('ParameterOperation enum', () => {
    it('should have correct enum values', () => {
      expect(ParameterOperation.EQUAL).toBe(0)
      expect(ParameterOperation.NOT_EQUAL).toBe(1)
      expect(ParameterOperation.GREATER_THAN_OR_EQUAL).toBe(2)
      expect(ParameterOperation.LESS_THAN_OR_EQUAL).toBe(3)
    })
  })

  describe('MASK constants', () => {
    it('should have correct selector mask', () => {
      expect(MASK.SELECTOR).toHaveLength(32)
      // Should be right-padded for selector
      expect(Bytes.toHex(MASK.SELECTOR).startsWith('0xffffffff')).toBe(true)
      expect(Bytes.toHex(MASK.SELECTOR).endsWith('00000000000000000000000000000000')).toBe(true)
    })

    it('should have correct address mask', () => {
      expect(MASK.ADDRESS).toHaveLength(32)
      // Should be left-padded for address (20 bytes)
      expect(Bytes.toHex(MASK.ADDRESS)).toBe('0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff')
    })

    it('should have correct bool mask', () => {
      expect(MASK.BOOL).toHaveLength(32)
      expect(Bytes.toHex(MASK.BOOL)).toBe('0x0000000000000000000000000000000000000000000000000000000000000001')
    })

    it('should have correct bytes masks', () => {
      expect(MASK.BYTES1).toHaveLength(32)
      expect(MASK.BYTES2).toHaveLength(32)
      expect(MASK.BYTES4).toHaveLength(32)
      expect(MASK.BYTES8).toHaveLength(32)
      expect(MASK.BYTES16).toHaveLength(32)
      expect(MASK.BYTES32).toHaveLength(32)

      // BYTES32 should be all 0xff
      expect(Bytes.toHex(MASK.BYTES32)).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    })

    it('should have correct int masks', () => {
      expect(MASK.INT8).toHaveLength(32)
      expect(MASK.INT16).toHaveLength(32)
      expect(MASK.INT32).toHaveLength(32)
      expect(MASK.INT64).toHaveLength(32)
      expect(MASK.INT128).toHaveLength(32)
      expect(MASK.INT256).toHaveLength(32)

      // INT256 should be all 0xff
      expect(Bytes.toHex(MASK.INT256)).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    })

    it('should have correct uint masks', () => {
      expect(MASK.UINT8).toHaveLength(32)
      expect(MASK.UINT16).toHaveLength(32)
      expect(MASK.UINT32).toHaveLength(32)
      expect(MASK.UINT64).toHaveLength(32)
      expect(MASK.UINT128).toHaveLength(32)
      expect(MASK.UINT256).toHaveLength(32)

      // UINT256 should be all 0xff
      expect(Bytes.toHex(MASK.UINT256)).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    })

    it('should have increasing mask sizes', () => {
      const masks = [MASK.BYTES1, MASK.BYTES2, MASK.BYTES4, MASK.BYTES8, MASK.BYTES16, MASK.BYTES32]
      const expectedLengths = [1, 2, 4, 8, 16, 32]

      masks.forEach((mask, index) => {
        // Count consecutive 0xff bytes from the right (since they're left-padded)
        const hex = Bytes.toHex(mask).slice(2) // Remove '0x'
        let nonZeroBytes = 0
        for (let i = hex.length - 2; i >= 0; i -= 2) {
          if (hex.slice(i, i + 2) === 'ff') {
            nonZeroBytes++
          } else {
            break
          }
        }
        expect(nonZeroBytes).toBe(expectedLengths[index])
      })
    })
  })

  describe('Permission Encoding', () => {
    describe('encodePermission', () => {
      it('should encode simple permission correctly', () => {
        const result = encodePermission(samplePermission)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBeGreaterThan(0)

        // Should start with target address (20 bytes)
        expect(Bytes.toHex(result.slice(0, 20))).toBe(testAddress.toLowerCase())

        // Followed by rules count (1 byte)
        expect(result[20]).toBe(1)
      })

      it('should encode complex permission with multiple rules', () => {
        const result = encodePermission(complexPermission)
        expect(result).toBeInstanceOf(Uint8Array)

        // Should start with target address
        expect(Bytes.toHex(result.slice(0, 20))).toBe(testAddress2.toLowerCase())

        // Should have 2 rules
        expect(result[20]).toBe(2)
      })

      it('should throw for too many rules', () => {
        const tooManyRules = Array(MAX_RULES_COUNT + 1).fill(sampleParameterRule)
        const invalidPermission: Permission = {
          target: testAddress,
          rules: tooManyRules,
        }

        expect(() => encodePermission(invalidPermission)).toThrow('Too many rules')
      })

      it('should handle permission with no rules', () => {
        const emptyPermission: Permission = {
          target: testAddress,
          rules: [],
        }

        const result = encodePermission(emptyPermission)
        expect(result[20]).toBe(0) // 0 rules
      })

      it('should handle different parameter operations', () => {
        const operations = [
          ParameterOperation.EQUAL,
          ParameterOperation.NOT_EQUAL,
          ParameterOperation.GREATER_THAN_OR_EQUAL,
          ParameterOperation.LESS_THAN_OR_EQUAL,
        ]

        operations.forEach((operation) => {
          const rule: ParameterRule = {
            ...sampleParameterRule,
            operation,
          }
          const permission: Permission = {
            target: testAddress,
            rules: [rule],
          }

          const result = encodePermission(permission)
          expect(result).toBeInstanceOf(Uint8Array)
        })
      })

      it('should handle cumulative vs non-cumulative rules', () => {
        const nonCumulativeRule: ParameterRule = {
          ...sampleParameterRule,
          cumulative: false,
        }
        const cumulativeRule: ParameterRule = {
          ...sampleParameterRule,
          cumulative: true,
        }

        const permission: Permission = {
          target: testAddress,
          rules: [nonCumulativeRule, cumulativeRule],
        }

        const result = encodePermission(permission)
        expect(result).toBeInstanceOf(Uint8Array)
      })
    })

    describe('encodeSessionPermissions', () => {
      it('should encode simple session permissions correctly', () => {
        const result = encodeSessionPermissions(sampleSessionPermissions)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBeGreaterThan(0)

        // Check structure: signer (20) + chainId (32) + valueLimit (32) + deadline (8) + count (1) + permissions
        expect(result.length).toBeGreaterThan(93) // Minimum size without permissions

        // Should start with signer address
        expect(Bytes.toHex(result.slice(0, 20))).toBe(testAddress.toLowerCase())

        // Should have 1 permission
        expect(result[92]).toBe(1)
      })

      it('should encode complex session permissions', () => {
        const result = encodeSessionPermissions(complexSessionPermissions)
        expect(result).toBeInstanceOf(Uint8Array)

        // Should start with signer address
        expect(Bytes.toHex(result.slice(0, 20))).toBe(testAddress2.toLowerCase())

        // Should have 2 permissions
        expect(result[92]).toBe(2)
      })

      it('should throw for too many permissions', () => {
        const tooManyPermissions = Array(MAX_PERMISSIONS_COUNT + 1).fill(samplePermission)
        const invalidSessionPermissions: SessionPermissions = {
          ...sampleSessionPermissions,
          permissions: tooManyPermissions as [Permission, ...Permission[]],
        }

        expect(() => encodeSessionPermissions(invalidSessionPermissions)).toThrow('Too many permissions')
      })

      it('should handle different chain IDs', () => {
        const chainIds = [1n, 137n, 42161n, 10n] // Mainnet, Polygon, Arbitrum, Optimism

        chainIds.forEach((chainId) => {
          const sessionPermissions: SessionPermissions = {
            ...sampleSessionPermissions,
            chainId,
          }

          const result = encodeSessionPermissions(sessionPermissions)
          expect(result).toBeInstanceOf(Uint8Array)
        })
      })

      it('should handle different value limits', () => {
        const valueLimits = [0n, 1000000000000000000n, 10000000000000000000n] // 0, 1 ETH, 10 ETH

        valueLimits.forEach((valueLimit) => {
          const sessionPermissions: SessionPermissions = {
            ...sampleSessionPermissions,
            valueLimit,
          }

          const result = encodeSessionPermissions(sessionPermissions)
          expect(result).toBeInstanceOf(Uint8Array)
        })
      })

      it('should handle different deadlines', () => {
        const deadlines = [0n, 1672531200n, 1893456000n] // Epoch, 2023, 2030

        deadlines.forEach((deadline) => {
          const sessionPermissions: SessionPermissions = {
            ...sampleSessionPermissions,
            deadline,
          }

          const result = encodeSessionPermissions(sessionPermissions)
          expect(result).toBeInstanceOf(Uint8Array)
        })
      })
    })
  })

  describe('Permission Decoding', () => {
    describe('decodeSessionPermissions', () => {
      it('should decode simple session permissions correctly', () => {
        const encoded = encodeSessionPermissions(sampleSessionPermissions)
        const decoded = decodeSessionPermissions(encoded)

        expect(decoded.signer).toBe(sampleSessionPermissions.signer)
        expect(decoded.chainId).toBe(sampleSessionPermissions.chainId)
        expect(decoded.valueLimit).toBe(sampleSessionPermissions.valueLimit)
        expect(decoded.deadline).toBe(sampleSessionPermissions.deadline)
        expect(decoded.permissions).toHaveLength(1)
        expect(decoded.permissions[0].target).toBe(samplePermission.target)
        expect(decoded.permissions[0].rules).toHaveLength(1)
      })

      it('should decode complex session permissions correctly', () => {
        const encoded = encodeSessionPermissions(complexSessionPermissions)
        const decoded = decodeSessionPermissions(encoded)

        expect(decoded.signer).toBe(complexSessionPermissions.signer)
        expect(decoded.chainId).toBe(complexSessionPermissions.chainId)
        expect(decoded.valueLimit).toBe(complexSessionPermissions.valueLimit)
        expect(decoded.deadline).toBe(complexSessionPermissions.deadline)
        expect(decoded.permissions).toHaveLength(2)
      })

      it('should handle round-trip encoding/decoding', () => {
        const testCases = [sampleSessionPermissions, complexSessionPermissions]

        testCases.forEach((original) => {
          const encoded = encodeSessionPermissions(original)
          const decoded = decodeSessionPermissions(encoded)

          expect(decoded.signer).toBe(original.signer)
          expect(decoded.chainId).toBe(original.chainId)
          expect(decoded.valueLimit).toBe(original.valueLimit)
          expect(decoded.deadline).toBe(original.deadline)
          expect(decoded.permissions).toHaveLength(original.permissions.length)

          decoded.permissions.forEach((permission, i) => {
            expect(permission.target).toBe(original.permissions[i].target)
            expect(permission.rules).toHaveLength(original.permissions[i].rules.length)

            permission.rules.forEach((rule, j) => {
              expect(rule.cumulative).toBe(original.permissions[i].rules[j].cumulative)
              expect(rule.operation).toBe(original.permissions[i].rules[j].operation)
              expect(Bytes.isEqual(rule.value, original.permissions[i].rules[j].value)).toBe(true)
              expect(rule.offset).toBe(original.permissions[i].rules[j].offset)
              expect(Bytes.isEqual(rule.mask, original.permissions[i].rules[j].mask)).toBe(true)
            })
          })
        })
      })

      it('should throw for empty permissions', () => {
        // Create invalid encoded data with 0 permissions
        const invalidEncoded = Bytes.concat(
          Bytes.padLeft(Bytes.fromHex(testAddress), 20),
          Bytes.padLeft(Bytes.fromNumber(testChainId), 32),
          Bytes.padLeft(Bytes.fromNumber(testValueLimit), 32),
          Bytes.padLeft(Bytes.fromNumber(testDeadline, { size: 8 }), 8),
          Bytes.fromNumber(0, { size: 1 }), // 0 permissions
        )

        expect(() => decodeSessionPermissions(invalidEncoded)).toThrow('No permissions')
      })

      it('should handle various parameter operations correctly', () => {
        const operations = [
          ParameterOperation.EQUAL,
          ParameterOperation.NOT_EQUAL,
          ParameterOperation.GREATER_THAN_OR_EQUAL,
          ParameterOperation.LESS_THAN_OR_EQUAL,
        ]

        operations.forEach((operation) => {
          const rule: ParameterRule = {
            ...sampleParameterRule,
            operation,
          }
          const permission: Permission = {
            target: testAddress,
            rules: [rule],
          }
          const sessionPermissions: SessionPermissions = {
            ...sampleSessionPermissions,
            permissions: [permission],
          }

          const encoded = encodeSessionPermissions(sessionPermissions)
          const decoded = decodeSessionPermissions(encoded)

          expect(decoded.permissions[0].rules[0].operation).toBe(operation)
        })
      })

      it('should handle cumulative flags correctly', () => {
        const cumulativeValues = [true, false]

        cumulativeValues.forEach((cumulative) => {
          const rule: ParameterRule = {
            ...sampleParameterRule,
            cumulative,
          }
          const permission: Permission = {
            target: testAddress,
            rules: [rule],
          }
          const sessionPermissions: SessionPermissions = {
            ...sampleSessionPermissions,
            permissions: [permission],
          }

          const encoded = encodeSessionPermissions(sessionPermissions)
          const decoded = decodeSessionPermissions(encoded)

          expect(decoded.permissions[0].rules[0].cumulative).toBe(cumulative)
        })
      })
    })
  })

  describe('ABI Encoding', () => {
    describe('permissionStructAbi', () => {
      it('should have correct ABI structure', () => {
        expect(permissionStructAbi.type).toBe('tuple')
        expect(permissionStructAbi.components).toHaveLength(2)
        expect(permissionStructAbi.components[0].name).toBe('target')
        expect(permissionStructAbi.components[0].type).toBe('address')
        expect(permissionStructAbi.components[1].name).toBe('rules')
        expect(permissionStructAbi.components[1].type).toBe('tuple[]')
      })

      it('should have correct rule ABI structure', () => {
        const rulesComponent = permissionStructAbi.components[1]
        expect(rulesComponent.components).toHaveLength(5)

        const expectedFields = [
          { name: 'cumulative', type: 'bool' },
          { name: 'operation', type: 'uint8' },
          { name: 'value', type: 'bytes32' },
          { name: 'offset', type: 'uint256' },
          { name: 'mask', type: 'bytes32' },
        ]

        expectedFields.forEach((expected, i) => {
          expect(rulesComponent.components[i].name).toBe(expected.name)
          expect(rulesComponent.components[i].type).toBe(expected.type)
        })
      })
    })

    describe('abiEncodePermission', () => {
      it('should encode simple permission', () => {
        const result = abiEncodePermission(samplePermission)
        expect(typeof result).toBe('string')
        expect(result.startsWith('0x')).toBe(true)
        expect(result.length).toBeGreaterThan(2) // More than just '0x'
      })

      it('should encode complex permission', () => {
        const result = abiEncodePermission(complexPermission)
        expect(typeof result).toBe('string')
        expect(result.startsWith('0x')).toBe(true)
        expect(result.length).toBeGreaterThan(2)
      })

      it('should handle permission with no rules', () => {
        const emptyPermission: Permission = {
          target: testAddress,
          rules: [],
        }

        const result = abiEncodePermission(emptyPermission)
        expect(typeof result).toBe('string')
        expect(result.startsWith('0x')).toBe(true)
      })

      it('should be deterministic', () => {
        const result1 = abiEncodePermission(samplePermission)
        const result2 = abiEncodePermission(samplePermission)
        expect(result1).toBe(result2)
      })

      it('should produce different results for different permissions', () => {
        const result1 = abiEncodePermission(samplePermission)
        const result2 = abiEncodePermission(complexPermission)
        expect(result1).not.toBe(result2)
      })
    })
  })

  describe('JSON Serialization', () => {
    describe('sessionPermissionsToJson', () => {
      it('should serialize simple session permissions', () => {
        const result = sessionPermissionsToJson(sampleSessionPermissions)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed.signer).toBe(sampleSessionPermissions.signer)
        expect(parsed.chainId).toBe(sampleSessionPermissions.chainId.toString())
        expect(parsed.valueLimit).toBe(sampleSessionPermissions.valueLimit.toString())
        expect(parsed.deadline).toBe(sampleSessionPermissions.deadline.toString())
        expect(parsed.permissions).toHaveLength(1)
      })

      it('should serialize complex session permissions', () => {
        const result = sessionPermissionsToJson(complexSessionPermissions)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed.signer).toBe(complexSessionPermissions.signer)
        expect(parsed.permissions).toHaveLength(2)
      })
    })

    describe('encodeSessionPermissionsForJson', () => {
      it('should create JSON-safe object', () => {
        const result = encodeSessionPermissionsForJson(sampleSessionPermissions)
        expect(typeof result).toBe('object')
        expect(typeof result.signer).toBe('string')
        expect(typeof result.chainId).toBe('string')
        expect(typeof result.valueLimit).toBe('string')
        expect(typeof result.deadline).toBe('string')
        expect(Array.isArray(result.permissions)).toBe(true)
      })
    })

    describe('permissionToJson', () => {
      it('should serialize permission', () => {
        const result = permissionToJson(samplePermission)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed.target).toBe(samplePermission.target)
        expect(parsed.rules).toHaveLength(1)
      })

      it('should handle complex permission', () => {
        const result = permissionToJson(complexPermission)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed.target).toBe(complexPermission.target)
        expect(parsed.rules).toHaveLength(2)
      })
    })

    describe('parameterRuleToJson', () => {
      it('should serialize parameter rule', () => {
        const result = parameterRuleToJson(sampleParameterRule)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(typeof parsed.cumulative).toBe('boolean')
        expect(typeof parsed.operation).toBe('number')
        expect(typeof parsed.value).toBe('string')
        expect(typeof parsed.offset).toBe('string')
        expect(typeof parsed.mask).toBe('string')
      })

      it('should handle cumulative rule', () => {
        const result = parameterRuleToJson(sampleParameterRuleCumulative)
        expect(typeof result).toBe('string')

        const parsed = JSON.parse(result)
        expect(parsed.cumulative).toBe(true)
        expect(parsed.operation).toBe(ParameterOperation.LESS_THAN_OR_EQUAL)
      })
    })
  })

  describe('JSON Deserialization', () => {
    describe('sessionPermissionsFromJson', () => {
      it('should deserialize simple session permissions', () => {
        const json = sessionPermissionsToJson(sampleSessionPermissions)
        const result = sessionPermissionsFromJson(json)

        expect(result.signer).toBe(sampleSessionPermissions.signer)
        expect(result.chainId).toBe(sampleSessionPermissions.chainId)
        expect(result.valueLimit).toBe(sampleSessionPermissions.valueLimit)
        expect(result.deadline).toBe(sampleSessionPermissions.deadline)
        expect(result.permissions).toHaveLength(1)
      })

      it('should handle round-trip JSON serialization', () => {
        const testCases = [sampleSessionPermissions, complexSessionPermissions]

        testCases.forEach((original) => {
          const json = sessionPermissionsToJson(original)
          const result = sessionPermissionsFromJson(json)

          expect(result.signer).toBe(original.signer)
          expect(result.chainId).toBe(original.chainId)
          expect(result.valueLimit).toBe(original.valueLimit)
          expect(result.deadline).toBe(original.deadline)
          expect(result.permissions).toHaveLength(original.permissions.length)
        })
      })
    })

    describe('sessionPermissionsFromParsed', () => {
      it('should handle parsed JSON object', () => {
        const encoded = encodeSessionPermissionsForJson(sampleSessionPermissions)
        const result = sessionPermissionsFromParsed(encoded)

        expect(result.signer).toBe(sampleSessionPermissions.signer)
        expect(result.chainId).toBe(sampleSessionPermissions.chainId)
        expect(result.valueLimit).toBe(sampleSessionPermissions.valueLimit)
        expect(result.deadline).toBe(sampleSessionPermissions.deadline)
      })
    })

    describe('permissionFromJson', () => {
      it('should deserialize permission', () => {
        const json = permissionToJson(samplePermission)
        const result = permissionFromJson(json)

        expect(result.target).toBe(samplePermission.target)
        expect(result.rules).toHaveLength(1)
        expect(result.rules[0].cumulative).toBe(sampleParameterRule.cumulative)
        expect(result.rules[0].operation).toBe(sampleParameterRule.operation)
        expect(result.rules[0].offset).toBe(sampleParameterRule.offset)
      })

      it('should handle round-trip permission serialization', () => {
        const testCases = [samplePermission, complexPermission]

        testCases.forEach((original) => {
          const json = permissionToJson(original)
          const result = permissionFromJson(json)

          expect(result.target).toBe(original.target)
          expect(result.rules).toHaveLength(original.rules.length)

          result.rules.forEach((rule, i) => {
            expect(rule.cumulative).toBe(original.rules[i].cumulative)
            expect(rule.operation).toBe(original.rules[i].operation)
            expect(rule.offset).toBe(original.rules[i].offset)
            expect(Bytes.isEqual(rule.value, original.rules[i].value)).toBe(true)
            expect(Bytes.isEqual(rule.mask, original.rules[i].mask)).toBe(true)
          })
        })
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero values correctly', () => {
      const zeroValueSessionPermissions: SessionPermissions = {
        signer: testAddress,
        chainId: 0n,
        valueLimit: 0n,
        deadline: 0n,
        permissions: [samplePermission],
      }

      const encoded = encodeSessionPermissions(zeroValueSessionPermissions)
      const decoded = decodeSessionPermissions(encoded)

      expect(decoded.chainId).toBe(0n)
      expect(decoded.valueLimit).toBe(0n)
      expect(decoded.deadline).toBe(0n)
    })

    it('should handle maximum values correctly', () => {
      const maxValueSessionPermissions: SessionPermissions = {
        signer: testAddress,
        chainId: 2n ** 256n - 1n,
        valueLimit: 2n ** 256n - 1n,
        deadline: 2n ** 64n - 1n,
        permissions: [samplePermission],
      }

      const encoded = encodeSessionPermissions(maxValueSessionPermissions)
      const decoded = decodeSessionPermissions(encoded)

      expect(decoded.chainId).toBe(2n ** 256n - 1n)
      expect(decoded.valueLimit).toBe(2n ** 256n - 1n)
      expect(decoded.deadline).toBe(2n ** 64n - 1n)
    })

    it('should handle different mask types', () => {
      const maskTypes = [MASK.SELECTOR, MASK.ADDRESS, MASK.BOOL, MASK.BYTES32, MASK.UINT256]

      maskTypes.forEach((mask) => {
        const rule: ParameterRule = {
          ...sampleParameterRule,
          mask,
        }
        const permission: Permission = {
          target: testAddress,
          rules: [rule],
        }

        const encoded = encodePermission(permission)
        expect(encoded).toBeInstanceOf(Uint8Array)
      })
    })

    it('should handle large offset values', () => {
      const largeOffsets = [0n, 4n, 36n, 100n, 1000n, 10000n]

      largeOffsets.forEach((offset) => {
        const rule: ParameterRule = {
          ...sampleParameterRule,
          offset,
        }
        const permission: Permission = {
          target: testAddress,
          rules: [rule],
        }

        const encoded = encodePermission(permission)
        expect(encoded).toBeInstanceOf(Uint8Array)
      })
    })

    it('should handle different value sizes', () => {
      const values = [
        Bytes.fromHex('0x00'),
        Bytes.fromHex('0x01'),
        Bytes.fromHex('0xffffffff'),
        Bytes.fromHex('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
      ]

      values.forEach((value) => {
        const rule: ParameterRule = {
          ...sampleParameterRule,
          value: Bytes.padLeft(value, 32), // Ensure 32 bytes
        }
        const permission: Permission = {
          target: testAddress,
          rules: [rule],
        }

        const encoded = encodePermission(permission)
        expect(encoded).toBeInstanceOf(Uint8Array)
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete workflow: create -> encode -> decode -> JSON -> decode', () => {
      // Create complex session permissions
      const original = complexSessionPermissions

      // Binary encoding/decoding
      const binaryEncoded = encodeSessionPermissions(original)
      const binaryDecoded = decodeSessionPermissions(binaryEncoded)

      // JSON serialization/deserialization
      const jsonString = sessionPermissionsToJson(binaryDecoded)
      const jsonDecoded = sessionPermissionsFromJson(jsonString)

      // ABI encoding (for individual permissions)
      const abiEncoded = abiEncodePermission(jsonDecoded.permissions[0])

      // Verify all data remains consistent
      expect(jsonDecoded.signer).toBe(original.signer)
      expect(jsonDecoded.chainId).toBe(original.chainId)
      expect(jsonDecoded.valueLimit).toBe(original.valueLimit)
      expect(jsonDecoded.deadline).toBe(original.deadline)
      expect(jsonDecoded.permissions).toHaveLength(original.permissions.length)
      expect(typeof abiEncoded).toBe('string')
      expect(abiEncoded.startsWith('0x')).toBe(true)
    })

    it('should maintain precision for large numbers', () => {
      const largeNumbers: SessionPermissions = {
        signer: testAddress,
        chainId: 999999999999999999n,
        valueLimit: 123456789012345678901234567890n,
        deadline: 18446744073709551615n, // Max uint64
        permissions: [samplePermission],
      }

      const json = sessionPermissionsToJson(largeNumbers)
      const decoded = sessionPermissionsFromJson(json)

      expect(decoded.chainId).toBe(largeNumbers.chainId)
      expect(decoded.valueLimit).toBe(largeNumbers.valueLimit)
      expect(decoded.deadline).toBe(largeNumbers.deadline)
    })
  })
})
