import { AbiFunction, Address, Bytes, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Signers as CoreSigners, Wallet as CoreWallet, Envelope, Relayer, State } from '../../core/src/index.js'
import { Attestation, Constants, Extensions, Network, Payload, Permission } from '../../primitives/src/index.js'
import { Sequence } from '../src/index.js'
import { CAN_RUN_LIVE, EMITTER_ABI, EMITTER_ADDRESS, PRIVATE_KEY, RPC_URL } from './constants'

describe('Sessions (via Manager)', () => {
  // Shared components
  let provider: Provider.Provider
  let chainId: number
  let stateProvider: State.Provider

  // Wallet webapp components
  let wdk: {
    identitySignerAddress: Address.Address
    manager: Sequence.Manager
  }

  // Dapp components
  let dapp: {
    pkStore: CoreSigners.Pk.Encrypted.EncryptedPksDb
    wallet: CoreWallet
    sessionManager: CoreSigners.SessionManager
  }

  const setupExplicitSession = async (
    sessionAddress: Address.Address,
    permissions: Permission.SessionPermissions,
    isModify = false,
  ) => {
    let requestId: string
    if (isModify) {
      requestId = await wdk.manager.sessions.modifyExplicitSession(dapp.wallet.address, sessionAddress, permissions)
    } else {
      requestId = await wdk.manager.sessions.addExplicitSession(dapp.wallet.address, sessionAddress, permissions)
    }

    // Sign and complete the request
    const sigRequest = await wdk.manager.signatures.get(requestId)
    const identitySigner = sigRequest.signers.find((s) => Address.isEqual(s.address, wdk.identitySignerAddress))
    if (!identitySigner || (identitySigner.status !== 'actionable' && identitySigner.status !== 'ready')) {
      throw new Error(`Identity signer not found or not ready/actionable: ${identitySigner?.status}`)
    }
    const handled = await identitySigner.handle()
    if (!handled) {
      throw new Error('Failed to handle identity signer')
    }
    await wdk.manager.sessions.complete(requestId)
  }

  beforeEach(async () => {
    // Create provider or use arbitrum sepolia
    if (RPC_URL) {
      provider = Provider.from(
        RpcTransport.fromHttp(RPC_URL, {
          fetchOptions: {
            headers: {
              'x-requested-with': 'XMLHttpRequest',
            },
          },
        }),
      )
      chainId = Number(await provider.request({ method: 'eth_chainId' }))
    } else {
      provider = vi.mocked<Provider.Provider>({
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
      })
      chainId = Network.ChainId.MAINNET
    }

    // Create state provider
    stateProvider = new State.Local.Provider()

    // Create manager
    const opts = Sequence.applyManagerOptionsDefaults({
      stateProvider,
      relayers: [], // No relayers needed for testing
      networks: [
        {
          chainId,
          type: Network.NetworkType.MAINNET,
          rpcUrl: RPC_URL ?? 'XXX',
          name: 'XXX',
          blockExplorer: { url: 'XXX' },
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
        },
      ],
    })

    // Create manager
    const manager = new Sequence.Manager(opts)

    // Use a mnemonic to create the wallet
    const identitySignerMnemonic = Mnemonic.random(Mnemonic.english)
    const identitySignerPk = Mnemonic.toPrivateKey(identitySignerMnemonic, { as: 'Hex' })
    const identitySignerAddress = new CoreSigners.Pk.Pk(identitySignerPk).address
    const walletAddress = await manager.wallets.signUp({
      kind: 'mnemonic',
      mnemonic: identitySignerMnemonic,
      noGuard: true,
      noSessionManager: false,
    })
    if (!walletAddress) {
      throw new Error('Failed to create wallet')
    }

    // Initialize the wdk components
    wdk = {
      identitySignerAddress,
      manager,
    }
    manager.registerMnemonicUI(async (respond) => {
      await respond(identitySignerMnemonic)
    })

    // Create the pk store and pk
    const pkStore = new CoreSigners.Pk.Encrypted.EncryptedPksDb()

    // Create wallet in core
    const coreWallet = new CoreWallet(walletAddress, {
      guest: opts.guest,
      // Share the state provider with wdk. In practice this will be the key machine.
      stateProvider,
    })

    dapp = {
      pkStore,
      wallet: coreWallet,
      sessionManager: new CoreSigners.SessionManager(coreWallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
      }),
    }
  })

  const signAndSend = async (call: Payload.Call) => {
    const envelope = await dapp.wallet.prepareTransaction(provider, [call], { noConfigUpdate: true })
    const parentedEnvelope: Payload.Parented = {
      ...envelope.payload,
      parentWallets: [dapp.wallet.address],
    }

    // Sign the envelope
    const sessionImageHash = await dapp.sessionManager.imageHash
    if (!sessionImageHash) {
      throw new Error('Session image hash not found')
    }
    const signature = await dapp.sessionManager.signSapient(
      dapp.wallet.address,
      chainId ?? 1n,
      parentedEnvelope,
      sessionImageHash,
    )
    const sapientSignature: Envelope.SapientSignature = {
      imageHash: sessionImageHash,
      signature,
    }
    const signedEnvelope = Envelope.toSigned(envelope, [sapientSignature])

    // Build the transaction
    const transaction = await dapp.wallet.buildTransaction(provider, signedEnvelope)
    console.log('tx', transaction)

    // Send the transaction
    if (CAN_RUN_LIVE && PRIVATE_KEY) {
      // Load the sender
      const senderPk = Hex.from(PRIVATE_KEY as `0x${string}`)
      const pkRelayer = new Relayer.Standard.PkRelayer(senderPk, provider)
      const tx = await pkRelayer.relay(transaction.to, transaction.data, chainId, undefined)
      console.log('Transaction sent', tx)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [tx.opHash] })
      console.log('Transaction receipt', receipt)
      return tx.opHash
    }
  }

  it(
    'should add the session manager leaf when not present',
    async () => {
      // Recreate the wallet specifically for this test
      const identitySignerMnemonic = Mnemonic.random(Mnemonic.english)
      const identitySignerPk = Mnemonic.toPrivateKey(identitySignerMnemonic, { as: 'Hex' })
      const identitySignerAddress = new CoreSigners.Pk.Pk(identitySignerPk).address
      const walletAddress = await wdk.manager.wallets.signUp({
        kind: 'mnemonic',
        mnemonic: identitySignerMnemonic,
        noGuard: true,
        noSessionManager: true,
      })
      if (!walletAddress) {
        throw new Error('Failed to create wallet')
      }

      // Initialize the wdk components
      wdk.identitySignerAddress = identitySignerAddress
      wdk.manager.registerMnemonicUI(async (respond) => {
        await respond(identitySignerMnemonic)
      })

      // Create wallet in core
      const coreWallet = new CoreWallet(walletAddress, {
        stateProvider,
      })

      dapp.wallet = coreWallet
      dapp.sessionManager = new CoreSigners.SessionManager(coreWallet, {
        provider,
        sessionManagerAddress: Extensions.Dev1.sessions,
      })

      // At this point the wallet should NOT have a session topology
      expect(wdk.manager.sessions.getTopology(walletAddress)).rejects.toThrow('Session manager not found')

      // Create the explicit session signer
      const e = await dapp.pkStore.generateAndStore()
      const s = await dapp.pkStore.getEncryptedPkStore(e.address)
      if (!s) {
        throw new Error('Failed to create pk store')
      }
      const permission: Permission.SessionPermissions = {
        signer: e.address,
        chainId,
        valueLimit: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [
          {
            target: EMITTER_ADDRESS,
            rules: [],
          },
        ],
      }
      const explicitSigner = new CoreSigners.Session.Explicit(s, permission)
      // Add to manager
      dapp.sessionManager = dapp.sessionManager.withExplicitSigner(explicitSigner)

      await setupExplicitSession(explicitSigner.address, permission)

      // Create a call payload
      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_ABI[0]),
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      if (!RPC_URL) {
        // Configure mock provider
        ;(provider as any).request.mockImplementation(({ method, params }) => {
          if (method === 'eth_chainId') {
            return Promise.resolve(chainId.toString())
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.GET_IMPLEMENTATION)) {
            // Undeployed wallet
            return Promise.resolve('0x')
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.READ_NONCE, [0n])) {
            // Nonce is 0
            return Promise.resolve('0x00')
          }
        })
      }

      // Sign and send the transaction
      await signAndSend(call)
    },
    PRIVATE_KEY || RPC_URL ? { timeout: 60000 } : undefined,
  )

  it(
    'should create and sign with an explicit session',
    async () => {
      // Create the explicit session signer
      const e = await dapp.pkStore.generateAndStore()
      const s = await dapp.pkStore.getEncryptedPkStore(e.address)
      if (!s) {
        throw new Error('Failed to create pk store')
      }
      const permission: Permission.SessionPermissions = {
        signer: e.address,
        chainId,
        valueLimit: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [
          {
            target: EMITTER_ADDRESS,
            rules: [
              {
                // Require the explicitEmit selector
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.fromHex(AbiFunction.getSelector(EMITTER_ABI[0]), { size: 32 }),
                offset: 0n,
                mask: Bytes.fromHex('0xffffffff', { size: 32 }),
              },
            ],
          },
        ],
      }
      const explicitSigner = new CoreSigners.Session.Explicit(s, permission)
      // Add to manager
      dapp.sessionManager = dapp.sessionManager.withExplicitSigner(explicitSigner)

      await setupExplicitSession(explicitSigner.address, permission)

      // Create a call payload
      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_ABI[0]),
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      if (!RPC_URL) {
        // Configure mock provider
        ;(provider as any).request.mockImplementation(({ method, params }) => {
          if (method === 'eth_chainId') {
            return Promise.resolve(chainId.toString())
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.GET_IMPLEMENTATION)) {
            // Undeployed wallet
            return Promise.resolve('0x')
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.READ_NONCE, [0n])) {
            // Nonce is 0
            return Promise.resolve('0x00')
          }
        })
      }

      // Sign and send the transaction
      await signAndSend(call)
    },
    PRIVATE_KEY || RPC_URL ? { timeout: 60000 } : undefined,
  )

  it(
    'should modify an explicit session permission',
    async () => {
      // First we create the explicit sessions signer
      const e = await dapp.pkStore.generateAndStore()
      const s = await dapp.pkStore.getEncryptedPkStore(e.address)
      if (!s) {
        throw new Error('Failed to create pk store')
      }
      // Create the initial permissions
      let permission: Permission.SessionPermissions = {
        signer: e.address,
        chainId,
        valueLimit: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        permissions: [
          {
            target: EMITTER_ADDRESS,
            rules: [
              {
                // Require the explicitEmit selector
                cumulative: false,
                operation: Permission.ParameterOperation.EQUAL,
                value: Bytes.fromHex(AbiFunction.getSelector(EMITTER_ABI[0]), { size: 32 }),
                offset: 0n,
                mask: Bytes.fromHex('0xffffffff', { size: 32 }),
              },
            ],
          },
        ],
      }
      const explicitSigner = new CoreSigners.Session.Explicit(s, permission)
      // Add to manager
      dapp.sessionManager = dapp.sessionManager.withExplicitSigner(explicitSigner)

      await setupExplicitSession(explicitSigner.address, permission)

      // Create a call payload
      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_ABI[0]),
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      if (!RPC_URL) {
        // Configure mock provider
        ;(provider as any).request.mockImplementation(({ method, params }) => {
          if (method === 'eth_chainId') {
            return Promise.resolve(chainId.toString())
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.GET_IMPLEMENTATION)) {
            // Undeployed wallet
            return Promise.resolve('0x')
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.READ_NONCE, [0n])) {
            // Nonce is 0
            return Promise.resolve('0x00')
          }
        })
      }

      // Sign and send the transaction
      await signAndSend(call)

      // Now we modify the permissions target contract to zero address
      // This should cause any session call to the EMITTER_ADDRESS contract to fail
      permission.permissions[0].target = '0x0000000000000000000000000000000000000000'

      await setupExplicitSession(explicitSigner.address, permission, true)

      // Sign and send the transaction
      // Should fail with 'No signer supported for call'
      await expect(signAndSend(call)).rejects.toThrow('No signer supported for call')
    },
    PRIVATE_KEY || RPC_URL ? { timeout: 60000 } : undefined,
  )

  it(
    'should create and sign with an implicit session',
    async () => {
      // Create the implicit session signer
      const e = await dapp.pkStore.generateAndStore()
      const s = await dapp.pkStore.getEncryptedPkStore(e.address)
      if (!s) {
        throw new Error('Failed to create pk store')
      }

      // Request the session authorization from the WDK
      const requestId = await wdk.manager.sessions.prepareAuthorizeImplicitSession(dapp.wallet.address, e.address, {
        target: 'https://example.com',
      })

      // Sign the request (Wallet UI action)
      const sigRequest = await wdk.manager.signatures.get(requestId)
      const identitySigner = sigRequest.signers[0]
      if (!identitySigner || (identitySigner.status !== 'actionable' && identitySigner.status !== 'ready')) {
        throw new Error(`Identity signer not found or not ready/actionable: ${identitySigner?.status}`)
      }
      const handled = await identitySigner.handle()
      if (!handled) {
        throw new Error('Failed to handle identity signer')
      }

      // Complete the request
      const { attestation, signature: identitySignature } =
        await wdk.manager.sessions.completeAuthorizeImplicitSession(requestId)

      // Load the implicit signer
      const implicitSigner = new CoreSigners.Session.Implicit(
        s,
        attestation,
        identitySignature,
        dapp.sessionManager.address,
      )
      dapp.sessionManager = dapp.sessionManager.withImplicitSigner(implicitSigner)

      // Create a call payload
      const call: Payload.Call = {
        to: EMITTER_ADDRESS,
        value: 0n,
        data: AbiFunction.encodeData(EMITTER_ABI[1]), // implicitEmit
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }

      if (!RPC_URL) {
        // Configure mock provider
        ;(provider as any).request.mockImplementation(({ method, params }) => {
          if (method === 'eth_chainId') {
            return Promise.resolve(chainId.toString())
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.GET_IMPLEMENTATION)) {
            // Undeployed wallet
            return Promise.resolve('0x')
          }
          if (method === 'eth_call' && params[0].data === AbiFunction.encodeData(Constants.READ_NONCE, [0n])) {
            // Nonce is 0
            return Promise.resolve('0x00')
          }
          if (
            method === 'eth_call' &&
            Address.isEqual(params[0].from, dapp.sessionManager.address) &&
            Address.isEqual(params[0].to, call.to)
          ) {
            // Implicit request simulation result
            const expectedResult = Bytes.toHex(
              Attestation.generateImplicitRequestMagic(attestation, dapp.wallet.address),
            )
            return Promise.resolve(expectedResult)
          }
        })
      }

      // Sign and send the transaction
      await signAndSend(call)
    },
    PRIVATE_KEY || RPC_URL ? { timeout: 60000 } : undefined,
  )
})
