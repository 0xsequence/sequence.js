import { Attestation, Payload } from '@0xsequence/sequence-primitives'
import { Identity, Session } from '@0xsequence/sequence-wdk'
import { Address, Bytes, Provider } from 'ox'
import { MOCK_IMPLICIT_CONTRACT } from './constants'

describe('SessionManager', () => {
  // Mock provider for testing
  const mockProvider = jest.mocked<Provider.Provider>({
    request: jest.fn().mockResolvedValue(Bytes.fromHex(MOCK_IMPLICIT_CONTRACT)),
    on: jest.fn(),
    removeListener: jest.fn(),
  })

  // Create mock class extending IdentityInstrument
  class MockIdentityInstrument extends Identity.IdentityInstrument {
    constructor() {
      super('/nitro', jest.fn())
    }
    sign = jest.fn()
    initiateAuth = jest.fn()
    registerAuth = jest.fn()
    fetch = jest.fn()
  }

  // Use in mock
  const mockIdentitySigner = jest.mocked<Identity.IdentitySigner>({
    address: '0x1234567890123456789012345678901234567890',
    sign: jest.fn(),
    signDigest: jest.fn(),
    ecosystemId: 'test',
    nitro: new MockIdentityInstrument(),
    authKey: {} as Identity.AuthKey,
  })

  // Test wallet address
  const testWallet = '0x1234567890123456789012345678901234567890' as Address.Address

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create an empty session manager', () => {
    const sessionManager = Session.SessionManager.createEmpty(mockIdentitySigner.address, {
      provider: mockProvider,
    })

    expect(sessionManager.address).toBeDefined()
    expect(sessionManager.topology).toBeDefined()
  })

  it('should create and sign with an implicit session', async () => {
    const sessionManager = Session.SessionManager.createEmpty(mockIdentitySigner.address, {
      provider: mockProvider,
    })

    // Create attestation
    const redirectUrl = 'https://test.com/redirect'
    const attestation: Attestation.Attestation = {
      approvedSigner: '0x0000000000000000000000000000000000000000', // Placeholder
      identityType: new Uint8Array(4),
      issuerHash: new Uint8Array(32),
      audienceHash: new Uint8Array(32),
      authData: {
        redirectUrl,
      },
      applicationData: new Uint8Array(),
    }

    // Configure the signer mock
    mockIdentitySigner.signDigest.mockResolvedValue({
      type: 'hash',
      r: 0n,
      s: 0n,
      yParity: 1,
    })

    // Create implicit session
    const implicitSession = await sessionManager.createImplicitSession(mockIdentitySigner, attestation)
    attestation.approvedSigner = implicitSession.address // Update approvedSigner to the implicit session address

    // Configure the provider mock
    const generateImplicitRequestMagicResult = Attestation.generateImplicitRequestMagic(attestation, testWallet)
    console.log('in test block', Bytes.toHex(generateImplicitRequestMagicResult))
    mockProvider.request.mockResolvedValue(generateImplicitRequestMagicResult)

    // Create a test transaction
    const testCall: Payload.Call = {
      to: MOCK_IMPLICIT_CONTRACT,
      value: 0n,
      data: new Uint8Array(),
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }

    // Sign the transaction
    const signature = await sessionManager.signSapient(
      testWallet,
      1n, // chainId
      {
        type: 'call',
        nonce: 0n,
        space: 0n,
        calls: [testCall],
      },
    )

    expect(signature.type).toBe('sapient')
    expect(signature.address).toBe(sessionManager.address)
    expect(signature.data).toBeDefined()
  })

  it('should create and sign with an explicit session', async () => {
    const sessionManager = Session.SessionManager.createEmpty(mockIdentitySigner.address, {
      provider: mockProvider,
    })

    // Create explicit session with permissions
    await sessionManager.createExplicitSession({
      valueLimit: 1000000000000000000n, // 1 ETH
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      permissions: [
        {
          target: MOCK_IMPLICIT_CONTRACT,
          rules: [],
        },
      ],
    })

    // Create a test transaction within permissions
    const testCall: Payload.Call = {
      to: MOCK_IMPLICIT_CONTRACT,
      value: 100000000000000000n, // 0.1 ETH
      data: new Uint8Array(),
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }

    // Sign the transaction
    const signature = await sessionManager.signSapient(testWallet, 1n, {
      type: 'call',
      nonce: 0n,
      space: 0n,
      calls: [testCall],
    })

    expect(signature.type).toBe('sapient')
    expect(signature.address).toBe(sessionManager.address)
    expect(signature.data).toBeDefined()
  })
})
