import { AbiEvent, AbiFunction, Bytes, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { describe, expect, it } from 'vitest'

import { Attestation, GenericTree, Payload, Permission, SessionConfig } from '../../primitives/src/index.js'
import { Envelope, Signers, State, Utils, Wallet } from '../src/index.js'

import { EMITTER_FUNCTIONS, EMITTER_ADDRESS, EMITTER_EVENT_TOPICS, LOCAL_RPC_URL, USDC_ADDRESS } from './constants'
import { Extensions } from '@0xsequence/wallet-primitives'

const { PermissionBuilder, ERC20PermissionBuilder } = Utils

function randomAddress(): Address.Checksummed {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

describe('SessionManager', () => {
  const timeout = 30000

  const identityPrivateKey = Secp256k1.randomPrivateKey()
  const identityAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: identityPrivateKey }))

  const stateProvider = new State.Local.Provider()

  it(
    'should load from state',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      let topology = SessionConfig.emptySessionsTopology(identityAddress)
      // Add random signer to the topology
      const sessionPermission: Signers.Session.ExplicitParams = {
        chainId,
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

      // Create a wallet with the session manager topology as a leaf
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: { type: 'sapient-signer', address: Extensions.Dev1.sessions, weight: 1n, imageHash },
        },
        {
          stateProvider,
        },
      )

      // Create the session manager using the storage
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
      })

      // Check config is correct
      const actualTopology = await sessionManager.topology
      const actualImageHash = await sessionManager.imageHash
      expect(actualImageHash).toBe(imageHash)
      expect(SessionConfig.isCompleteSessionsTopology(actualTopology)).toBe(true)
      expect(SessionConfig.getIdentitySigner(actualTopology)).toBe(identityAddress)
      expect(SessionConfig.getImplicitBlacklist(actualTopology)).toStrictEqual([randomBlacklistAddress])
      const actualPermissions = SessionConfig.getSessionPermissions(actualTopology, randomSigner)
      expect(actualPermissions).toStrictEqual({
        ...sessionPermission,
        type: 'session-permissions',
        signer: randomSigner,
      })
    },
    timeout,
  )

  it(
    'should create and sign with an implicit session',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))

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
          issuedAt: BigInt(Math.floor(Date.now() / 1000)),
        },
      }
      const identitySignature = Secp256k1.sign({
        payload: Attestation.hash(attestation),
        privateKey: identityPrivateKey,
      })
      const topology = SessionConfig.emptySessionsTopology(identityAddress)
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(topology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(topology))
      // -- Back in dapp --
      const implicitSigner = new Signers.Session.Implicit(
        implicitPrivateKey,
        attestation,
        identitySignature,
        implicitAddress,
      )
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: { type: 'sapient-signer', address: Extensions.Dev1.sessions, weight: 1n, imageHash },
        },
        {
          stateProvider,
        },
      )
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
      }).withImplicitSigner(implicitSigner)

      // Create a test transaction
      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_FUNCTIONS[1]), // Implicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }
      const payload: Payload.Parented = {
        type: 'call',
        nonce: 0n,
        space: 0n,
        calls: [call],
        parentWallets: [wallet.address],
      }

      // Sign the transaction
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))
      const signature = await sessionManager.signSapient(wallet.address, chainId, payload, imageHash)

      expect(signature.type).toBe('sapient')
      expect(signature.address).toBe(sessionManager.address)
      expect(signature.data).toBeDefined()

      // Check if the signature is valid
      const isValid = await sessionManager.isValidSapientSignature(wallet.address, chainId, payload, signature)
      expect(isValid).toBe(true)
    },
    timeout,
  )

  const shouldCreateAndSignWithExplicitSession = async (useChainId: boolean) => {
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

    // Create explicit signer
    const explicitPrivateKey = Secp256k1.randomPrivateKey()
    const explicitPermissions: Signers.Session.ExplicitParams = {
      chainId: useChainId ? chainId : 0n,
      valueLimit: 1000000000000000000n, // 1 ETH
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      permissions: [PermissionBuilder.for(EMITTER_ADDRESS).allowAll().build()],
    }
    const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, explicitPermissions)
    // Create the topology and wallet
    const topology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
      ...explicitPermissions,
      signer: explicitSigner.address,
      chainId,
    })
    await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(topology))
    const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(topology))
    const wallet = await Wallet.fromConfiguration(
      {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'sapient-signer', address: Extensions.Dev1.sessions, weight: 1n, imageHash },
      },
      {
        stateProvider,
      },
    )
    // Create the session manager
    const sessionManager = new Signers.SessionManager(wallet, {
      provider,
      sessionManagerAddress: Extensions.Dev1.sessions,
    }).withExplicitSigner(explicitSigner)

    // Create a test transaction within permissions
    const call: Payload.Call = {
      to: EMITTER_ADDRESS,
      value: 0n,
      data: AbiFunction.encodeData(EMITTER_FUNCTIONS[0]), // Explicit emit
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
    const signature = await sessionManager.signSapient(wallet.address, chainId, payload, imageHash)

    expect(signature.type).toBe('sapient')
    expect(signature.address).toBe(sessionManager.address)
    expect(signature.data).toBeDefined()

    // Check if the signature is valid
    const isValid = await sessionManager.isValidSapientSignature(wallet.address, chainId, payload, signature)
    expect(isValid).toBe(true)
  }

  it(
    'should create and sign with an explicit session',
    async () => {
      await shouldCreateAndSignWithExplicitSession(true)
    },
    timeout,
  )

  it(
    'should create and sign with an explicit session with 0 chainId',
    async () => {
      await shouldCreateAndSignWithExplicitSession(false)
    },
    timeout,
  )

  const buildAndSignCall = async (
    wallet: Wallet,
    sessionManager: Signers.SessionManager,
    calls: Payload.Call[],
    provider: Provider.Provider,
    chainId: bigint,
  ) => {
    // Prepare the transaction
    const envelope = await wallet.prepareTransaction(provider, calls)
    const parentedEnvelope: Payload.Parented = {
      ...envelope.payload,
      parentWallets: [wallet.address],
    }
    const imageHash = await sessionManager.imageHash
    if (!imageHash) {
      throw new Error('Image hash is undefined')
    }
    const signature = await sessionManager.signSapient(wallet.address, chainId, parentedEnvelope, imageHash)
    const sapientSignature: Envelope.SapientSignature = {
      imageHash,
      signature,
    }
    // Sign the envelope
    const signedEnvelope = Envelope.toSigned(envelope, [sapientSignature])
    const transaction = await wallet.buildTransaction(provider, signedEnvelope)
    return transaction
  }

  const simulateTransaction = async (
    provider: Provider.Provider,
    transaction: { to: Address.Checksummed; data: Hex.Hex },
    expectedEventTopic?: Hex.Hex,
  ) => {
    console.log('Simulating transaction', transaction)
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    })
    console.log('Transaction hash:', txHash)

    // Wait for transaction receipt
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    })
    if (!receipt) {
      throw new Error('Transaction receipt not found')
    }

    if (expectedEventTopic) {
      // Check for event
      if (!receipt.logs) {
        throw new Error('No events emitted')
      }
      if (!receipt.logs.some((log) => log.topics.includes(expectedEventTopic))) {
        throw new Error(`Expected topic ${expectedEventTopic} not found in events: ${JSON.stringify(receipt.logs)}`)
      }
    }

    return receipt
  }

  it(
    'signs a payload using an implicit session',
    async () => {
      // Check the contracts have been deployed
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

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
          issuedAt: BigInt(Math.floor(Date.now() / 1000)),
        },
      }
      const identitySignature = Secp256k1.sign({
        payload: Attestation.hash(attestation),
        privateKey: identityPrivateKey,
      })
      const topology = SessionConfig.emptySessionsTopology(identityAddress)
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(topology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(topology))
      // -- Back in dapp --
      const implicitSigner = new Signers.Session.Implicit(
        implicitPrivateKey,
        attestation,
        identitySignature,
        implicitAddress,
      )
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: [
            { type: 'sapient-signer', address: Extensions.Dev1.sessions, weight: 1n, imageHash },
            // Include a random node leaf (bytes32) to prevent image hash collision
            Hex.random(32),
          ],
        },
        {
          stateProvider,
        },
      )
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
        implicitSigners: [implicitSigner],
      })

      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_FUNCTIONS[1]), // Implicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, [call], provider, chainId)
      await simulateTransaction(provider, transaction, EMITTER_EVENT_TOPICS[1])
    },
    timeout,
  )

  it(
    'signs a payload using an explicit session',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      // Create explicit signer
      const explicitPrivateKey = Secp256k1.randomPrivateKey()
      const sessionPermission: Signers.Session.ExplicitParams = {
        chainId,
        valueLimit: 1000000000000000000n, // 1 ETH
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [PermissionBuilder.for(EMITTER_ADDRESS).allowAll().build()],
      }
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermission)
      // Test manually building the session topology
      const sessionTopology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermission,
        signer: explicitSigner.address,
      })
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))

      // Create the wallet
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: [
            // Random explicit signer will randomise the image hash
            {
              type: 'sapient-signer',
              address: Extensions.Dev1.sessions,
              weight: 1n,
              imageHash,
            },
            // Include a random node leaf (bytes32) to prevent image hash collision
            Hex.random(32),
          ],
        },
        {
          stateProvider,
        },
      )
      // Create the session manager
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
        explicitSigners: [explicitSigner],
      })

      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_FUNCTIONS[0]), // Explicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, [call], provider, chainId)
      await simulateTransaction(provider, transaction, EMITTER_EVENT_TOPICS[0])
    },
    timeout,
  )

  it(
    'signs a payload using an explicit session',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      // Create explicit signer
      const explicitPrivateKey = Secp256k1.randomPrivateKey()
      const sessionPermission: Signers.Session.ExplicitParams = {
        chainId,
        valueLimit: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [PermissionBuilder.for(EMITTER_ADDRESS).forFunction(EMITTER_FUNCTIONS[0]).onlyOnce().build()],
      }
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermission)
      // Test manually building the session topology
      const sessionTopology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermission,
        signer: explicitSigner.address,
      })
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))

      // Create the wallet
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: [
            // Random explicit signer will randomise the image hash
            {
              type: 'sapient-signer',
              address: Extensions.Dev1.sessions,
              weight: 1n,
              imageHash,
            },
            // Include a random node leaf (bytes32) to prevent image hash collision
            Hex.random(32),
          ],
        },
        {
          stateProvider,
        },
      )
      // Create the session manager
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
        explicitSigners: [explicitSigner],
      })

      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_FUNCTIONS[0]), // Explicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      const increment = await sessionManager.prepareIncrement(wallet.address, chainId, [call])
      expect(increment).not.toBeNull()
      expect(increment).toBeDefined()

      if (!increment) {
        return
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, [call, increment], provider, chainId)
      await simulateTransaction(provider, transaction, EMITTER_EVENT_TOPICS[0])

      // Repeat call fails because the usage limit has been reached
      try {
        await sessionManager.prepareIncrement(wallet.address, chainId, [call])
        throw new Error('Expected call as no signer supported to fail')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('No signer supported')
      }
    },
    timeout,
  )

  it(
    'signs an ERC20 approve using an explicit session',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      // Create explicit signer
      const explicitPrivateKey = Secp256k1.randomPrivateKey()
      const explicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: explicitPrivateKey }))
      const approveAmount = 10000000n // 10 USDC
      const sessionPermission: Signers.Session.ExplicitParams = {
        chainId,
        valueLimit: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [ERC20PermissionBuilder.buildApprove(USDC_ADDRESS, explicitAddress, approveAmount)],
      }
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermission)
      // Test manually building the session topology
      const sessionTopology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermission,
        signer: explicitSigner.address,
      })
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))

      // Create the wallet
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: [
            // Random explicit signer will randomise the image hash
            {
              type: 'sapient-signer',
              address: Extensions.Dev1.sessions,
              weight: 1n,
              imageHash,
            },
            // Include a random node leaf (bytes32) to prevent image hash collision
            Hex.random(32),
          ],
        },
        {
          stateProvider,
        },
      )
      // Create the session manager
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
        explicitSigners: [explicitSigner],
      })

      const call: Payload.Call = {
        to: USDC_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(AbiFunction.from('function approve(address spender, uint256 amount)'), [
          explicitAddress,
          approveAmount,
        ]),
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      const increment = await sessionManager.prepareIncrement(wallet.address, chainId, [call])
      expect(increment).not.toBeNull()
      expect(increment).toBeDefined()

      if (!increment) {
        return
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, [call, increment], provider, chainId)
      await simulateTransaction(
        provider,
        transaction,
        AbiEvent.encode(
          AbiEvent.from('event Approval(address indexed _owner, address indexed _spender, uint256 _value)'),
        ).topics[0],
      )

      // Repeat call fails because the usage limit has been reached
      try {
        await sessionManager.prepareIncrement(wallet.address, chainId, [call])
        throw new Error('Expected call as no signer supported to fail')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('No signer supported')
      }
    },
    timeout,
  )

  it(
    'signs a payload sending value using an explicit session',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      // Create explicit signer
      const explicitPrivateKey = Secp256k1.randomPrivateKey()
      const explicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: explicitPrivateKey }))
      const sessionPermission: Signers.Session.ExplicitParams = {
        chainId,
        valueLimit: 1000000000000000000n, // 1 ETH
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [PermissionBuilder.for(explicitAddress).forFunction(EMITTER_FUNCTIONS[0]).onlyOnce().build()],
      }
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermission)
      // Test manually building the session topology
      const sessionTopology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermission,
        signer: explicitSigner.address,
      })
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))

      // Create the wallet
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: [
            // Random explicit signer will randomise the image hash
            {
              type: 'sapient-signer',
              address: Extensions.Dev1.sessions,
              weight: 1n,
              imageHash,
            },
            // Include a random node leaf (bytes32) to prevent image hash collision
            Hex.random(32),
          ],
        },
        {
          stateProvider,
        },
      )
      // Force 1 ETH to the wallet
      await provider.request({
        method: 'anvil_setBalance',
        params: [wallet.address, Hex.fromNumber(1000000000000000000n)],
      })
      // Create the session manager
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
        explicitSigners: [explicitSigner],
      })

      const call: Payload.Call = {
        to: explicitAddress,
        value: 1000000000000000000n, // 1 ETH
        data: AbiFunction.encodeData(EMITTER_FUNCTIONS[0]), // Explicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      const increment = await sessionManager.prepareIncrement(wallet.address, chainId, [call])
      expect(increment).not.toBeNull()
      expect(increment).toBeDefined()

      if (!increment) {
        return
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, [call, increment], provider, chainId)
      await simulateTransaction(provider, transaction)

      // Check the balances
      const walletBalance = await provider.request({
        method: 'eth_getBalance',
        params: [wallet.address, 'latest'],
      })
      expect(BigInt(walletBalance)).toBe(0n)
      const explicitAddressBalance = await provider.request({
        method: 'eth_getBalance',
        params: [explicitAddress, 'latest'],
      })
      expect(BigInt(explicitAddressBalance)).toBe(1000000000000000000n)

      // Repeat call fails because the usage limit has been reached
      try {
        await sessionManager.prepareIncrement(wallet.address, chainId, [call])
        throw new Error('Expected call as no signer supported to fail')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('No signer supported')
      }
    },
    timeout,
  )

  it(
    'signs a payload sending two transactions with cumulative rules using an explicit session',
    async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      // Create explicit signer
      const explicitPrivateKey = Secp256k1.randomPrivateKey()
      const explicitAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: explicitPrivateKey }))
      const sessionPermission: Signers.Session.ExplicitParams = {
        chainId,
        valueLimit: 1000000000000000000n, // 1 ETH
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [
          {
            target: explicitAddress,
            rules: [
              // This rule is a hack. The selector "usage" will increment for testing. As we check for greater than or equal,
              // the test will always pass even though it is cumulative.
              {
                cumulative: true,
                operation: Permission.ParameterOperation.GREATER_THAN_OR_EQUAL,
                value: Bytes.fromHex(AbiFunction.getSelector(EMITTER_FUNCTIONS[0]), { size: 32 }),
                offset: 0n,
                mask: Permission.MASK.SELECTOR,
              },
            ],
          },
        ],
      }
      const explicitSigner = new Signers.Session.Explicit(explicitPrivateKey, sessionPermission)
      const sessionTopology = SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(identityAddress), {
        ...sessionPermission,
        signer: explicitSigner.address,
      })
      await stateProvider.saveTree(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))
      const imageHash = GenericTree.hash(SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology))

      // Create the wallet
      const wallet = await Wallet.fromConfiguration(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: [
            {
              type: 'sapient-signer',
              address: Extensions.Dev1.sessions,
              weight: 1n,
              imageHash,
            },
            // Include a random node leaf (bytes32) to prevent image hash collision
            Hex.random(32),
          ],
        },
        {
          stateProvider,
        },
      )
      // Force 1 ETH to the wallet
      await provider.request({
        method: 'anvil_setBalance',
        params: [wallet.address, Hex.fromNumber(1000000000000000000n)],
      })
      // Create the session manager
      const sessionManager = new Signers.SessionManager(wallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
        explicitSigners: [explicitSigner],
      })

      const call: Payload.Call = {
        to: explicitAddress,
        value: 500000000000000000n, // 0.5 ETH
        data: AbiFunction.encodeData(EMITTER_FUNCTIONS[0]), // Explicit emit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      // Do it twice to test cumulative rules
      const increment = await sessionManager.prepareIncrement(wallet.address, chainId, [call, call])
      expect(increment).not.toBeNull()
      expect(increment).toBeDefined()

      if (!increment) {
        return
      }

      // Build, sign and send the transaction
      const transaction = await buildAndSignCall(wallet, sessionManager, [call, call, increment], provider, chainId)
      await simulateTransaction(provider, transaction)

      // Check the balances
      const walletBalance = await provider.request({
        method: 'eth_getBalance',
        params: [wallet.address, 'latest'],
      })
      expect(BigInt(walletBalance)).toBe(0n)
      const explicitAddressBalance = await provider.request({
        method: 'eth_getBalance',
        params: [explicitAddress, 'latest'],
      })
      expect(BigInt(explicitAddressBalance)).toBe(1000000000000000000n)

      // Repeat call fails because the ETH usage limit has been reached
      try {
        await sessionManager.prepareIncrement(wallet.address, chainId, [call])
        throw new Error('Expected call as no signer supported to fail')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('No signer supported')
      }
    },
    timeout,
  )
})
