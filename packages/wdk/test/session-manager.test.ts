import { Signers, Wallet } from '@0xsequence/sequence-core'
import { Attestation, Constants, Payload } from '@0xsequence/sequence-primitives'
import { Identity, Session } from '@0xsequence/sequence-wdk'
import { AbiFunction, Address, Bytes, Hex, Provider, RpcTransport, Secp256k1, TransactionEnvelopeEip1559 } from 'ox'
import {
  CAN_RUN_LIVE,
  ERC20_IMPLICIT_MINT_CONTRACT,
  ERC20_MINT_ONCE,
  MOCK_IMPLICIT_CONTRACT,
  PRIVATE_KEY,
  RPC_URL,
} from './constants'

describe('SessionManager (mocked)', () => {
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

// Only run real tests when RPC is provided
if (CAN_RUN_LIVE) {
  describe('SessionManager (live)', () => {
    const walletAddress: Address.Address = '0x1234567890123456789012345678901234567890'

    const rpcTransport = RpcTransport.fromHttp(RPC_URL!!)
    const provider = Provider.from(rpcTransport)

    // Mock the identity signer using a local private key instead of calling nitro
    const pkHex = Hex.from(PRIVATE_KEY as `0x${string}`)
    const pk = new Signers.Pk(pkHex)
    const mockIdentitySigner = pk as unknown as Identity.IdentitySigner

    const sessionManager = Session.SessionManager.createEmpty(mockIdentitySigner.address, {
      provider,
    })

    const requireContractDeployed = async (contract: Address.Address) => {
      const code = await provider.request({ method: 'eth_getCode', params: [contract, 'latest'] })
      if (code === '0x') {
        throw new Error('Contract not deployed')
      }
    }

    it('should create and sign with an implicit session', async () => {
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      const attestation = {
        identityType: new Uint8Array(4),
        issuerHash: new Uint8Array(32),
        audienceHash: new Uint8Array(32),
        applicationData: new Uint8Array(),
        authData: {
          redirectUrl: 'https://test.com/redirect',
        },
      }

      await sessionManager.createImplicitSession(mockIdentitySigner, attestation)
      const payload: Payload.Calls = {
        type: 'call',
        nonce: 0n,
        space: 0n,
        calls: [
          {
            to: MOCK_IMPLICIT_CONTRACT,
            value: 0n,
            data: new Uint8Array(),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
      }
      const signature = await sessionManager.signSapient(walletAddress, chainId, payload)

      // Check if the signature is valid
      const isValid = await sessionManager.isValidSapientSignature(walletAddress, chainId, payload, signature)
      expect(isValid).toBe(true)
    })

    it.only('Submits a real transaction with a wallet that has a SessionManager', async () => {
      // Check the contracts have been deployed
      await requireContractDeployed(ERC20_IMPLICIT_MINT_CONTRACT)
      await requireContractDeployed(Constants.DefaultGuest)

      // Check balance of the private key account
      const senderAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pkHex }))

      const wallet = await Wallet.fromConfiguration({
        threshold: 1n,
        checkpoint: 0n,
        topology: {
          type: 'sapient-signer',
          address: sessionManager.address,
          weight: 100n,
          imageHash: Bytes.fromHex(sessionManager.imageHash),
        },
      })
      wallet.setSapientSigner(sessionManager)

      const call: Payload.Call = {
        to: ERC20_IMPLICIT_MINT_CONTRACT,
        value: 0n,
        data: Bytes.fromHex(AbiFunction.encodeData(ERC20_MINT_ONCE, [wallet.address, 1000000000000000000n])),
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      // Add an implicit session
      const attestation = {
        identityType: new Uint8Array(4),
        issuerHash: new Uint8Array(32),
        audienceHash: new Uint8Array(32),
        applicationData: new Uint8Array(),
        authData: {
          redirectUrl: 'https://example.com',
        },
      }
      await sessionManager.createImplicitSession(mockIdentitySigner, attestation)

      // Send the transaction
      const transaction = await wallet.getTransaction(provider, [call])

      // Estimate gas with a safety buffer
      const estimatedGas = BigInt(await provider.request({ method: 'eth_estimateGas', params: [transaction] }))
      const safeGasLimit = estimatedGas > 21000n ? (estimatedGas * 12n) / 10n : 50000n

      // Get base fee and priority fee
      const baseFee = BigInt(await provider.request({ method: 'eth_gasPrice' }))
      const priorityFee = 100000000n // 0.1 gwei priority fee
      const maxFeePerGas = baseFee + priorityFee

      // Check sender have enough balance
      const senderBalance = BigInt(
        await provider.request({ method: 'eth_getBalance', params: [senderAddress, 'latest'] }),
      )
      if (senderBalance < maxFeePerGas * safeGasLimit) {
        console.log('Sender balance:', senderBalance.toString(), 'wei')
        throw new Error('Sender has insufficient balance to pay for gas')
      }
      const nonce = BigInt(
        await provider.request({
          method: 'eth_getTransactionCount',
          params: [senderAddress, 'latest'],
        }),
      )

      const chainId = await provider.request({ method: 'eth_chainId' })
      const envelope = TransactionEnvelopeEip1559.from({
        chainId: Number(chainId),
        type: 'eip1559',
        from: senderAddress,
        to: transaction.to,
        data: transaction.data,
        gas: safeGasLimit,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: priorityFee,
        nonce: nonce,
        value: 0n,
      })
      const relayerSignature = Secp256k1.sign({
        payload: TransactionEnvelopeEip1559.getSignPayload(envelope),
        privateKey: pkHex,
      })
      const signedEnvelope = TransactionEnvelopeEip1559.from(envelope, {
        signature: relayerSignature,
      })
      const tx = await provider.request({
        method: 'eth_sendRawTransaction',
        params: [TransactionEnvelopeEip1559.serialize(signedEnvelope)],
      })
      console.log('Transaction sent', tx)
      await provider.request({ method: 'eth_getTransactionReceipt', params: [tx] })
    }, 60000)
  })
}
