import { vi, beforeEach, describe, it, expect } from 'vitest'
import { AbiFunction, Address, Bytes, Hex, Provider, RpcTransport, Secp256k1, TransactionEnvelopeEip1559 } from 'ox'

import { Attestation, Constants, GenericTree, Payload, Permission, SessionConfig } from '../../primitives/src/index.js'
import { Envelope, Signers, State, Wallet } from '../src/index.js'

import { CAN_RUN_LIVE, EMITTER_ABI, EMITTER_ADDRESS, PRIVATE_KEY, RPC_URL } from './constants'

function randomAddress(): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

describe('SessionManager', () => {
  const getProvider = async (): Promise<{ provider: Provider.Provider; chainId: bigint }> => {
    let provider: Provider.Provider
    let chainId = 1n
    if (CAN_RUN_LIVE) {
      provider = Provider.from(RpcTransport.fromHttp(RPC_URL!!))
      chainId = BigInt(await provider.request({ method: 'eth_chainId' }))
    } else {
      provider = vi.mocked<Provider.Provider>({
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
      })
    }
    return { provider: provider!, chainId }
  }

  const testWalletAddress = randomAddress()
  const identityPrivateKey = Secp256k1.randomPrivateKey()
  const testIdentityAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: identityPrivateKey }))

  const requireContractDeployed = async (provider: Provider.Provider, contract: Address.Address) => {
    const code = await provider.request({ method: 'eth_getCode', params: [contract, 'latest'] })
    if (code === '0x') {
      throw new Error(`Contract ${contract} not deployed`)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create an empty session manager', async () => {
    const { provider } = await getProvider()
    const sessionManager = Signers.SessionManager.createEmpty(testIdentityAddress, {
      provider,
    })

    expect(sessionManager.address).toBeDefined()
    expect(SessionConfig.isCompleteSessionsTopology(sessionManager.topology)).toBe(true)
    expect(SessionConfig.getIdentitySigner(sessionManager.topology)).toBe(testIdentityAddress)
    expect(SessionConfig.getImplicitBlacklist(sessionManager.topology)).toStrictEqual([])
  })

  it('should load from state', async () => {
    const { provider } = await getProvider()
    const stateProvider = new State.Local.Provider()

    let topology = SessionConfig.emptySessionsTopology(testIdentityAddress)
    // Add random signer to the topology
    const sessionPermission: Signers.Session.ExplicitParams = {
      valueLimit: 1000000000000000000n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      permissions: [
        {
          target: randomAddress(),
          rules: [
            {
              cumulative: true,
              operation: Permission.ParameterOperation.EQUAL,
              value: Bytes.padLeft(Bytes.fromHex('0x'), 32),
              offset: 0n,
              mask: Bytes.padLeft(Bytes.fromHex('0x'), 32),
            },
            {
              cumulative: false,
              operation: Permission.ParameterOperation.EQUAL,
              value: Bytes.padLeft(Bytes.fromHex('0x01'), 32),
              offset: 2n,
              mask: Bytes.padLeft(Bytes.fromHex('0x03'), 32),
            },
          ],
        },
      ],
    }
    const randomSigner = randomAddress()
    topology = SessionConfig.addExplicitSession(topology, {
      ...sessionPermission,
      signer: randomSigner,
    })
    // Add random blacklist to the topology
    const randomBlacklistAddress = randomAddress()
    topology = SessionConfig.addToImplicitBlacklist(topology, randomBlacklistAddress)

    const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(topology))

    // Save the topology to storage
    await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(topology))

    // Create the session manager using the storage
    const sessionManager = await Signers.SessionManager.createFromStorage(imageHash, stateProvider, {
      provider,
    })

    // Check config is correct
    expect(sessionManager.imageHash).toBe(imageHash)
    expect(SessionConfig.isCompleteSessionsTopology(sessionManager.topology)).toBe(true)
    expect(SessionConfig.getIdentitySigner(sessionManager.topology)).toBe(testIdentityAddress)
    expect(SessionConfig.getImplicitBlacklist(sessionManager.topology)).toStrictEqual([randomBlacklistAddress])
    const actualPermissions = SessionConfig.getSessionPermissions(sessionManager.topology, randomSigner)
    expect(actualPermissions).toStrictEqual({
      ...sessionPermission,
      type: 'session-permissions',
      signer: randomSigner,
    })
  })

  it('should create and sign with an implicit session', async () => {
    const { provider, chainId } = await getProvider()
    await requireContractDeployed(provider, EMITTER_ADDRESS)

    // Create implicit signer
    const implicitPrivateKey = Secp256k1.randomPrivateKey()
    const implicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: implicitPrivateKey }))
    // -- This is sent to the wallet (somehow)--
    const attestation: Attestation.Attestation = {
      approvedSigner: implicitAddress,
      identityType: new Uint8Array(4),
      issuerHash: new Uint8Array(32),
      audienceHash: new Uint8Array(32),
      applicationData: new Uint8Array(),
      authData: {
        redirectUrl: 'https://example.com',
      },
    }
    const identitySignature = Secp256k1.sign({
      payload: Attestation.hash(attestation),
      privateKey: identityPrivateKey,
    })
    // -- Back in dapp --
    const implicitSigner = new Signers.Session.Implicit(
      implicitPrivateKey,
      attestation,
      identitySignature,
      implicitAddress,
    )
    const sessionManager = Signers.SessionManager.createEmpty(testIdentityAddress, {
      provider,
    }).withImplicitSigner(implicitSigner)

    if (!CAN_RUN_LIVE) {
      // Configure the provider mock
      const generateImplicitRequestMagicResult = Attestation.generateImplicitRequestMagic(
        attestation,
        testWalletAddress,
      )
      ;(provider as any).request.mockResolvedValue(generateImplicitRequestMagicResult)
    }

    // Create a test transaction
    const call: Payload.Call = {
      to: EMITTER_ADDRESS,
      value: 0n,
      data: AbiFunction.encodeData(EMITTER_ABI[1]), // Implicit emit
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }
    const payload: Payload.Calls = {
      type: 'call',
      nonce: 0n,
      space: 0n,
      calls: [call],
    }

    // Sign the transaction
    const signature = await sessionManager.signSapient(testWalletAddress, chainId, payload, sessionManager.imageHash)

    expect(signature.type).toBe('sapient')
    expect(signature.address).toBe(sessionManager.address)
    expect(signature.data).toBeDefined()

    if (!CAN_RUN_LIVE) {
      // Configure the provider mock
      ;(provider as any).request.mockResolvedValue(sessionManager.imageHash)
    }

    // Check if the signature is valid
    const isValid = await sessionManager.isValidSapientSignature(testWalletAddress, chainId, payload, signature)
    expect(isValid).toBe(true)
  })

  it('should create and sign with an explicit session', async () => {
    const { provider, chainId } = await getProvider()
    await requireContractDeployed(provider, EMITTER_ADDRESS)

    // Create explicit signer
    const explicitPrivateKey = Secp256k1.randomPrivateKey()
    const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, {
      valueLimit: 1000000000000000000n, // 1 ETH
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      permissions: [
        {
          target: EMITTER_ADDRESS,
          rules: [],
        },
      ],
    })
    const sessionManager = Signers.SessionManager.createEmpty(testIdentityAddress, {
      provider,
    }).withExplicitSigner(explicitSigner)

    // Create a test transaction within permissions
    const call: Payload.Call = {
      to: EMITTER_ADDRESS,
      value: 0n,
      data: AbiFunction.encodeData(EMITTER_ABI[0]), // Explicit emit
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    }
    const payload: Payload.Calls = {
      type: 'call',
      nonce: 0n,
      space: 0n,
      calls: [call],
    }

    // Sign the transaction
    const signature = await sessionManager.signSapient(testWalletAddress, chainId, payload, sessionManager.imageHash)

    expect(signature.type).toBe('sapient')
    expect(signature.address).toBe(sessionManager.address)
    expect(signature.data).toBeDefined()

    if (!CAN_RUN_LIVE) {
      // Configure the provider mock
      ;(provider as any).request.mockResolvedValue(sessionManager.imageHash)
    }

    // Check if the signature is valid
    const isValid = await sessionManager.isValidSapientSignature(testWalletAddress, chainId, payload, signature)
    expect(isValid).toBe(true)
  })

  if (CAN_RUN_LIVE) {
    // Load the sender
    const pkHex = Hex.from(PRIVATE_KEY as `0x${string}`)
    const senderAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pkHex }))

    const buildAndSignCall = async (
      wallet: Wallet,
      sessionManager: Signers.SessionManager,
      call: Payload.Call,
      provider: Provider.Provider,
      chainId: bigint,
    ) => {
      // Prepare the transaction
      const envelope = await wallet.prepareTransaction(provider, [call])
      const parentedEnvelope: Payload.Parented = {
        ...envelope.payload,
        parentWallets: [wallet.address],
      }
      const signature = await sessionManager.signSapient(
        wallet.address,
        chainId,
        parentedEnvelope,
        sessionManager.imageHash,
      )
      const sapientSignature: Envelope.SapientSignature = {
        imageHash: sessionManager.imageHash,
        signature,
      }
      // Sign the envelope
      const signedEnvelope = Envelope.toSigned(envelope, [sapientSignature])
      const transaction = await wallet.buildTransaction(provider, signedEnvelope)
      return transaction
    }

    const sendTransaction = async (
      provider: Provider.Provider,
      transaction: { to: Address.Address; data: Hex.Hex },
      chainId: bigint,
    ) => {
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

      const relayEnvelope = TransactionEnvelopeEip1559.from({
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
        payload: TransactionEnvelopeEip1559.getSignPayload(relayEnvelope),
        privateKey: pkHex,
      })
      const signedRelayEnvelope = TransactionEnvelopeEip1559.from(relayEnvelope, {
        signature: relayerSignature,
      })
      const tx = await provider.request({
        method: 'eth_sendRawTransaction',
        params: [TransactionEnvelopeEip1559.serialize(signedRelayEnvelope)],
      })
      console.log('Transaction sent', tx)
      await provider.request({ method: 'eth_getTransactionReceipt', params: [tx] })
    }

    // Submit a real transaction with a wallet that has a SessionManager using implicit session
    it('Submits a real transaction with a wallet that has a SessionManager using implicit session', async () => {
      // Check the contracts have been deployed
      const { provider, chainId } = await getProvider()
      await requireContractDeployed(provider, EMITTER_ADDRESS)
      await requireContractDeployed(provider, Constants.DefaultGuest)

      // Create an implicit signer
      const implicitPrivateKey = Secp256k1.randomPrivateKey()
      const implicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: implicitPrivateKey }))
      // -- This is sent to the wallet (somehow)--
      const attestation: Attestation.Attestation = {
        approvedSigner: implicitAddress,
        identityType: new Uint8Array(4),
        issuerHash: new Uint8Array(32),
        audienceHash: new Uint8Array(32),
        applicationData: new Uint8Array(),
        authData: {
          redirectUrl: 'https://example.com',
        },
      }
      const identitySignature = Secp256k1.sign({
        payload: Attestation.hash(attestation),
        privateKey: identityPrivateKey,
      })
      // -- Back in dapp --
      const implicitSigner = new Signers.Session.Implicit(
        implicitPrivateKey,
        attestation,
        identitySignature,
        implicitAddress,
      )
      const sessionManager = Signers.SessionManager.createEmpty(testIdentityAddress, {
        provider,
        implicitSigners: [implicitSigner],
      })
      const wallet = await Wallet.fromConfiguration({
        threshold: 1n,
        checkpoint: 0n,
        topology: [
          {
            type: 'sapient-signer',
            address: sessionManager.address,
            weight: 1n,
            imageHash: sessionManager.imageHash,
          },
          // Include a random node leaf (bytes32) to prevent image hash collision
          Hex.random(32),
        ],
      })

      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_ABI[1]), // Implicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, call, provider, chainId)
      await sendTransaction(provider, transaction, chainId)
    }, 60000)

    it('Submits a real transaction with a wallet that has a SessionManager using explicit session', async () => {
      const { provider, chainId } = await getProvider()
      // Check the contracts have been deployed
      await requireContractDeployed(provider, EMITTER_ADDRESS)
      await requireContractDeployed(provider, Constants.DefaultGuest)

      // Create explicit signer
      const explicitPrivateKey = Secp256k1.randomPrivateKey()
      const sessionPermission: Signers.Session.ExplicitParams = {
        valueLimit: 1000000000000000000n, // 1 ETH
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [{ target: EMITTER_ADDRESS, rules: [] }],
      }
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermission)
      // Test manually building the session topology
      const sessionTopology = SessionConfig.addExplicitSession(
        SessionConfig.emptySessionsTopology(testIdentityAddress),
        {
          ...sessionPermission,
          signer: explicitSigner.address,
        },
      )
      const sessionManager = new Signers.SessionManager({
        topology: sessionTopology,
        explicitSigners: [explicitSigner],
        provider,
      })

      // Create the wallet
      const wallet = await Wallet.fromConfiguration({
        threshold: 1n,
        checkpoint: 0n,
        topology: [
          // Random explicit signer will randomise the image hash
          {
            type: 'sapient-signer',
            address: sessionManager.address,
            weight: 1n,
            imageHash: sessionManager.imageHash,
          },
          // Include a random node leaf (bytes32) to prevent image hash collision
          Hex.random(32),
        ],
      })

      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_ABI[0]), // Explicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, call, provider, chainId)
      await sendTransaction(provider, transaction, chainId)
    }, 60000)
  }
})
