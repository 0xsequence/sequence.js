import { Signers as CoreSigners, Wallet as CoreWallet, Envelope, Relayer, State } from '../../core/src/index.js'
import { Payload, Permission } from '../../primitives/src/index.js'
import { Sequence } from '../src/index.js'
import { AbiFunction, Address, Bytes, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { beforeEach, describe, it } from 'vitest'
import { CAN_RUN_LIVE, EMITTER_ABI, EMITTER_ADDRESS, PRIVATE_KEY, RPC_URL } from './constants'

describe('Sessions (via Manager)', () => {
  // Shared components
  let provider: Provider.Provider
  let chainId: bigint
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

  beforeEach(async () => {
    // Create provider or use arbitrum sepolia
    let rpcUrl = RPC_URL
    if (!rpcUrl) {
      rpcUrl = 'https://sepolia-rollup.arbitrum.io/rpc'
    }
    provider = Provider.from(
      RpcTransport.fromHttp(rpcUrl, {
        fetchOptions: {
          headers: {
            'x-requested-with': 'XMLHttpRequest',
          },
        },
      }),
    )
    chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

    // Create state provider
    stateProvider = new State.Local.Provider()

    // Create manager
    const opts = Sequence.applyManagerOptionsDefaults({
      stateProvider,
      relayers: [], // No relayers needed for testing
      networks: [
        {
          chainId,
          rpc: rpcUrl,
          name: 'XXX',
          explorer: 'XXX',
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
    const walletAddress = await manager.signUp({
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
      context: opts.context,
      guest: opts.guest,
      // Share the state provider with wdk. In practice this will be the key machine.
      stateProvider,
    })

    dapp = {
      pkStore,
      wallet: coreWallet,
      sessionManager: new CoreSigners.SessionManager(coreWallet, {
        provider,
      }),
    }
  })

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
                value: Bytes.padRight(Bytes.fromHex(AbiFunction.getSelector(EMITTER_ABI[0])), 32),
                offset: 0n,
                mask: Bytes.padRight(Bytes.fromHex('0xffffffff'), 32),
              },
            ],
          },
        ],
      }
      const explicitSigner = new CoreSigners.Session.Explicit(s, permission)
      // Add to manager
      dapp.sessionManager = dapp.sessionManager.withExplicitSigner(explicitSigner)

      // Request the session permissions from the WDK
      const requestId = await wdk.manager.addExplicitSession(dapp.wallet.address, explicitSigner.address, permission)

      // Sign and complete the request
      const sigRequest = await wdk.manager.getSignatureRequest(requestId)
      const identitySigner = sigRequest.signers.find((s) => s.address === wdk.identitySignerAddress)
      if (!identitySigner || identitySigner.status !== 'ready') {
        throw new Error(`Identity signer not found or not ready: ${identitySigner?.status}`)
      }
      const handled = await identitySigner.handle()
      if (!handled) {
        throw new Error('Failed to handle identity signer')
      }
      await wdk.manager.completeSessionUpdate(requestId)

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
      const envelope = await dapp.wallet.prepareTransaction(provider, [call])
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

      // Send the transaction
      if (PRIVATE_KEY) {
        // Build the transaction
        const transaction = await dapp.wallet.buildTransaction(provider, signedEnvelope)
        console.log('tx', transaction)

        //FIXME Replace everything below with some relayer call that runs silently.
        // Currently the WDK needs multiple calls and approval on front end.
        // This isn't the correct why to use sessions.

        // Load the sender
        const senderPk = Hex.from(PRIVATE_KEY as `0x${string}`)
        const pkRelayer = new Relayer.Pk.PkRelayer(senderPk, provider)
        const tx = await pkRelayer.relay(transaction.to, transaction.data, chainId, undefined)
        console.log('Transaction sent', tx)
        await provider.request({ method: 'eth_getTransactionReceipt', params: [tx.opHash] })
      }
    },
    CAN_RUN_LIVE ? { timeout: 60000 } : undefined,
  )
})
