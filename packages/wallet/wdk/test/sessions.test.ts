import { Signers as CoreSigners, Wallet as CoreWallet, Envelope, Relayer, State } from '@0xsequence/wallet-core'
import { Config, Payload, Permission, SessionConfig } from '@0xsequence/wallet-primitives'
import { Sequence } from '@0xsequence/wallet-wdk'
import { AbiFunction, Bytes, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { EMITTER_ABI, EMITTER_ADDRESS, PRIVATE_KEY, RPC_URL } from './constants'
import { describe, it, beforeAll } from 'vitest'

describe('Sessions (via Manager)', () => {
  // Shared components
  let provider: Provider.Provider
  let chainId: bigint
  let stateProvider: State.Provider

  // Wallet webapp components
  let wdk: {
    identitySigner: CoreSigners.Pk.Pk
    manager: Sequence.Manager
  }

  // Dapp components
  let dapp: {
    pkStore: CoreSigners.Pk.Encrypted.EncryptedPksDb
    signerPk: CoreSigners.Pk.Pk
    wallet: CoreWallet
    sessionManager: CoreSigners.SessionManager
  }

  beforeAll(async () => {
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
    const walletAddress = await manager.signUp({
      kind: 'mnemonic',
      mnemonic: identitySignerMnemonic,
    })
    if (!walletAddress) {
      throw new Error('Failed to create wallet')
    }

    // Initialize the wdk components
    wdk = {
      identitySigner: new CoreSigners.Pk.Pk(identitySignerPk),
      manager,
    }

    // Create the pk store and pk
    const pkStore = new CoreSigners.Pk.Encrypted.EncryptedPksDb()
    const e = await pkStore.generateAndStore()
    const s = await pkStore.getEncryptedPkStore(e.address)
    if (!s) {
      throw new Error('Failed to create pk store')
    }

    // Create wallet in core
    const coreWallet = new CoreWallet(walletAddress, {
      context: opts.context,
      // Share the state provider with wdk. In practice this will be the key machine.
      stateProvider,
      guest: opts.guest,
    })

    // Find the session manager configuration for the wallet
    const sessionTopology = await wdk.manager.getSessionTopology(walletAddress)
    const sessionConfigTree = SessionConfig.sessionsTopologyToConfigurationTree(sessionTopology)

    dapp = {
      pkStore,
      signerPk: new CoreSigners.Pk.Pk(s),
      wallet: coreWallet,
      sessionManager: CoreSigners.SessionManager.createFromConfigurationTree(sessionConfigTree, {
        provider,
      }),
    }
  })

  const updateDappItems = async () => {
    const { configuration } = await dapp.wallet.getStatus(provider)

    //FIXME Replace this so that the session manager uses a getStatus function
    // Find the session manager in the old configuration
    const managerLeaf = Config.findSignerLeaf(configuration, dapp.sessionManager.address)
    if (!managerLeaf || !Config.isSapientSignerLeaf(managerLeaf)) {
      throw new Error('Session manager not found in configuration')
    }

    // Recreate the session manager for the updated configuration
    dapp.sessionManager = await CoreSigners.SessionManager.createFromStorage(managerLeaf.imageHash, stateProvider, {
      provider,
    })
  }

  it('should create and sign with an explicit session', async () => {
    // Request the session permissions from the WDK
    const requestId = await wdk.manager.addExplicitSession(dapp.wallet.address, dapp.signerPk.address, {
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
      valueLimit: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
    })

    // Sign and complete the request
    const sigRequest = await wdk.manager.getSignatureRequest(requestId)
    const identitySigner = sigRequest.signers.find((s) => s.address === wdk.identitySigner.address)
    if (!identitySigner || identitySigner.status !== 'ready') {
      throw new Error(`Identity signer not found or not ready: ${identitySigner?.status}`)
    }
    const handled = await identitySigner.handle()
    if (!handled) {
      throw new Error('Failed to handle identity signer')
    }
    await wdk.manager.completeSessionUpdate(requestId)

    // The session is now active, update the configuration in the dapp
    await updateDappItems()

    // Create a call payload
    const call: Payload.Call = {
      to: EMITTER_ADDRESS,
      value: 0n,
      data: Bytes.fromHex(AbiFunction.getSelector(EMITTER_ABI[0])),
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
    const signature = await dapp.sessionManager.signSapient(
      dapp.wallet.address,
      chainId ?? 1n,
      parentedEnvelope,
      dapp.sessionManager.imageHash,
    )
    const sapientSignature: Envelope.SapientSignature = {
      imageHash: dapp.sessionManager.imageHash,
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
  })
})
