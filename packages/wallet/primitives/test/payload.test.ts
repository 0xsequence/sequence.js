import { describe, expect, it, vi } from 'vitest'
import { Address, Bytes, Hash, Hex } from 'ox'
import { UserOperation } from 'ox/erc4337'

import {
  KIND_TRANSACTIONS,
  KIND_MESSAGE,
  KIND_CONFIG_UPDATE,
  KIND_DIGEST,
  BEHAVIOR_IGNORE_ERROR,
  BEHAVIOR_REVERT_ON_ERROR,
  BEHAVIOR_ABORT_ON_ERROR,
  Call,
  Calls,
  Message,
  ConfigUpdate,
  Digest,
  SessionImplicitAuthorize,
  Calls4337_07,
  Recovery,
  MayRecoveryPayload,
  Payload,
  Parented,
  TypedDataToSign,
  SolidityDecoded,
  fromMessage,
  fromConfigUpdate,
  fromDigest,
  fromCall,
  isCalls,
  isMessage,
  isConfigUpdate,
  isDigest,
  isRecovery,
  isCalls4337_07,
  toRecovery,
  isSessionImplicitAuthorize,
  encode,
  encodeSapient,
  hash,
  encode4337Nonce,
  toTyped,
  to4337UserOperation,
  to4337Message,
  encodeBehaviorOnError,
  hashCall,
  decode,
  decodeBehaviorOnError,
  fromAbiFormat,
  toAbiFormat,
} from '../src/payload.js'
import * as Attestation from '../src/attestation.js'

