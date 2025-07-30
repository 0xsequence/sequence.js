import { describe, expect, it } from 'vitest'
import { Bytes, Hash, Hex } from 'ox'

import { checksum, fromDeployConfiguration, isChecksummed } from '../src/address.js'
import { Context, Dev1, Dev2 } from '../src/context.js'
import { Config, hashConfiguration } from '../src/config.js'

describe('Address', () => {
  const mockContext: Omit<Context, 'stage2'> = {
    factory: checksum('0xe828630697817291140D6B7A42a2c3b7277bE45a'),
    stage1: checksum('0x2a4fB19F66F1427A5E363Bf1bB3be27b9A9ACC39'),
    creationCode: '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3',
  }

  const sampleConfig: Config = {
    threshold: 1n,
    checkpoint: 0n,
    topology: {
      type: 'signer',
      address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
      weight: 1n,
    },
  }

  describe('from', () => {
    it('should generate deterministic address from Config object', () => {
      const address = fromDeployConfiguration(sampleConfig, mockContext)

      // Should return a valid address
      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)

      // Should be deterministic - same inputs should produce same output
      const address2 = fromDeployConfiguration(sampleConfig, mockContext)
      expect(address).toBe(address2)
    })

    it('should generate deterministic address from bytes configuration', () => {
      const configHash = hashConfiguration(sampleConfig)
      const address = fromDeployConfiguration(configHash, mockContext)

      // Should return a valid address
      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)

      // Should produce same address as Config object
      const addressFromConfig = fromDeployConfiguration(sampleConfig, mockContext)
      expect(address).toBe(addressFromConfig)
    })

    it('should generate different addresses for different configurations', () => {
      const config1: Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: {
          type: 'signer',
          address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
          weight: 1n,
        },
      }

      const config2: Config = {
        threshold: 2n, // Different threshold
        checkpoint: 0n,
        topology: {
          type: 'signer',
          address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
          weight: 1n,
        },
      }

      const address1 = fromDeployConfiguration(config1, mockContext)
      const address2 = fromDeployConfiguration(config2, mockContext)

      expect(address1).not.toBe(address2)
    })

    it('should generate different addresses for different contexts', () => {
      const address1 = fromDeployConfiguration(sampleConfig, mockContext)
      const address2 = fromDeployConfiguration(sampleConfig, {
        factory: checksum('0xFE14B91dE3c5Ca74c4D24608EBcD4B2848aA6010'),
        stage1: checksum('0x300E98ae5bEA4A7291d62Eb0b9feD535E10095dD'),
        creationCode:
          '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
      })

      expect(address1).not.toBe(address2)
    })

    it('should work with Dev1 context', () => {
      const { stage2, ...dev1Context } = Dev1
      const address = fromDeployConfiguration(sampleConfig, dev1Context)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should work with Dev2 context', () => {
      const { stage2, ...dev2Context } = Dev2
      const address = fromDeployConfiguration(sampleConfig, dev2Context)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)

      // Should be different from Dev1
      const { stage2: _, ...dev1Context } = Dev1
      const dev1Address = fromDeployConfiguration(sampleConfig, dev1Context)
      expect(address).not.toBe(dev1Address)
    })

    it('should handle complex topology configurations', () => {
      const complexConfig: Config = {
        threshold: 2n,
        checkpoint: 42n,
        topology: [
          {
            type: 'signer',
            address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
            weight: 1n,
          },
          {
            type: 'signer',
            address: checksum('0x8ba1f109551bD432803012645aac136c776056C0'),
            weight: 1n,
          },
        ],
      }

      const address = fromDeployConfiguration(complexConfig, mockContext)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should handle nested topology configurations', () => {
      const nestedConfig: Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: {
          type: 'nested',
          weight: 1n,
          threshold: 1n,
          tree: {
            type: 'signer',
            address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
            weight: 1n,
          },
        },
      }

      const address = fromDeployConfiguration(nestedConfig, mockContext)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should handle sapient signer configurations', () => {
      const sapientConfig: Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: {
          type: 'sapient-signer',
          address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
          weight: 1n,
          imageHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        },
      }

      const address = fromDeployConfiguration(sapientConfig, mockContext)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should handle configurations with checkpointer', () => {
      const configWithCheckpointer: Config = {
        threshold: 1n,
        checkpoint: 100n,
        checkpointer: checksum('0x1234567890123456789012345678901234567890'),
        topology: {
          type: 'signer',
          address: checksum('0x742d35Cc6635C0532925a3b8D563A6b35B7f05f1'),
          weight: 1n,
        },
      }

      const address = fromDeployConfiguration(configWithCheckpointer, mockContext)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)

      // Should be different from config without checkpointer
      const configWithoutCheckpointer = { ...configWithCheckpointer }
      delete configWithoutCheckpointer.checkpointer
      const addressWithoutCheckpointer = fromDeployConfiguration(configWithoutCheckpointer, mockContext)
      expect(address).not.toBe(addressWithoutCheckpointer)
    })

    it('should handle zero hash input', () => {
      const zeroHash = new Uint8Array(32).fill(0)
      const address = fromDeployConfiguration(zeroHash, mockContext)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should handle maximum hash input', () => {
      const maxHash = new Uint8Array(32).fill(255)
      const address = fromDeployConfiguration(maxHash, mockContext)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should produce different addresses for different factory addresses', () => {
      const context1 = {
        ...mockContext,
        factory: checksum('0x1111111111111111111111111111111111111111'),
      }

      const context2 = {
        ...mockContext,
        factory: checksum('0x2222222222222222222222222222222222222222'),
      }

      const address1 = fromDeployConfiguration(sampleConfig, context1)
      const address2 = fromDeployConfiguration(sampleConfig, context2)

      expect(address1).not.toBe(address2)
    })

    it('should produce different addresses for different stage1 addresses', () => {
      const context1 = {
        ...mockContext,
        stage1: checksum('0x1111111111111111111111111111111111111111'),
      }

      const context2 = {
        ...mockContext,
        stage1: checksum('0x2222222222222222222222222222222222222222'),
      }

      const address1 = fromDeployConfiguration(sampleConfig, context1)
      const address2 = fromDeployConfiguration(sampleConfig, context2)

      expect(address1).not.toBe(address2)
    })

    it('should produce different addresses for different creation code', () => {
      const context1: typeof mockContext = { ...mockContext, creationCode: '0x1111' }
      const context2: typeof mockContext = { ...mockContext, creationCode: '0x2222' }

      const address1 = fromDeployConfiguration(sampleConfig, context1)
      const address2 = fromDeployConfiguration(sampleConfig, context2)

      expect(address1).not.toBe(address2)
    })

    it('should implement CREATE2 address generation correctly', () => {
      // This test verifies the CREATE2 formula: keccak256(0xff ++ factory ++ salt ++ keccak256(creationCode ++ stage1))[12:]
      const configHash = hashConfiguration(sampleConfig)

      // Manual computation to verify the algorithm
      const initCodeHash = Hash.keccak256(
        Bytes.concat(Bytes.from(mockContext.creationCode), Bytes.padLeft(Bytes.from(mockContext.stage1), 32)),
      )

      const addressHash = Hash.keccak256(
        Bytes.concat(Bytes.from('0xff'), Bytes.from(mockContext.factory), configHash, initCodeHash),
        { as: 'Bytes' },
      )

      const expectedAddress = checksum(Bytes.toHex(addressHash.subarray(12)))
      const actualAddress = fromDeployConfiguration(sampleConfig, mockContext)

      expect(actualAddress).toBe(expectedAddress)
    })

    it('should handle empty creation code', () => {
      const contextWithEmptyCode: typeof mockContext = { ...mockContext, creationCode: '0x' }

      const address = fromDeployConfiguration(sampleConfig, contextWithEmptyCode)

      expect(isChecksummed(address)).to.be.true
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should be consistent across multiple calls with same inputs', () => {
      const addresses = Array.from({ length: 10 }, () => fromDeployConfiguration(sampleConfig, mockContext))

      // All addresses should be identical
      addresses.forEach((address) => {
        expect(address).toBe(addresses[0])
      })
    })
  })
})
