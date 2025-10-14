import { Address } from 'ox'
import { describe, expect, it } from 'vitest'

import {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
} from '../../src/preconditions/types.js'

// Test addresses
const TEST_ADDRESS = Address.from('0x1234567890123456789012345678901234567890')
const TOKEN_ADDRESS = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const OPERATOR_ADDRESS = Address.from('0x9876543210987654321098765432109876543210')

describe('Preconditions Types', () => {
  describe('NativeBalancePrecondition', () => {
    it('should create a valid native balance precondition', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, 1000000000000000000n, 2000000000000000000n)

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.min).toBe(1000000000000000000n)
      expect(precondition.max).toBe(2000000000000000000n)
      expect(precondition.type()).toBe('native-balance')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should create a precondition with only min value', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, 1000000000000000000n)

      expect(precondition.min).toBe(1000000000000000000n)
      expect(precondition.max).toBeUndefined()
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should create a precondition with only max value', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, undefined, 2000000000000000000n)

      expect(precondition.min).toBeUndefined()
      expect(precondition.max).toBe(2000000000000000000n)
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should create a precondition with no min/max values', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS)

      expect(precondition.min).toBeUndefined()
      expect(precondition.max).toBeUndefined()
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new NativeBalancePrecondition('' as Address.Address)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate min cannot be greater than max', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, 2000000000000000000n, 1000000000000000000n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('min balance cannot be greater than max balance')
    })

    it('should allow min equal to max', () => {
      const precondition = new NativeBalancePrecondition(TEST_ADDRESS, 1000000000000000000n, 1000000000000000000n)

      expect(precondition.isValid()).toBeUndefined()
    })
  })

  describe('Erc20BalancePrecondition', () => {
    it('should create a valid ERC20 balance precondition', () => {
      const precondition = new Erc20BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 1000000n, 2000000n)

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.min).toBe(1000000n)
      expect(precondition.max).toBe(2000000n)
      expect(precondition.type()).toBe('erc20-balance')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new Erc20BalancePrecondition('' as Address.Address, TOKEN_ADDRESS)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate token address is required', () => {
      const precondition = new Erc20BalancePrecondition(TEST_ADDRESS, '' as Address.Address)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('token address is required')
    })

    it('should validate min cannot be greater than max', () => {
      const precondition = new Erc20BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 2000000n, 1000000n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('min balance cannot be greater than max balance')
    })

    it('should create precondition with only min value', () => {
      const precondition = new Erc20BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 1000000n)

      expect(precondition.min).toBe(1000000n)
      expect(precondition.max).toBeUndefined()
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should create precondition with only max value', () => {
      const precondition = new Erc20BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, undefined, 2000000n)

      expect(precondition.min).toBeUndefined()
      expect(precondition.max).toBe(2000000n)
      expect(precondition.isValid()).toBeUndefined()
    })
  })

  describe('Erc20ApprovalPrecondition', () => {
    it('should create a valid ERC20 approval precondition', () => {
      const precondition = new Erc20ApprovalPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, OPERATOR_ADDRESS, 1000000n)

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.operator).toBe(OPERATOR_ADDRESS)
      expect(precondition.min).toBe(1000000n)
      expect(precondition.type()).toBe('erc20-approval')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new Erc20ApprovalPrecondition(
        '' as Address.Address,
        TOKEN_ADDRESS,
        OPERATOR_ADDRESS,
        1000000n,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate token address is required', () => {
      const precondition = new Erc20ApprovalPrecondition(
        TEST_ADDRESS,
        '' as Address.Address,
        OPERATOR_ADDRESS,
        1000000n,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('token address is required')
    })

    it('should validate operator address is required', () => {
      const precondition = new Erc20ApprovalPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, '' as Address.Address, 1000000n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('operator address is required')
    })

    it('should validate min approval amount is required', () => {
      const precondition = new Erc20ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        OPERATOR_ADDRESS,
        undefined as any,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('min approval amount is required')
    })
  })

  describe('Erc721OwnershipPrecondition', () => {
    it('should create a valid ERC721 ownership precondition', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, true)

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.owned).toBe(true)
      expect(precondition.type()).toBe('erc721-ownership')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should create precondition with default owned value', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n)

      expect(precondition.owned).toBeUndefined()
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new Erc721OwnershipPrecondition('' as Address.Address, TOKEN_ADDRESS, 123n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate token address is required', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, '' as Address.Address, 123n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('token address is required')
    })

    it('should validate tokenId is required', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, undefined as any)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('tokenId is required')
    })

    it('should handle tokenId of 0', () => {
      const precondition = new Erc721OwnershipPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 0n)

      expect(precondition.tokenId).toBe(0n)
      expect(precondition.isValid()).toBeUndefined()
    })
  })

  describe('Erc721ApprovalPrecondition', () => {
    it('should create a valid ERC721 approval precondition', () => {
      const precondition = new Erc721ApprovalPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, OPERATOR_ADDRESS)

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.operator).toBe(OPERATOR_ADDRESS)
      expect(precondition.type()).toBe('erc721-approval')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new Erc721ApprovalPrecondition('' as Address.Address, TOKEN_ADDRESS, 123n, OPERATOR_ADDRESS)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate token address is required', () => {
      const precondition = new Erc721ApprovalPrecondition(TEST_ADDRESS, '' as Address.Address, 123n, OPERATOR_ADDRESS)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('token address is required')
    })

    it('should validate tokenId is required', () => {
      const precondition = new Erc721ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        undefined as any,
        OPERATOR_ADDRESS,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('tokenId is required')
    })

    it('should validate operator address is required', () => {
      const precondition = new Erc721ApprovalPrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, '' as Address.Address)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('operator address is required')
    })
  })

  describe('Erc1155BalancePrecondition', () => {
    it('should create a valid ERC1155 balance precondition', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, 1000000n, 2000000n)

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.min).toBe(1000000n)
      expect(precondition.max).toBe(2000000n)
      expect(precondition.type()).toBe('erc1155-balance')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new Erc1155BalancePrecondition('' as Address.Address, TOKEN_ADDRESS, 123n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate token address is required', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, '' as Address.Address, 123n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('token address is required')
    })

    it('should validate tokenId is required', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, undefined as any)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('tokenId is required')
    })

    it('should validate min cannot be greater than max', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, 2000000n, 1000000n)

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('min balance cannot be greater than max balance')
    })

    it('should create precondition with only min value', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, 1000000n)

      expect(precondition.min).toBe(1000000n)
      expect(precondition.max).toBeUndefined()
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should create precondition with only max value', () => {
      const precondition = new Erc1155BalancePrecondition(TEST_ADDRESS, TOKEN_ADDRESS, 123n, undefined, 2000000n)

      expect(precondition.min).toBeUndefined()
      expect(precondition.max).toBe(2000000n)
      expect(precondition.isValid()).toBeUndefined()
    })
  })

  describe('Erc1155ApprovalPrecondition', () => {
    it('should create a valid ERC1155 approval precondition', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        123n,
        OPERATOR_ADDRESS,
        1000000n,
      )

      expect(precondition.address).toBe(TEST_ADDRESS)
      expect(precondition.token).toBe(TOKEN_ADDRESS)
      expect(precondition.tokenId).toBe(123n)
      expect(precondition.operator).toBe(OPERATOR_ADDRESS)
      expect(precondition.min).toBe(1000000n)
      expect(precondition.type()).toBe('erc1155-approval')
      expect(precondition.isValid()).toBeUndefined()
    })

    it('should validate address is required', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        '' as Address.Address,
        TOKEN_ADDRESS,
        123n,
        OPERATOR_ADDRESS,
        1000000n,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('address is required')
    })

    it('should validate token address is required', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        TEST_ADDRESS,
        '' as Address.Address,
        123n,
        OPERATOR_ADDRESS,
        1000000n,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('token address is required')
    })

    it('should validate tokenId is required', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        undefined as any,
        OPERATOR_ADDRESS,
        1000000n,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('tokenId is required')
    })

    it('should validate operator address is required', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        123n,
        '' as Address.Address,
        1000000n,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('operator address is required')
    })

    it('should validate min approval amount is required', () => {
      const precondition = new Erc1155ApprovalPrecondition(
        TEST_ADDRESS,
        TOKEN_ADDRESS,
        123n,
        OPERATOR_ADDRESS,
        undefined as any,
      )

      const error = precondition.isValid()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('min approval amount is required')
    })
  })
})