describe('Payload', () => {
  // Test data
  const testAddress = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1'
  const testAddress2 = '0x8ba1f109551bd432803012645aac136c776056c0'
  const testChainId = 1n
  const testImageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testDigest = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
  const testMessage = '0x48656c6c6f20576f726c64' // "Hello World" in hex

  const sampleCall: Call = {
    to: testAddress,
    value: 1000n,
    data: '0x1234567890abcdef',
    gasLimit: 21000n,
    delegateCall: false,
    onlyFallback: false,
    behaviorOnError: 'revert',
  }

  const sampleCalls: Calls = {
    type: 'call',
    space: 0n,
    nonce: 1n,
    calls: [sampleCall],
  }

  const sampleMessage: Message = {
    type: 'message',
    message: testMessage,
  }

  const sampleConfigUpdate: ConfigUpdate = {
    type: 'config-update',
    imageHash: testImageHash,
  }

  const sampleDigest: Digest = {
    type: 'digest',
    digest: testDigest,
  }

  const sampleAttestation: Attestation.Attestation = {
    approvedSigner: testAddress,
    identityType: Bytes.fromHex('0x00000001'),
    issuerHash: Bytes.fromHex('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    audienceHash: Bytes.fromHex('0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef'),
    applicationData: Bytes.fromString('test application data'),
    authData: {
      redirectUrl: 'https://example.com/callback',
      issuedAt: 123456789n,
    },
  }

  const sampleSessionImplicitAuthorize: SessionImplicitAuthorize = {
    type: 'session-implicit-authorize',
    sessionAddress: testAddress,
    attestation: sampleAttestation,
  }

  const sampleCalls4337: Calls4337_07 = {
    type: 'call_4337_07',
    calls: [sampleCall],
    entrypoint: testAddress2,
    callGasLimit: 100000n,
    maxFeePerGas: 20000000000n,
    maxPriorityFeePerGas: 1000000000n,
    space: 0n,
    nonce: 1n,
    preVerificationGas: 21000n,
    verificationGasLimit: 100000n,
  }

  describe('Constants', () => {
    it('should have correct kind constants', () => {
      expect(KIND_TRANSACTIONS).toBe(0x00)
      expect(KIND_MESSAGE).toBe(0x01)
      expect(KIND_CONFIG_UPDATE).toBe(0x02)
      expect(KIND_DIGEST).toBe(0x03)
    })

    it('should have correct behavior constants', () => {
      expect(BEHAVIOR_IGNORE_ERROR).toBe(0x00)
      expect(BEHAVIOR_REVERT_ON_ERROR).toBe(0x01)
      expect(BEHAVIOR_ABORT_ON_ERROR).toBe(0x02)
    })
  })

  describe('Factory Functions', () => {
    describe('fromMessage', () => {
      it('should create message payload', () => {
        const result = fromMessage(testMessage)
        expect(result).toEqual({
          type: 'message',
          message: testMessage,
        })
      })
    })

    describe('fromConfigUpdate', () => {
      it('should create config update payload', () => {
        const result = fromConfigUpdate(testImageHash)
        expect(result).toEqual({
          type: 'config-update',
          imageHash: testImageHash,
        })
      })
    })

    describe('fromDigest', () => {
      it('should create digest payload', () => {
        const result = fromDigest(testDigest)
        expect(result).toEqual({
          type: 'digest',
          digest: testDigest,
        })
      })
    })

    describe('fromCall', () => {
      it('should create calls payload', () => {
        const result = fromCall(1n, 0n, [sampleCall])
        expect(result).toEqual({
          type: 'call',
          nonce: 1n,
          space: 0n,
          calls: [sampleCall],
        })
      })
    })
  })

  describe('Type Guards', () => {
    describe('isCalls', () => {
      it('should return true for calls payload', () => {
        expect(isCalls(sampleCalls)).toBe(true)
      })

      it('should return false for non-calls payload', () => {
        expect(isCalls(sampleMessage)).toBe(false)
        expect(isCalls(sampleConfigUpdate)).toBe(false)
        expect(isCalls(sampleDigest)).toBe(false)
      })
    })

    describe('isMessage', () => {
      it('should return true for message payload', () => {
        expect(isMessage(sampleMessage)).toBe(true)
      })

      it('should return false for non-message payload', () => {
        expect(isMessage(sampleCalls)).toBe(false)
        expect(isMessage(sampleConfigUpdate)).toBe(false)
        expect(isMessage(sampleDigest)).toBe(false)
      })
    })

    describe('isConfigUpdate', () => {
      it('should return true for config update payload', () => {
        expect(isConfigUpdate(sampleConfigUpdate)).toBe(true)
      })

      it('should return false for non-config update payload', () => {
        expect(isConfigUpdate(sampleCalls)).toBe(false)
        expect(isConfigUpdate(sampleMessage)).toBe(false)
        expect(isConfigUpdate(sampleDigest)).toBe(false)
      })
    })

    describe('isDigest', () => {
      it('should return true for digest payload', () => {
        expect(isDigest(sampleDigest)).toBe(true)
      })

      it('should return false for non-digest payload', () => {
        expect(isDigest(sampleCalls)).toBe(false)
        expect(isDigest(sampleMessage)).toBe(false)
        expect(isDigest(sampleConfigUpdate)).toBe(false)
      })
    })

    describe('isRecovery', () => {
      it('should return true for recovery payload', () => {
        const recoveryPayload = toRecovery(sampleCalls)
        expect(isRecovery(recoveryPayload)).toBe(true)
      })

      it('should return false for non-recovery payload', () => {
        expect(isRecovery(sampleCalls)).toBe(false)
        expect(isRecovery(sampleMessage)).toBe(false)
      })

      it('should return false for session implicit authorize', () => {
        expect(isRecovery(sampleSessionImplicitAuthorize)).toBe(false)
      })
    })

    describe('isCalls4337_07', () => {
      it('should return true for calls 4337 payload', () => {
        expect(isCalls4337_07(sampleCalls4337)).toBe(true)
      })

      it('should return false for non-calls 4337 payload', () => {
        expect(isCalls4337_07(sampleCalls)).toBe(false)
        expect(isCalls4337_07(sampleMessage)).toBe(false)
      })
    })

    describe('isSessionImplicitAuthorize', () => {
      it('should return true for session implicit authorize payload', () => {
        expect(isSessionImplicitAuthorize(sampleSessionImplicitAuthorize)).toBe(true)
      })

      it('should return false for non-session implicit authorize payload', () => {
        expect(isSessionImplicitAuthorize(sampleCalls)).toBe(false)
        expect(isSessionImplicitAuthorize(sampleMessage)).toBe(false)
      })
    })
  })

  describe('toRecovery', () => {
    it('should add recovery flag to payload', () => {
      const result = toRecovery(sampleCalls)
      expect(result).toEqual({
        ...sampleCalls,
        recovery: true,
      })
    })

    it('should return same payload if already recovery', () => {
      const recoveryPayload = toRecovery(sampleCalls)
      const result = toRecovery(recoveryPayload)
      expect(result).toBe(recoveryPayload)
    })
  })

  describe('Behavior Encoding/Decoding', () => {
    describe('encodeBehaviorOnError', () => {
      it('should encode ignore behavior', () => {
        expect(encodeBehaviorOnError('ignore')).toBe(BEHAVIOR_IGNORE_ERROR)
      })

      it('should encode revert behavior', () => {
        expect(encodeBehaviorOnError('revert')).toBe(BEHAVIOR_REVERT_ON_ERROR)
      })

      it('should encode abort behavior', () => {
        expect(encodeBehaviorOnError('abort')).toBe(BEHAVIOR_ABORT_ON_ERROR)
      })
    })

    describe('decodeBehaviorOnError', () => {
      it('should decode ignore behavior', () => {
        expect(decodeBehaviorOnError(0)).toBe('ignore')
      })

      it('should decode revert behavior', () => {
        expect(decodeBehaviorOnError(1)).toBe('revert')
      })

      it('should decode abort behavior', () => {
        expect(decodeBehaviorOnError(2)).toBe('abort')
      })

      it('should throw for invalid behavior', () => {
        expect(() => decodeBehaviorOnError(3)).toThrow('Invalid behaviorOnError value: 3')
      })
    })
  })

  describe('encode4337Nonce', () => {
    it('should encode nonce correctly', () => {
      const key = 123n
      const seq = 456n
      const result = encode4337Nonce(key, seq)
      expect(result).toBe((key << 64n) | seq)
    })

    it('should handle zero values', () => {
      expect(encode4337Nonce(0n, 0n)).toBe(0n)
      expect(encode4337Nonce(0n, 123n)).toBe(123n)
      expect(encode4337Nonce(123n, 0n)).toBe(123n << 64n)
    })

    it('should throw for key exceeding 192 bits', () => {
      const maxKey = 6277101735386680763835789423207666416102355444464034512895n
      const tooBigKey = maxKey + 1n
      expect(() => encode4337Nonce(tooBigKey, 0n)).toThrow('key exceeds 192 bits')
    })

    it('should throw for seq exceeding 64 bits', () => {
      const maxSeq = 18446744073709551615n
      const tooBigSeq = maxSeq + 1n
      expect(() => encode4337Nonce(0n, tooBigSeq)).toThrow('seq exceeds 64 bits')
    })
  })

  describe('Call Hashing', () => {
    describe('hashCall', () => {
      it('should hash call correctly', () => {
        const result = hashCall(sampleCall)
        expect(typeof result).toBe('string')
        expect(result.startsWith('0x')).toBe(true)
        expect(Hex.size(result)).toBe(32)
      })

      it('should be deterministic', () => {
        const result1 = hashCall(sampleCall)
        const result2 = hashCall(sampleCall)
        expect(result1).toBe(result2)
      })

      it('should produce different hashes for different calls', () => {
        const call2: Call = {
          ...sampleCall,
          to: testAddress2,
        }
        const hash1 = hashCall(sampleCall)
        const hash2 = hashCall(call2)
        expect(hash1).not.toBe(hash2)
      })

      it('should handle different behavior on error values', () => {
        const calls = ['ignore', 'revert', 'abort'].map((behavior) => ({
          ...sampleCall,
          behaviorOnError: behavior as Call['behaviorOnError'],
        }))

        const hashes = calls.map((call) => hashCall(call))
        // All hashes should be different
        expect(new Set(hashes).size).toBe(3)
      })
    })
  })

  describe('Payload Hashing', () => {
    describe('hash', () => {
      it('should hash calls payload', () => {
        const result = hash(testAddress, testChainId, sampleCalls)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(Bytes.size(result)).toBe(32)
      })

      it('should hash message payload', () => {
        const result = hash(testAddress, testChainId, sampleMessage)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(Bytes.size(result)).toBe(32)
      })

      it('should hash config update payload', () => {
        const result = hash(testAddress, testChainId, sampleConfigUpdate)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(Bytes.size(result)).toBe(32)
      })

      it('should return digest directly for digest payload', () => {
        const result = hash(testAddress, testChainId, sampleDigest)
        expect(result).toEqual(Bytes.fromHex(testDigest))
      })

      it.skip('should hash session implicit authorize payload using attestation', () => {
        const result = hash(testAddress, testChainId, sampleSessionImplicitAuthorize)
        const expectedHash = Attestation.hash(sampleAttestation)
        expect(result).toEqual(expectedHash)
      })

      it('should produce different hashes for different wallets', () => {
        const hash1 = hash(testAddress, testChainId, sampleCalls)
        const hash2 = hash(testAddress2, testChainId, sampleCalls)
        expect(hash1).not.toEqual(hash2)
      })

      it('should produce different hashes for different chain IDs', () => {
        const hash1 = hash(testAddress, 1n, sampleCalls)
        const hash2 = hash(testAddress, 137n, sampleCalls)
        expect(hash1).not.toEqual(hash2)
      })
    })
  })

  describe('Typed Data Generation', () => {
    describe('toTyped', () => {
      it('should generate typed data for calls payload', () => {
        const result = toTyped(testAddress, testChainId, sampleCalls)

        expect(result.domain.name).toBe('Sequence Wallet')
        expect(result.domain.version).toBe('3')
        expect(result.domain.chainId).toBe(Number(testChainId))
        expect(result.domain.verifyingContract).toBe(testAddress)
        expect(result.primaryType).toBe('Calls')
        expect(result.types.Calls).toBeDefined()
        expect(result.types.Call).toBeDefined()
      })

      it('should generate typed data for message payload', () => {
        const result = toTyped(testAddress, testChainId, sampleMessage)

        expect(result.primaryType).toBe('Message')
        expect(result.types.Message).toBeDefined()
        expect(result.message.message).toBe(testMessage)
      })

      it('should generate typed data for config update payload', () => {
        const result = toTyped(testAddress, testChainId, sampleConfigUpdate)

        expect(result.primaryType).toBe('ConfigUpdate')
        expect(result.types.ConfigUpdate).toBeDefined()
        expect(result.message.imageHash).toBe(testImageHash)
      })

      it('should use recovery domain for recovery payload', () => {
        const recoveryPayload = toRecovery(sampleCalls)
        const result = toTyped(testAddress, testChainId, recoveryPayload)

        expect(result.domain.name).toBe('Sequence Wallet - Recovery Mode')
        expect(result.domain.version).toBe('1')
      })

      it('should throw for digest payload', () => {
        expect(() => toTyped(testAddress, testChainId, sampleDigest)).toThrow(
          'Digest does not support typed data - Use message instead',
        )
      })

      it('should throw for session implicit authorize payload', () => {
        expect(() => toTyped(testAddress, testChainId, sampleSessionImplicitAuthorize)).toThrow(
          'Payload does not support typed data',
        )
      })

      it('should handle calls 4337 payload', () => {
        const result = toTyped(testAddress, testChainId, sampleCalls4337)

        expect(result.primaryType).toBe('Message')
        expect(result.types.Message).toBeDefined()
      })

      it('should include parent wallets in message', () => {
        const parentedPayload: Parented = {
          ...sampleCalls,
          parentWallets: [testAddress, testAddress2],
        }

        const result = toTyped(testAddress, testChainId, parentedPayload)
        expect(result.message.wallets).toEqual([testAddress, testAddress2])
      })
    })
  })

  describe('4337 UserOperation', () => {
    describe('to4337UserOperation', () => {
      it('should create user operation without signature', () => {
        const result = to4337UserOperation(sampleCalls4337, testAddress)

        expect(result.sender).toBe(testAddress)
        expect(result.nonce).toBe(encode4337Nonce(sampleCalls4337.space, sampleCalls4337.nonce))
        expect(result.callGasLimit).toBe(sampleCalls4337.callGasLimit)
        expect(result.maxFeePerGas).toBe(sampleCalls4337.maxFeePerGas)
        expect(result.maxPriorityFeePerGas).toBe(sampleCalls4337.maxPriorityFeePerGas)
        expect(result.preVerificationGas).toBe(sampleCalls4337.preVerificationGas)
        expect(result.verificationGasLimit).toBe(sampleCalls4337.verificationGasLimit)
        expect(result.signature).toBeUndefined()
      })

      it('should create user operation with signature', () => {
        const signature = '0x1234567890abcdef'
        const result = to4337UserOperation(sampleCalls4337, testAddress, signature)
        expect(result.signature).toBe(signature)
      })

      it('should handle optional fields', () => {
        const payloadWithOptionals: Calls4337_07 = {
          ...sampleCalls4337,
          factory: testAddress2,
          factoryData: '0xfactory',
          paymaster: testAddress,
          paymasterData: '0xpaymaster',
          paymasterPostOpGasLimit: 50000n,
          paymasterVerificationGasLimit: 30000n,
        }

        const result = to4337UserOperation(payloadWithOptionals, testAddress)
        expect(result.factory).toBe(testAddress2)
        expect(result.factoryData).toBe('0xfactory')
        expect(result.paymaster).toBe(testAddress)
        expect(result.paymasterData).toBe('0xpaymaster')
        expect(result.paymasterPostOpGasLimit).toBe(50000n)
        expect(result.paymasterVerificationGasLimit).toBe(30000n)
      })
    })

    describe('to4337Message', () => {
      it('should create 4337 message', () => {
        const result = to4337Message(sampleCalls4337, testAddress, testChainId)

        expect(typeof result).toBe('string')
        expect(result.startsWith('0x')).toBe(true)
        expect(Hex.size(result)).toBeGreaterThan(0)
      })

      it('should be deterministic', () => {
        const result1 = to4337Message(sampleCalls4337, testAddress, testChainId)
        const result2 = to4337Message(sampleCalls4337, testAddress, testChainId)
        expect(result1).toBe(result2)
      })

      it('should produce different results for different inputs', () => {
        const result1 = to4337Message(sampleCalls4337, testAddress, testChainId)
        const result2 = to4337Message(sampleCalls4337, testAddress2, testChainId)
        const result3 = to4337Message(sampleCalls4337, testAddress, 137n)

        expect(result1).not.toBe(result2)
        expect(result1).not.toBe(result3)
        expect(result2).not.toBe(result3)
      })
    })
  })

  describe('Sapient Encoding', () => {
    describe('encodeSapient', () => {
      it('should encode calls payload', () => {
        const result = encodeSapient(testChainId, sampleCalls)

        expect(result.kind).toBe(0)
        expect(result.noChainId).toBe(false)
        expect(result.calls).toHaveLength(1)
        expect(result.calls[0]).toEqual({
          ...sampleCall,
          behaviorOnError: BigInt(encodeBehaviorOnError(sampleCall.behaviorOnError)),
        })
        expect(result.space).toBe(sampleCalls.space)
        expect(result.nonce).toBe(sampleCalls.nonce)
      })

      it('should encode message payload', () => {
        const result = encodeSapient(testChainId, sampleMessage)

        expect(result.kind).toBe(1)
        expect(result.message).toBe(testMessage)
      })

      it('should encode config update payload', () => {
        const result = encodeSapient(testChainId, sampleConfigUpdate)

        expect(result.kind).toBe(2)
        expect(result.imageHash).toBe(testImageHash)
      })

      it('should encode digest payload', () => {
        const result = encodeSapient(testChainId, sampleDigest)

        expect(result.kind).toBe(3)
        expect(result.digest).toBe(testDigest)
      })

      it('should handle zero chain ID', () => {
        const result = encodeSapient(0n, sampleCalls)
        expect(result.noChainId).toBe(true)
      })

      it('should include parent wallets', () => {
        const parentedPayload: Parented = {
          ...sampleCalls,
          parentWallets: [testAddress, testAddress2],
        }

        const result = encodeSapient(testChainId, parentedPayload)
        expect(result.parentWallets).toEqual([testAddress, testAddress2])
      })
    })
  })

  describe('ABI Format Conversion', () => {
    describe('toAbiFormat', () => {
      it('should convert calls payload to ABI format', () => {
        const result = toAbiFormat(sampleCalls)

        expect(result.kind).toBe(KIND_TRANSACTIONS)
        expect(result.noChainId).toBe(false)
        expect(result.calls).toHaveLength(1)
        expect(result.calls[0].behaviorOnError).toBe(BigInt(encodeBehaviorOnError(sampleCall.behaviorOnError)))
        expect(result.space).toBe(sampleCalls.space)
        expect(result.nonce).toBe(sampleCalls.nonce)
      })

      it('should convert message payload to ABI format', () => {
        const result = toAbiFormat(sampleMessage)

        expect(result.kind).toBe(KIND_MESSAGE)
        expect(result.message).toBe(testMessage)
      })

      it('should convert config update payload to ABI format', () => {
        const result = toAbiFormat(sampleConfigUpdate)

        expect(result.kind).toBe(KIND_CONFIG_UPDATE)
        expect(result.imageHash).toBe(testImageHash)
      })

      it('should convert digest payload to ABI format', () => {
        const result = toAbiFormat(sampleDigest)

        expect(result.kind).toBe(KIND_DIGEST)
        expect(result.digest).toBe(testDigest)
      })

      it('should throw for invalid payload type', () => {
        const invalidPayload = { type: 'invalid' } as any
        expect(() => toAbiFormat(invalidPayload)).toThrow('Invalid payload type')
      })
    })

    describe('fromAbiFormat', () => {
      it('should convert calls from ABI format', () => {
        const abiFormat: SolidityDecoded = {
          kind: KIND_TRANSACTIONS,
          noChainId: false,
          calls: [
            {
              to: sampleCall.to,
              value: sampleCall.value,
              data: sampleCall.data,
              gasLimit: sampleCall.gasLimit,
              delegateCall: sampleCall.delegateCall,
              onlyFallback: sampleCall.onlyFallback,
              behaviorOnError: BigInt(encodeBehaviorOnError(sampleCall.behaviorOnError)),
            },
          ],
          space: sampleCalls.space,
          nonce: sampleCalls.nonce,
          message: '0x',
          imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
          parentWallets: [testAddress, testAddress2],
        }

        const result = fromAbiFormat(abiFormat)

        expect(result.type).toBe('call')
        expect((result as Calls).calls).toHaveLength(1)
        expect((result as Calls).calls[0]).toEqual(sampleCall)
        expect(result.parentWallets).toEqual([testAddress, testAddress2])
      })

      it('should convert message from ABI format', () => {
        const abiFormat: SolidityDecoded = {
          kind: KIND_MESSAGE,
          noChainId: false,
          calls: [],
          space: 0n,
          nonce: 0n,
          message: testMessage,
          imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
          parentWallets: [],
        }

        const result = fromAbiFormat(abiFormat)

        expect(result.type).toBe('message')
        expect((result as Message).message).toBe(testMessage)
      })

      it('should convert config update from ABI format', () => {
        const abiFormat: SolidityDecoded = {
          kind: KIND_CONFIG_UPDATE,
          noChainId: false,
          calls: [],
          space: 0n,
          nonce: 0n,
          message: '0x',
          imageHash: testImageHash,
          digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
          parentWallets: [],
        }

        const result = fromAbiFormat(abiFormat)

        expect(result.type).toBe('config-update')
        expect((result as ConfigUpdate).imageHash).toBe(testImageHash)
      })

      it('should convert digest from ABI format', () => {
        const abiFormat: SolidityDecoded = {
          kind: KIND_DIGEST,
          noChainId: false,
          calls: [],
          space: 0n,
          nonce: 0n,
          message: '0x',
          imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          digest: testDigest,
          parentWallets: [],
        }

        const result = fromAbiFormat(abiFormat)

        expect(result.type).toBe('digest')
        expect((result as Digest).digest).toBe(testDigest)
      })

      it('should throw for invalid kind', () => {
        const invalidAbi: SolidityDecoded = {
          kind: 999,
          noChainId: false,
          calls: [],
          space: 0n,
          nonce: 0n,
          message: '0x',
          imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
          parentWallets: [],
        }

        expect(() => fromAbiFormat(invalidAbi)).toThrow('Not implemented')
      })
    })
  })

  describe('Payload Encoding and Decoding', () => {
    describe('encode', () => {
      it('should encode simple calls payload', () => {
        const result = encode(sampleCalls)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBeGreaterThan(0)
      })

      it('should encode calls with zero space', () => {
        const callsWithZeroSpace: Calls = {
          ...sampleCalls,
          space: 0n,
        }
        const result = encode(callsWithZeroSpace)
        expect(result).toBeInstanceOf(Uint8Array)

        // First byte should have space zero flag set (bit 0)
        expect(result[0] & 0x01).toBe(0x01)
      })

      it('should encode calls with non-zero space', () => {
        const callsWithSpace: Calls = {
          ...sampleCalls,
          space: 123n,
        }
        const result = encode(callsWithSpace)
        expect(result).toBeInstanceOf(Uint8Array)

        // First byte should not have space zero flag set (bit 0)
        expect(result[0] & 0x01).toBe(0x00)
      })

      it('should encode single call flag correctly', () => {
        const result = encode(sampleCalls)
        // Should have single call flag set (bit 4)
        expect(result[0] & 0x10).toBe(0x10)
      })

      it('should encode multiple calls correctly', () => {
        const multiCallPayload: Calls = {
          ...sampleCalls,
          calls: [sampleCall, { ...sampleCall, to: testAddress2 }],
        }
        const result = encode(multiCallPayload)
        // Should not have single call flag set (bit 4)
        expect(result[0] & 0x10).toBe(0x00)
      })

      it('should handle large nonce values', () => {
        const largeNoncePayload: Calls = {
          ...sampleCalls,
          nonce: 0xffffffffffffn, // 6 bytes
        }
        const result = encode(largeNoncePayload)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should throw for nonce too large', () => {
        const veryLargeNoncePayload: Calls = {
          ...sampleCalls,
          nonce: (1n << 120n) - 1n, // 15 bytes, maximum allowed
        }
        expect(() => encode(veryLargeNoncePayload)).not.toThrow()

        const tooLargeNoncePayload: Calls = {
          ...sampleCalls,
          nonce: 1n << 120n, // 16 bytes, should throw
        }
        expect(() => encode(tooLargeNoncePayload)).toThrow('Nonce is too large')
      })

      it('should handle call with self address', () => {
        const selfAddress = testAddress
        const result = encode(sampleCalls, selfAddress)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should handle call with value', () => {
        const callWithValue: Call = {
          ...sampleCall,
          value: 1000n,
        }
        const payloadWithValue: Calls = {
          ...sampleCalls,
          calls: [callWithValue],
        }
        const result = encode(payloadWithValue)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should handle call with zero value', () => {
        const callWithZeroValue: Call = {
          ...sampleCall,
          value: 0n,
        }
        const payloadWithZeroValue: Calls = {
          ...sampleCalls,
          calls: [callWithZeroValue],
        }
        const result = encode(payloadWithZeroValue)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should handle call with gas limit', () => {
        const callWithGas: Call = {
          ...sampleCall,
          gasLimit: 21000n,
        }
        const payloadWithGas: Calls = {
          ...sampleCalls,
          calls: [callWithGas],
        }
        const result = encode(payloadWithGas)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should handle call with delegate call flag', () => {
        const delegateCall: Call = {
          ...sampleCall,
          delegateCall: true,
        }
        const payloadWithDelegate: Calls = {
          ...sampleCalls,
          calls: [delegateCall],
        }
        const result = encode(payloadWithDelegate)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should handle call with only fallback flag', () => {
        const fallbackCall: Call = {
          ...sampleCall,
          onlyFallback: true,
        }
        const payloadWithFallback: Calls = {
          ...sampleCalls,
          calls: [fallbackCall],
        }
        const result = encode(payloadWithFallback)
        expect(result).toBeInstanceOf(Uint8Array)
      })

      it('should handle different behavior on error values', () => {
        const behaviors: Call['behaviorOnError'][] = ['ignore', 'revert', 'abort']

        behaviors.forEach((behavior) => {
          const callWithBehavior: Call = {
            ...sampleCall,
            behaviorOnError: behavior,
          }
          const payloadWithBehavior: Calls = {
            ...sampleCalls,
            calls: [callWithBehavior],
          }
          const result = encode(payloadWithBehavior)
          expect(result).toBeInstanceOf(Uint8Array)
        })
      })

      it('should throw for too many calls', () => {
        const tooManyCalls = Array(65536).fill(sampleCall)
        const payloadWithTooManyCalls: Calls = {
          ...sampleCalls,
          calls: tooManyCalls,
        }
        expect(() => encode(payloadWithTooManyCalls)).toThrow('Too many calls')
      })

      it('should throw for data too large', () => {
        const largeData = '0x' + '00'.repeat(0x1000000) // 16MB + 1 byte
        const callWithLargeData: Call = {
          ...sampleCall,
          data: largeData,
        }
        const payloadWithLargeData: Calls = {
          ...sampleCalls,
          calls: [callWithLargeData],
        }
        expect(() => encode(payloadWithLargeData)).toThrow('Data too large')
      })

      it('should handle empty call data', () => {
        const callWithEmptyData: Call = {
          ...sampleCall,
          data: '0x',
        }
        const payloadWithEmptyData: Calls = {
          ...sampleCalls,
          calls: [callWithEmptyData],
        }
        const result = encode(payloadWithEmptyData)
        expect(result).toBeInstanceOf(Uint8Array)
      })
    })

    describe('decode', () => {
      it('should decode encoded payload correctly', () => {
        const encoded = encode(sampleCalls)
        const decoded = decode(encoded)

        expect(decoded.type).toBe('call')
        expect(decoded.space).toBe(sampleCalls.space)
        expect(decoded.nonce).toBe(sampleCalls.nonce)
        expect(decoded.calls).toHaveLength(1)
        expect(decoded.calls[0]).toEqual(sampleCall)
      })

      it('should handle round-trip encoding/decoding', () => {
        const testPayloads: Calls[] = [
          sampleCalls,
          {
            type: 'call',
            space: 123n,
            nonce: 456n,
            calls: [sampleCall, { ...sampleCall, to: testAddress2 }],
          },
          {
            type: 'call',
            space: 0n,
            nonce: 0n,
            calls: [
              {
                to: testAddress,
                value: 0n,
                data: '0x',
                gasLimit: 0n,
                delegateCall: false,
                onlyFallback: false,
                behaviorOnError: 'ignore',
              },
            ],
          },
        ]

        testPayloads.forEach((payload) => {
          const encoded = encode(payload)
          const decoded = decode(encoded)
          expect(decoded).toEqual(payload)
        })
      })

      it('should decode with self address', () => {
        const encoded = encode(sampleCalls, testAddress)
        const decoded = decode(encoded, testAddress)

        expect(decoded.calls[0].to).toBe(testAddress)
      })

      it('should throw for invalid packed data', () => {
        expect(() => decode(new Uint8Array(0))).toThrow('Invalid packed data: missing globalFlag')
        expect(() => decode(new Uint8Array([0x00]))).toThrow() // Missing space data
      })

      it('should throw for missing self address when needed', () => {
        // Create encoded data that uses toSelf flag
        const callToSelf: Call = { ...sampleCall, to: testAddress }
        const payloadToSelf: Calls = { ...sampleCalls, calls: [callToSelf] }
        const encoded = encode(payloadToSelf, testAddress)

        expect(() => decode(encoded)).toThrow('Missing "self" address for toSelf call')
      })

      it('should handle various nonce sizes', () => {
        const testNonces = [0n, 255n, 65535n, 16777215n, 0xffffffffn]

        testNonces.forEach((nonce) => {
          const payload: Calls = { ...sampleCalls, nonce }
          const encoded = encode(payload)
          const decoded = decode(encoded)
          expect(decoded.nonce).toBe(nonce)
        })
      })

      it('should handle behavior on error decoding', () => {
        const behaviors: Call['behaviorOnError'][] = ['ignore', 'revert', 'abort']

        behaviors.forEach((behavior) => {
          const call: Call = { ...sampleCall, behaviorOnError: behavior }
          const payload: Calls = { ...sampleCalls, calls: [call] }
          const encoded = encode(payload)
          const decoded = decode(encoded)
          expect(decoded.calls[0].behaviorOnError).toBe(behavior)
        })
      })

      it('should handle multiple calls correctly', () => {
        const multipleCalls: Call[] = [
          sampleCall,
          { ...sampleCall, to: testAddress2, value: 2000n },
          { ...sampleCall, data: '0xabcdef', gasLimit: 50000n },
        ]
        const payload: Calls = { ...sampleCalls, calls: multipleCalls }
        const encoded = encode(payload)
        const decoded = decode(encoded)

        expect(decoded.calls).toHaveLength(3)
        expect(decoded.calls[0]).toEqual(multipleCalls[0])
        expect(decoded.calls[1]).toEqual(multipleCalls[1])
        expect(decoded.calls[2]).toEqual(multipleCalls[2])
      })
    })
  })
})
