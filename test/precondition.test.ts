import { describe, expect, it } from 'vitest'

import {
  Precondition,
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
  AnyPrecondition,
  IntentPrecondition,
  isValidPreconditionType,
  createPrecondition,
  createIntentPrecondition,
} from '../src/precondition.js'

describe('Precondition', () => {
  // Test data
  const testAddress = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1'
  const testAddress2 = '0x8ba1f109551bd432803012645aac136c776056c0'
  const testTokenAddress = '0xa0b86a33e6f8b5f56e64c9e1a1b8c6a9cc4b9a9e'
  const testTokenId = 123n
  const testMinAmount = 1000000000000000000n // 1 ETH
  const testMaxAmount = 10000000000000000000n // 10 ETH
  const testChainId = 1n

  // Sample preconditions for each type
  const sampleNativeBalance: NativeBalancePrecondition = {
    type: 'native-balance',
    address: testAddress,
    min: testMinAmount,
    max: testMaxAmount,
  }

  const sampleErc20Balance: Erc20BalancePrecondition = {
    type: 'erc20-balance',
    address: testAddress,
    token: testTokenAddress,
    min: testMinAmount,
    max: testMaxAmount,
  }

  const sampleErc20Approval: Erc20ApprovalPrecondition = {
    type: 'erc20-approval',
    address: testAddress,
    token: testTokenAddress,
    operator: testAddress2,
    min: testMinAmount,
  }

  const sampleErc721Ownership: Erc721OwnershipPrecondition = {
    type: 'erc721-ownership',
    address: testAddress,
    token: testTokenAddress,
    tokenId: testTokenId,
    owned: true,
  }

  const sampleErc721Approval: Erc721ApprovalPrecondition = {
    type: 'erc721-approval',
    address: testAddress,
    token: testTokenAddress,
    tokenId: testTokenId,
    operator: testAddress2,
  }

  const sampleErc1155Balance: Erc1155BalancePrecondition = {
    type: 'erc1155-balance',
    address: testAddress,
    token: testTokenAddress,
    tokenId: testTokenId,
    min: 5n,
    max: 100n,
  }

  const sampleErc1155Approval: Erc1155ApprovalPrecondition = {
    type: 'erc1155-approval',
    address: testAddress,
    token: testTokenAddress,
    tokenId: testTokenId,
    operator: testAddress2,
    min: 10n,
  }

  describe('Type Validation', () => {
    describe('isValidPreconditionType', () => {
      it('should return true for valid precondition types', () => {
        const validTypes = [
          'native-balance',
          'erc20-balance',
          'erc20-approval',
          'erc721-ownership',
          'erc721-approval',
          'erc1155-balance',
          'erc1155-approval',
        ]

        validTypes.forEach((type) => {
          expect(isValidPreconditionType(type)).toBe(true)
        })
      })

      it('should return false for invalid precondition types', () => {
        const invalidTypes = [
          'invalid-type',
          'erc-20-balance', // Wrong format
          'native_balance', // Wrong separator
          'ERC20-BALANCE', // Wrong case
          'nft-ownership', // Non-existent type
          '', // Empty string
          'erc721', // Incomplete
          'approval', // Too generic
        ]

        invalidTypes.forEach((type) => {
          expect(isValidPreconditionType(type)).toBe(false)
        })
      })

      it('should handle edge cases', () => {
        expect(isValidPreconditionType(' native-balance ')).toBe(false) // With spaces
        expect(isValidPreconditionType('native-balance\n')).toBe(false) // With newline
        expect(isValidPreconditionType('native-balance\t')).toBe(false) // With tab
      })
    })
  })

  describe('Precondition Creation', () => {
    describe('createPrecondition', () => {
      it('should create native balance precondition', () => {
        const result = createPrecondition(sampleNativeBalance)
        expect(result).toEqual(sampleNativeBalance)
        expect(result.type).toBe('native-balance')
        expect(result.address).toBe(testAddress)
        expect(result.min).toBe(testMinAmount)
        expect(result.max).toBe(testMaxAmount)
      })

      it('should create erc20 balance precondition', () => {
        const result = createPrecondition(sampleErc20Balance)
        expect(result).toEqual(sampleErc20Balance)
        expect(result.type).toBe('erc20-balance')
        expect(result.address).toBe(testAddress)
        expect(result.token).toBe(testTokenAddress)
        expect(result.min).toBe(testMinAmount)
        expect(result.max).toBe(testMaxAmount)
      })

      it('should create erc20 approval precondition', () => {
        const result = createPrecondition(sampleErc20Approval)
        expect(result).toEqual(sampleErc20Approval)
        expect(result.type).toBe('erc20-approval')
        expect(result.address).toBe(testAddress)
        expect(result.token).toBe(testTokenAddress)
        expect(result.operator).toBe(testAddress2)
        expect(result.min).toBe(testMinAmount)
      })

      it('should create erc721 ownership precondition', () => {
        const result = createPrecondition(sampleErc721Ownership)
        expect(result).toEqual(sampleErc721Ownership)
        expect(result.type).toBe('erc721-ownership')
        expect(result.address).toBe(testAddress)
        expect(result.token).toBe(testTokenAddress)
        expect(result.tokenId).toBe(testTokenId)
        expect(result.owned).toBe(true)
      })

      it('should create erc721 approval precondition', () => {
        const result = createPrecondition(sampleErc721Approval)
        expect(result).toEqual(sampleErc721Approval)
        expect(result.type).toBe('erc721-approval')
        expect(result.address).toBe(testAddress)
        expect(result.token).toBe(testTokenAddress)
        expect(result.tokenId).toBe(testTokenId)
        expect(result.operator).toBe(testAddress2)
      })

      it('should create erc1155 balance precondition', () => {
        const result = createPrecondition(sampleErc1155Balance)
        expect(result).toEqual(sampleErc1155Balance)
        expect(result.type).toBe('erc1155-balance')
        expect(result.address).toBe(testAddress)
        expect(result.token).toBe(testTokenAddress)
        expect(result.tokenId).toBe(testTokenId)
        expect(result.min).toBe(5n)
        expect(result.max).toBe(100n)
      })

      it('should create erc1155 approval precondition', () => {
        const result = createPrecondition(sampleErc1155Approval)
        expect(result).toEqual(sampleErc1155Approval)
        expect(result.type).toBe('erc1155-approval')
        expect(result.address).toBe(testAddress)
        expect(result.token).toBe(testTokenAddress)
        expect(result.tokenId).toBe(testTokenId)
        expect(result.operator).toBe(testAddress2)
        expect(result.min).toBe(10n)
      })

      it('should handle preconditions without optional fields', () => {
        const minimalNativeBalance: NativeBalancePrecondition = {
          type: 'native-balance',
          address: testAddress,
        }
        const result = createPrecondition(minimalNativeBalance)
        expect(result).toEqual(minimalNativeBalance)
        expect(result.min).toBeUndefined()
        expect(result.max).toBeUndefined()
      })

      it('should handle erc721 ownership without owned flag', () => {
        const minimalErc721: Erc721OwnershipPrecondition = {
          type: 'erc721-ownership',
          address: testAddress,
          token: testTokenAddress,
          tokenId: testTokenId,
        }
        const result = createPrecondition(minimalErc721)
        expect(result).toEqual(minimalErc721)
        expect(result.owned).toBeUndefined()
      })

      it('should throw for null precondition', () => {
        expect(() => createPrecondition(null as any)).toThrow(
          "Invalid precondition object: missing or invalid 'type' property.",
        )
      })

      it('should throw for undefined precondition', () => {
        expect(() => createPrecondition(undefined as any)).toThrow(
          "Invalid precondition object: missing or invalid 'type' property.",
        )
      })

      it('should throw for precondition without type', () => {
        const invalidPrecondition = {
          address: testAddress,
          min: testMinAmount,
        } as any
        expect(() => createPrecondition(invalidPrecondition)).toThrow(
          "Invalid precondition object: missing or invalid 'type' property.",
        )
      })

      it('should throw for precondition with invalid type', () => {
        const invalidPrecondition = {
          type: 'invalid-type',
          address: testAddress,
        } as any
        expect(() => createPrecondition(invalidPrecondition)).toThrow(
          "Invalid precondition object: missing or invalid 'type' property.",
        )
      })

      it('should throw for precondition with non-string type', () => {
        const invalidPrecondition = {
          type: 123,
          address: testAddress,
        } as any
        expect(() => createPrecondition(invalidPrecondition)).toThrow(
          "Invalid precondition object: missing or invalid 'type' property.",
        )
      })

      it('should maintain object identity for valid preconditions', () => {
        const result = createPrecondition(sampleNativeBalance)
        expect(result).toBe(sampleNativeBalance) // Should return the same object
      })
    })
  })

  describe('Intent Precondition Creation', () => {
    describe('createIntentPrecondition', () => {
      it('should create intent precondition for native balance', () => {
        const result = createIntentPrecondition(sampleNativeBalance)
        expect(result.type).toBe('native-balance')
        expect(result.data).toEqual({
          address: testAddress,
          min: testMinAmount,
          max: testMaxAmount,
        })
        expect(result.chainId).toBeUndefined()
      })

      it('should create intent precondition with chain ID', () => {
        const result = createIntentPrecondition(sampleNativeBalance, testChainId)
        expect(result.type).toBe('native-balance')
        expect(result.data).toEqual({
          address: testAddress,
          min: testMinAmount,
          max: testMaxAmount,
        })
        expect(result.chainId).toBe(testChainId)
      })

      it('should create intent precondition for erc20 balance', () => {
        const result = createIntentPrecondition(sampleErc20Balance, testChainId)
        expect(result.type).toBe('erc20-balance')
        expect(result.data).toEqual({
          address: testAddress,
          token: testTokenAddress,
          min: testMinAmount,
          max: testMaxAmount,
        })
        expect(result.chainId).toBe(testChainId)
      })

      it('should create intent precondition for erc20 approval', () => {
        const result = createIntentPrecondition(sampleErc20Approval)
        expect(result.type).toBe('erc20-approval')
        expect(result.data).toEqual({
          address: testAddress,
          token: testTokenAddress,
          operator: testAddress2,
          min: testMinAmount,
        })
        expect(result.chainId).toBeUndefined()
      })

      it('should create intent precondition for erc721 ownership', () => {
        const result = createIntentPrecondition(sampleErc721Ownership, testChainId)
        expect(result.type).toBe('erc721-ownership')
        expect(result.data).toEqual({
          address: testAddress,
          token: testTokenAddress,
          tokenId: testTokenId,
          owned: true,
        })
        expect(result.chainId).toBe(testChainId)
      })

      it('should create intent precondition for erc721 approval', () => {
        const result = createIntentPrecondition(sampleErc721Approval)
        expect(result.type).toBe('erc721-approval')
        expect(result.data).toEqual({
          address: testAddress,
          token: testTokenAddress,
          tokenId: testTokenId,
          operator: testAddress2,
        })
        expect(result.chainId).toBeUndefined()
      })

      it('should create intent precondition for erc1155 balance', () => {
        const result = createIntentPrecondition(sampleErc1155Balance, testChainId)
        expect(result.type).toBe('erc1155-balance')
        expect(result.data).toEqual({
          address: testAddress,
          token: testTokenAddress,
          tokenId: testTokenId,
          min: 5n,
          max: 100n,
        })
        expect(result.chainId).toBe(testChainId)
      })

      it('should create intent precondition for erc1155 approval', () => {
        const result = createIntentPrecondition(sampleErc1155Approval)
        expect(result.type).toBe('erc1155-approval')
        expect(result.data).toEqual({
          address: testAddress,
          token: testTokenAddress,
          tokenId: testTokenId,
          operator: testAddress2,
          min: 10n,
        })
        expect(result.chainId).toBeUndefined()
      })

      it('should handle zero chain ID', () => {
        const result = createIntentPrecondition(sampleNativeBalance, 0n)
        expect(result.chainId).toBe(0n)
      })

      it('should exclude undefined chain ID from result', () => {
        const result = createIntentPrecondition(sampleNativeBalance, undefined)
        expect(result.chainId).toBeUndefined()
        expect('chainId' in result).toBe(false)
      })

      it('should throw for invalid precondition type', () => {
        const invalidPrecondition = {
          type: 'invalid-type',
          address: testAddress,
        } as any
        expect(() => createIntentPrecondition(invalidPrecondition)).toThrow('Invalid precondition type: invalid-type')
      })

      it('should handle minimal preconditions', () => {
        const minimalNativeBalance: NativeBalancePrecondition = {
          type: 'native-balance',
          address: testAddress,
        }
        const result = createIntentPrecondition(minimalNativeBalance, testChainId)
        expect(result.type).toBe('native-balance')
        expect(result.data).toEqual({ address: testAddress })
        expect(result.chainId).toBe(testChainId)
      })
    })
  })

  describe('Type Safety and Interface Compliance', () => {
    it('should properly type native balance precondition', () => {
      const precondition: NativeBalancePrecondition = sampleNativeBalance
      expect(precondition.type).toBe('native-balance')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.min).toBe('bigint')
      expect(typeof precondition.max).toBe('bigint')
    })

    it('should properly type erc20 balance precondition', () => {
      const precondition: Erc20BalancePrecondition = sampleErc20Balance
      expect(precondition.type).toBe('erc20-balance')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.token).toBe('string')
      expect(typeof precondition.min).toBe('bigint')
      expect(typeof precondition.max).toBe('bigint')
    })

    it('should properly type erc20 approval precondition', () => {
      const precondition: Erc20ApprovalPrecondition = sampleErc20Approval
      expect(precondition.type).toBe('erc20-approval')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.token).toBe('string')
      expect(typeof precondition.operator).toBe('string')
      expect(typeof precondition.min).toBe('bigint')
    })

    it('should properly type erc721 ownership precondition', () => {
      const precondition: Erc721OwnershipPrecondition = sampleErc721Ownership
      expect(precondition.type).toBe('erc721-ownership')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.token).toBe('string')
      expect(typeof precondition.tokenId).toBe('bigint')
      expect(typeof precondition.owned).toBe('boolean')
    })

    it('should properly type erc721 approval precondition', () => {
      const precondition: Erc721ApprovalPrecondition = sampleErc721Approval
      expect(precondition.type).toBe('erc721-approval')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.token).toBe('string')
      expect(typeof precondition.tokenId).toBe('bigint')
      expect(typeof precondition.operator).toBe('string')
    })

    it('should properly type erc1155 balance precondition', () => {
      const precondition: Erc1155BalancePrecondition = sampleErc1155Balance
      expect(precondition.type).toBe('erc1155-balance')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.token).toBe('string')
      expect(typeof precondition.tokenId).toBe('bigint')
      expect(typeof precondition.min).toBe('bigint')
      expect(typeof precondition.max).toBe('bigint')
    })

    it('should properly type erc1155 approval precondition', () => {
      const precondition: Erc1155ApprovalPrecondition = sampleErc1155Approval
      expect(precondition.type).toBe('erc1155-approval')
      expect(typeof precondition.address).toBe('string')
      expect(typeof precondition.token).toBe('string')
      expect(typeof precondition.tokenId).toBe('bigint')
      expect(typeof precondition.operator).toBe('string')
      expect(typeof precondition.min).toBe('bigint')
    })

    it('should work with AnyPrecondition union type', () => {
      const preconditions: AnyPrecondition[] = [
        sampleNativeBalance,
        sampleErc20Balance,
        sampleErc20Approval,
        sampleErc721Ownership,
        sampleErc721Approval,
        sampleErc1155Balance,
        sampleErc1155Approval,
      ]

      preconditions.forEach((precondition) => {
        expect(typeof precondition.type).toBe('string')
        expect(isValidPreconditionType(precondition.type)).toBe(true)
        expect(() => createPrecondition(precondition)).not.toThrow()
      })
    })
  })

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle zero values correctly', () => {
      const zeroValuePrecondition: NativeBalancePrecondition = {
        type: 'native-balance',
        address: testAddress,
        min: 0n,
        max: 0n,
      }
      const result = createPrecondition(zeroValuePrecondition)
      expect(result.min).toBe(0n)
      expect(result.max).toBe(0n)
    })

    it('should handle very large BigInt values', () => {
      const largeValuePrecondition: Erc20BalancePrecondition = {
        type: 'erc20-balance',
        address: testAddress,
        token: testTokenAddress,
        min: 2n ** 256n - 1n,
        max: 2n ** 256n - 1n,
      }
      const result = createPrecondition(largeValuePrecondition)
      expect(result.min).toBe(2n ** 256n - 1n)
      expect(result.max).toBe(2n ** 256n - 1n)
    })

    it('should handle zero token ID', () => {
      const zeroTokenIdPrecondition: Erc721OwnershipPrecondition = {
        type: 'erc721-ownership',
        address: testAddress,
        token: testTokenAddress,
        tokenId: 0n,
        owned: false,
      }
      const result = createPrecondition(zeroTokenIdPrecondition)
      expect(result.tokenId).toBe(0n)
      expect(result.owned).toBe(false)
    })

    it('should handle very large token ID', () => {
      const largeTokenIdPrecondition: Erc1155BalancePrecondition = {
        type: 'erc1155-balance',
        address: testAddress,
        token: testTokenAddress,
        tokenId: 2n ** 256n - 1n,
        min: 1n,
      }
      const result = createPrecondition(largeTokenIdPrecondition)
      expect(result.tokenId).toBe(2n ** 256n - 1n)
    })

    it('should handle same addresses for all fields', () => {
      const sameAddressPrecondition: Erc20ApprovalPrecondition = {
        type: 'erc20-approval',
        address: testAddress,
        token: testAddress,
        operator: testAddress,
        min: 1000n,
      }
      const result = createPrecondition(sameAddressPrecondition)
      expect(result.address).toBe(testAddress)
      expect(result.token).toBe(testAddress)
      expect(result.operator).toBe(testAddress)
    })

    it('should handle different chain IDs', () => {
      const chainIds = [0n, 1n, 137n, 42161n, 10n, 2n ** 64n - 1n]

      chainIds.forEach((chainId) => {
        const result = createIntentPrecondition(sampleNativeBalance, chainId)
        expect(result.chainId).toBe(chainId)
      })
    })
  })

  describe('Real-world Scenarios', () => {
    it('should create precondition for minimum ETH balance check', () => {
      const ethBalanceCheck: NativeBalancePrecondition = {
        type: 'native-balance',
        address: testAddress,
        min: 1000000000000000000n, // 1 ETH minimum
      }
      const result = createPrecondition(ethBalanceCheck)
      expect(result.min).toBe(1000000000000000000n)
      expect(result.max).toBeUndefined()
    })

    it('should create precondition for USDC balance range', () => {
      const usdcBalanceCheck: Erc20BalancePrecondition = {
        type: 'erc20-balance',
        address: testAddress,
        token: '0xa0b86a33e6f8b5f56e64c9e1a1b8c6a9cc4b9a9e', // Mock USDC
        min: 100000000n, // 100 USDC (6 decimals)
        max: 10000000000n, // 10,000 USDC
      }
      const result = createPrecondition(usdcBalanceCheck)
      expect(result.token).toBe('0xa0b86a33e6f8b5f56e64c9e1a1b8c6a9cc4b9a9e')
      expect(result.min).toBe(100000000n)
      expect(result.max).toBe(10000000000n)
    })

    it('should create precondition for NFT ownership verification', () => {
      const nftOwnershipCheck: Erc721OwnershipPrecondition = {
        type: 'erc721-ownership',
        address: testAddress,
        token: testTokenAddress,
        tokenId: 1337n,
        owned: true,
      }
      const result = createPrecondition(nftOwnershipCheck)
      expect(result.tokenId).toBe(1337n)
      expect(result.owned).toBe(true)
    })

    it('should create precondition for DEX approval check', () => {
      const dexApprovalCheck: Erc20ApprovalPrecondition = {
        type: 'erc20-approval',
        address: testAddress,
        token: testTokenAddress,
        operator: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
        min: 1000000000000000000000n, // 1000 tokens
      }
      const result = createPrecondition(dexApprovalCheck)
      expect(result.operator).toBe('0x7a250d5630b4cf539739df2c5dacb4c659f2488d')
      expect(result.min).toBe(1000000000000000000000n)
    })

    it('should create intent precondition for multi-chain scenario', () => {
      const polygonPrecondition = createIntentPrecondition(sampleNativeBalance, 137n)
      const arbitrumPrecondition = createIntentPrecondition(sampleErc20Balance, 42161n)

      expect(polygonPrecondition.chainId).toBe(137n)
      expect(arbitrumPrecondition.chainId).toBe(42161n)
    })
  })

  describe('Integration and Workflow Testing', () => {
    it('should handle complete precondition creation workflow', () => {
      // Create various preconditions
      const preconditions: AnyPrecondition[] = [
        sampleNativeBalance,
        sampleErc20Balance,
        sampleErc20Approval,
        sampleErc721Ownership,
        sampleErc721Approval,
        sampleErc1155Balance,
        sampleErc1155Approval,
      ]

      // Validate and create each precondition
      const createdPreconditions = preconditions.map((p) => createPrecondition(p))
      expect(createdPreconditions).toHaveLength(7)

      // Create intent preconditions with different chain IDs
      const intentPreconditions = createdPreconditions.map((p, index) => createIntentPrecondition(p, BigInt(index + 1)))
      expect(intentPreconditions).toHaveLength(7)

      // Verify all have correct chain IDs
      intentPreconditions.forEach((intent, index) => {
        expect(intent.chainId).toBe(BigInt(index + 1))
        expect(isValidPreconditionType(intent.type)).toBe(true)
      })
    })

    it('should maintain type safety throughout workflow', () => {
      const precondition = createPrecondition(sampleErc20Balance)
      const intent = createIntentPrecondition(precondition, testChainId)

      // Type should be preserved
      expect(intent.type).toBe('erc20-balance')

      // Data should exclude type but include all other fields
      expect(intent.data).toEqual({
        address: testAddress,
        token: testTokenAddress,
        min: testMinAmount,
        max: testMaxAmount,
      })

      // Chain ID should be added
      expect(intent.chainId).toBe(testChainId)
    })

    it('should handle array of mixed preconditions', () => {
      const mixedPreconditions: AnyPrecondition[] = [
        { type: 'native-balance', address: testAddress, min: 1n },
        { type: 'erc20-balance', address: testAddress, token: testTokenAddress },
        { type: 'erc721-ownership', address: testAddress, token: testTokenAddress, tokenId: 1n },
      ]

      const results = mixedPreconditions.map((p) => {
        const created = createPrecondition(p)
        return createIntentPrecondition(created, testChainId)
      })

      expect(results).toHaveLength(3)
      expect(results[0].type).toBe('native-balance')
      expect(results[1].type).toBe('erc20-balance')
      expect(results[2].type).toBe('erc721-ownership')

      results.forEach((result) => {
        expect(result.chainId).toBe(testChainId)
      })
    })
  })
})
