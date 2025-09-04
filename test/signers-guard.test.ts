import { describe, it, expect, vi } from 'vitest'
import { Attestation, Config, Network, Payload } from '@0xsequence/wallet-primitives'
import * as GuardService from '@0xsequence/guard'
import { Address, Bytes, Hash, Hex, Signature, TypedData } from 'ox'
import { Envelope } from '../src/index.js'
import { Guard } from '../src/signers/guard.js'

// Test addresses and data
const TEST_ADDRESS_1 = Address.from('0x1234567890123456789012345678901234567890')
const TEST_ADDRESS_2 = Address.from('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const TEST_WALLET = Address.from('0xfedcbafedcbafedcbafedcbafedcbafedcbafe00')

// Mock configuration with single signer
const mockConfig: Config.Config = {
  threshold: 2n,
  checkpoint: 0n,
  topology: { type: 'signer', address: TEST_ADDRESS_1, weight: 2n },
}

// Create test envelope
const blankEnvelope = {
  wallet: TEST_WALLET,
  chainId: Network.ChainId.MAINNET,
  configuration: mockConfig,
}

// Mock signatures
const mockHashSignature: Envelope.Signature = {
  address: TEST_ADDRESS_2,
  signature: {
    type: 'hash',
    r: 123n,
    s: 456n,
    yParity: 0,
  },
}
const mockEthSignSignature: Envelope.Signature = {
  address: TEST_ADDRESS_2,
  signature: {
    type: 'eth_sign',
    r: 789n,
    s: 101112n,
    yParity: 1,
  },
}
const mockErc1271Signature: Envelope.Signature = {
  address: TEST_ADDRESS_2,
  signature: {
    type: 'erc1271',
    address: TEST_ADDRESS_2,
    data: '0xabcdef123456' as Hex.Hex,
  },
}
const mockSapientSignature: Envelope.SapientSignature = {
  imageHash: '0x987654321',
  signature: {
    type: 'sapient',
    address: TEST_ADDRESS_2,
    data: '0x9876543210987654321098765432109876543210' as Hex.Hex,
  },
}

const expectedSignatures = [
  {
    type: GuardService.SignatureType.Hash,
    address: TEST_ADDRESS_2,
    data: Signature.toHex(mockHashSignature.signature as any),
  },
  {
    type: GuardService.SignatureType.EthSign,
    address: TEST_ADDRESS_2,
    data: Signature.toHex(mockEthSignSignature.signature as any),
  },
  {
    type: GuardService.SignatureType.Erc1271,
    address: TEST_ADDRESS_2,
    data: (mockErc1271Signature.signature as any).data,
  },
  {
    type: GuardService.SignatureType.Sapient,
    address: TEST_ADDRESS_2,
    data: mockSapientSignature.signature.data,
    imageHash: mockSapientSignature.imageHash,
  },
]

describe('Guard Signer', () => {
  it('should sign call payloads', async () => {
    const signFn = vi.fn().mockResolvedValue({
      r: 1n,
      s: 2n,
      yParity: 0,
    })
    const guard = new Guard({
      address: TEST_ADDRESS_1,
      signPayload: signFn,
    })

    const call = {
      to: '0x1234567890123456789012345678901234567890' as Address.Address,
      value: 0n,
      data: '0x1234567890123456789012345678901234567890' as Hex.Hex,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'ignore' as const,
    }

    const payload = Payload.fromCall(0n, 0n, [call])
    const envelope = {
      payload,
      ...blankEnvelope,
    } as Envelope.Envelope<Payload.Calls>

    const signatures = [mockHashSignature, mockEthSignSignature, mockErc1271Signature, mockSapientSignature]
    const signedEnvelope = Envelope.toSigned(envelope, signatures)

    const result = await guard.signEnvelope(signedEnvelope)
    expect(result).toEqual({
      address: TEST_ADDRESS_1,
      signature: {
        type: 'hash',
        r: 1n,
        s: 2n,
        yParity: 0,
      },
    })

    const typedData = Payload.toTyped(TEST_WALLET, Network.ChainId.MAINNET, payload)
    const expectedDigest = Bytes.fromHex(TypedData.getSignPayload(typedData))
    const expectedMessage = Bytes.fromString(TypedData.serialize(typedData))

    expect(signFn).toHaveBeenCalledExactlyOnceWith(
      TEST_WALLET,
      Network.ChainId.MAINNET,
      GuardService.PayloadType.Calls,
      expectedDigest,
      expectedMessage,
      expectedSignatures,
    )
  })

  it('should sign message payloads', async () => {
    const signFn = vi.fn().mockResolvedValue({
      r: 1n,
      s: 2n,
      yParity: 0,
    })
    const guard = new Guard({
      address: TEST_ADDRESS_1,
      signPayload: signFn,
    })

    const payload = Payload.fromMessage(Hex.fromString('Test message'))
    const envelope = {
      payload,
      ...blankEnvelope,
    } as Envelope.Envelope<Payload.Message>

    const signatures = [mockHashSignature, mockEthSignSignature, mockErc1271Signature, mockSapientSignature]
    const signedEnvelope = Envelope.toSigned(envelope, signatures)

    const result = await guard.signEnvelope(signedEnvelope)
    expect(result).toEqual({
      address: TEST_ADDRESS_1,
      signature: {
        type: 'hash',
        r: 1n,
        s: 2n,
        yParity: 0,
      },
    })

    const typedData = Payload.toTyped(TEST_WALLET, Network.ChainId.MAINNET, payload)
    const expectedDigest = Bytes.fromHex(TypedData.getSignPayload(typedData))
    const expectedMessage = Bytes.fromString(TypedData.serialize(typedData))

    expect(signFn).toHaveBeenCalledExactlyOnceWith(
      TEST_WALLET,
      Network.ChainId.MAINNET,
      GuardService.PayloadType.Message,
      expectedDigest,
      expectedMessage,
      expectedSignatures,
    )
  })

  it('should sign config update payloads', async () => {
    const signFn = vi.fn().mockResolvedValue({
      r: 1n,
      s: 2n,
      yParity: 0,
    })
    const guard = new Guard({
      address: TEST_ADDRESS_1,
      signPayload: signFn,
    })

    const payload = Payload.fromConfigUpdate(Hex.fromString('0x987654321098765432109876543210'))
    const envelope = {
      payload,
      ...blankEnvelope,
    } as Envelope.Envelope<Payload.ConfigUpdate>

    const signatures = [mockHashSignature, mockEthSignSignature, mockErc1271Signature, mockSapientSignature]
    const signedEnvelope = Envelope.toSigned(envelope, signatures)

    const result = await guard.signEnvelope(signedEnvelope)
    expect(result).toEqual({
      address: TEST_ADDRESS_1,
      signature: {
        type: 'hash',
        r: 1n,
        s: 2n,
        yParity: 0,
      },
    })

    const typedData = Payload.toTyped(TEST_WALLET, Network.ChainId.MAINNET, payload)
    const expectedDigest = Bytes.fromHex(TypedData.getSignPayload(typedData))
    const expectedMessage = Bytes.fromString(TypedData.serialize(typedData))

    expect(signFn).toHaveBeenCalledExactlyOnceWith(
      TEST_WALLET,
      Network.ChainId.MAINNET,
      GuardService.PayloadType.ConfigUpdate,
      expectedDigest,
      expectedMessage,
      expectedSignatures,
    )
  })

  it('should sign session implicit authorize payloads', async () => {
    const signFn = vi.fn().mockResolvedValue({
      r: 1n,
      s: 2n,
      yParity: 0,
    })
    const guard = new Guard({
      address: TEST_ADDRESS_1,
      signPayload: signFn,
    })

    const payload = {
      type: 'session-implicit-authorize',
      sessionAddress: TEST_ADDRESS_2,
      attestation: {
        approvedSigner: TEST_ADDRESS_2,
        identityType: Bytes.fromHex('0x00000001'),
        issuerHash: Hash.keccak256(Bytes.fromString('issuer')),
        audienceHash: Hash.keccak256(Bytes.fromString('audience')),
        applicationData: Bytes.fromString('applicationData'),
        authData: {
          redirectUrl: 'https://example.com',
          issuedAt: 1n,
        },
      },
    } as Payload.SessionImplicitAuthorize
    const envelope = {
      payload,
      ...blankEnvelope,
    } as Envelope.Envelope<Payload.SessionImplicitAuthorize>

    const signatures = [mockHashSignature, mockEthSignSignature, mockErc1271Signature, mockSapientSignature]
    const signedEnvelope = Envelope.toSigned(envelope, signatures)

    const result = await guard.signEnvelope(signedEnvelope)
    expect(result).toEqual({
      address: TEST_ADDRESS_1,
      signature: {
        type: 'hash',
        r: 1n,
        s: 2n,
        yParity: 0,
      },
    })

    const expectedDigest = Hash.keccak256(Attestation.encode(payload.attestation))
    const expectedMessage = Bytes.fromString(Attestation.toJson(payload.attestation))

    expect(signFn).toHaveBeenCalledExactlyOnceWith(
      TEST_WALLET,
      Network.ChainId.MAINNET,
      GuardService.PayloadType.SessionImplicitAuthorize,
      expectedDigest,
      expectedMessage,
      expectedSignatures,
    )
  })
})
