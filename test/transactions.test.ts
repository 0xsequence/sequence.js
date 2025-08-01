import { afterEach, describe, expect, it, vi } from 'vitest'
import { Manager, SignerActionable, Transaction, TransactionDefined, TransactionRelayed } from '../src/sequence'
import { Address, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { LOCAL_RPC_URL, newManager } from './constants'
import { Payload } from '@0xsequence/wallet-primitives'

describe('Transactions', () => {
  let manager: Manager | undefined

  afterEach(async () => {
    await manager?.stop()
  })

  it('Should send a transaction from a new wallet', async () => {
    manager = newManager()

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.wallets.has(wallet!)).resolves.toBeTruthy()

    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0xa'],
    })

    const recipient = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: recipient,
        value: 9n,
      },
    ])

    expect(txId).toBeDefined()
    await manager.transactions.define(txId!)

    let tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('defined')

    if (tx.status !== 'defined') {
      throw new Error('Transaction status is not defined')
    }

    expect(tx.relayerOptions.length).toBe(1)
    expect(tx.relayerOptions[0].id).toBeDefined()

    const sigId = await manager.transactions.selectRelayer(txId!, tx.relayerOptions[0].id)
    expect(sigId).toBeDefined()

    tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('formed')

    // Sign using the device signer
    const sigRequest = await manager.signatures.get(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('pending')
    expect(sigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    expect(deviceSigner).toBeDefined()

    await deviceSigner.handle()

    await manager.transactions.relay(txId)

    // Check the balance of the wallet
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [wallet!, 'latest'],
    })
    expect(balance).toBeDefined()
    expect(balance).toBe('0x1')

    // Check the balance of the recipient
    const recipientBalance = await provider.request({
      method: 'eth_getBalance',
      params: [recipient, 'latest'],
    })
    expect(recipientBalance).toBeDefined()
    expect(recipientBalance).toBe('0x9')
  })

  it('Should send a transaction after logging in to a wallet', async () => {
    manager = newManager()
    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({
      mnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.wallets.has(wallet!)).resolves.toBeTruthy()

    // Logout without removing the device
    await manager.wallets.logout(wallet!, { skipRemoveDevice: true })

    // Login to the same wallet
    const loginId = await manager.wallets.login({ wallet: wallet! })
    expect(loginId).toBeDefined()

    // Register the UI for the mnemonic signer
    let signRequests = 0
    let unregisteredUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(mnemonic)
    })

    const loginRequest = await manager.signatures.get(loginId!)
    expect(loginRequest).toBeDefined()
    expect(loginRequest.action).toBe('login')

    const mnemonicSigner = loginRequest.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(mnemonicSigner).toBeDefined()
    expect(mnemonicSigner?.status).toBe('actionable')

    signRequests = 0
    unregisteredUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(mnemonic)
    })

    await (mnemonicSigner as SignerActionable).handle()
    expect(signRequests).toBe(1)
    unregisteredUI()

    await manager.wallets.completeLogin(loginId!)
    expect((await manager.signatures.get(loginId!))?.status).toBe('completed')

    // Set balance for the wallet
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0xa'],
    })

    // Send a transaction
    const recipient = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: recipient,
        value: 9n,
      },
    ])

    expect(txId).toBeDefined()
    await manager.transactions.define(txId!)

    let tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('defined')

    if (tx.status !== 'defined') {
      throw new Error('Transaction status is not defined')
    }

    expect(tx.relayerOptions.length).toBe(1)
    expect(tx.relayerOptions[0].id).toBeDefined()

    const sigId = await manager.transactions.selectRelayer(txId!, tx.relayerOptions[0].id)
    expect(sigId).toBeDefined()

    tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('formed')

    // Sign using the device signer
    const sigRequest = await manager.signatures.get(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('pending')
    expect(sigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    expect(deviceSigner).toBeDefined()

    await deviceSigner.handle()

    await manager.transactions.relay(txId)

    // Check the balance of the wallet
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [wallet!, 'latest'],
    })
    expect(balance).toBeDefined()
    expect(balance).toBe('0x1')

    // Check the balance of the recipient
    const recipientBalance = await provider.request({
      method: 'eth_getBalance',
      params: [recipient, 'latest'],
    })
    expect(recipientBalance).toBeDefined()
    expect(recipientBalance).toBe('0x9')
  })

  it('Should call onTransactionsUpdate when a new transaction is requested', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.wallets.has(wallet!)).resolves.toBeTruthy()

    let transactions: Transaction[] = []
    let calledTimes = 0
    manager.transactions.onTransactionsUpdate((txs) => {
      transactions = txs
      calledTimes++
    })

    const to = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to,
        value: 9n,
      },
    ])

    expect(txId).toBeDefined()
    await manager.transactions.define(txId!)

    expect(calledTimes).toBe(1)
    expect(transactions.length).toBe(1)
    expect(transactions[0].status).toBe('requested')
    expect(transactions[0].wallet).toBe(wallet!)
    expect(transactions[0].requests.length).toBe(1)
    expect(transactions[0].requests[0].to).toEqual(to)
    expect(transactions[0].requests[0].value).toEqual(9n)
  })

  it('Should call onTransactionUpdate when a transaction is defined, relayer selected and relayed', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.wallets.has(wallet!)).resolves.toBeTruthy()

    const to = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to,
      },
    ])

    let tx: Transaction | undefined
    let calledTimes = 0
    manager.transactions.onTransactionUpdate(txId!, (t) => {
      tx = t
      calledTimes++
    })

    expect(txId).toBeDefined()
    await manager.transactions.define(txId!)

    while (calledTimes < 1) {
      await new Promise((resolve) => setTimeout(resolve, 1))
    }

    expect(calledTimes).toBe(1)
    expect(tx).toBeDefined()
    expect(tx!.status).toBe('defined')
    expect(tx!.wallet).toBe(wallet!)
    expect(tx!.requests.length).toBe(1)
    expect(tx!.requests[0].to).toEqual(to)
    expect(tx!.requests[0].value).toBeUndefined()
    expect(tx!.requests[0].gasLimit).toBeUndefined()
    expect(tx!.requests[0].data).toBeUndefined()

    const sigId = await manager.transactions.selectRelayer(txId!, (tx as TransactionDefined).relayerOptions[0].id)
    expect(sigId).toBeDefined()

    while (calledTimes < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1))
    }

    expect(calledTimes).toBe(2)
    expect(tx!.status).toBe('formed')

    // Sign the transaction
    const sigRequest = await manager.signatures.get(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('pending')
    expect(sigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    await deviceSigner.handle()

    await manager.transactions.relay(txId!)
    while (calledTimes < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1))
    }

    expect(calledTimes).toBe(3)
    expect(tx!.status).toBe('relayed')
    expect((tx! as TransactionRelayed).opHash).toBeDefined()
  })

  it('Should delete an existing transaction before it is defined', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const to = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to,
      },
    ])

    expect(txId).toBeDefined()

    await manager.transactions.delete(txId!)
    await expect(manager.transactions.get(txId!)).rejects.toThrow()
  })

  it('Should delete an existing transaction before the relayer is selected', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const to = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to,
      },
    ])

    expect(txId).toBeDefined()

    await manager.transactions.define(txId!)

    await manager.transactions.delete(txId!)
    await expect(manager.transactions.get(txId!)).rejects.toThrow()
  })

  it('Should delete an existing transaction before it is relayed', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const to = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to,
      },
    ])

    expect(txId).toBeDefined()

    await manager.transactions.define(txId!)

    const tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx!.status).toBe('defined')

    const sigId = await manager.transactions.selectRelayer(txId!, (tx as TransactionDefined).relayerOptions[0].id)
    expect(sigId).toBeDefined()

    await manager.transactions.delete(txId!)
    await expect(manager.transactions.get(txId!)).rejects.toThrow()

    // Signature request should be canceled
    const sigRequest = await manager.signatures.get(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('cancelled')
  })

  it('Should update the onchain configuration when a transaction is sent', async () => {
    const manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    // Add a recovery signer, just to change the configuration
    const rSigId = await manager.recovery.addSigner(wallet!, Address.from(Hex.random(20)))
    expect(rSigId).toBeDefined()

    // Sign using the device signer
    const rSigRequest = await manager.signatures.get(rSigId!)
    expect(rSigRequest).toBeDefined()
    expect(rSigRequest.status).toBe('pending')
    expect(rSigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const rDeviceSigner = rSigRequest.signers.find((s) => s.status === 'ready')!
    await rDeviceSigner.handle()

    await expect(manager.wallets.isUpdatedOnchain(wallet!, 42161n)).resolves.toBeTruthy()

    await manager.recovery.completeUpdate(rSigId!)

    // It should no longer be updated onchain
    await expect(manager.wallets.isUpdatedOnchain(wallet!, 42161n)).resolves.toBeFalsy()

    const randomAddress = Address.from(Hex.random(20))
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: randomAddress,
      },
    ])

    await manager.transactions.define(txId!)

    let tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx!.status).toBe('defined')

    // The transaction should contain the one that we want to perform
    // and a configuration update
    expect((tx.envelope.payload as Payload.Calls).calls.length).toBe(2)

    // The first call should be to the random address
    // and the second one should be a call to self
    const call1 = (tx.envelope.payload as Payload.Calls).calls[0]
    const call2 = (tx.envelope.payload as Payload.Calls).calls[1]
    expect(call1.to).toEqual(randomAddress)
    expect(call2.to).toEqual(wallet)

    const sigId = await manager.transactions.selectRelayer(txId!, (tx as TransactionDefined).relayerOptions[0].id)
    expect(sigId).toBeDefined()

    tx = await manager.transactions.get(txId!)
    expect(tx).toBeDefined()
    expect(tx!.status).toBe('formed')

    // Sign using the device signer
    const sigRequest = await manager.signatures.get(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('pending')
    expect(sigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    await deviceSigner.handle()

    await manager.transactions.relay(txId!)

    // wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // The onchain configuration should be updated
    await expect(manager.wallets.isUpdatedOnchain(wallet!, 42161n)).resolves.toBeTruthy()
  })

  it('Should reject unsafe transactions in safe mode (call to self)', async () => {
    const manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId1 = manager.transactions.request(wallet!, 42161n, [
      {
        to: wallet!,
      },
    ])

    await expect(txId1).rejects.toThrow()
  })

  it('Should allow transactions to self in unsafe mode', async () => {
    const manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId1 = await manager.transactions.request(
      wallet!,
      42161n,
      [
        {
          to: wallet!,
        },
      ],
      {
        unsafe: true,
      },
    )

    expect(txId1).toBeDefined()
  })

  // === NEW TESTS FOR IMPROVED COVERAGE ===

  it('Should verify transactions list functionality through callbacks', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    let transactionsList: Transaction[] = []
    let updateCount = 0

    // Use onTransactionsUpdate to verify list functionality
    const unsubscribe = manager.transactions.onTransactionsUpdate((txs) => {
      transactionsList = txs
      updateCount++
    })

    // Initially should be empty
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(transactionsList).toEqual([])

    // Create a transaction
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    // Wait for callback
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Should now have one transaction
    expect(transactionsList.length).toBe(1)
    expect(transactionsList[0].id).toBe(txId)
    expect(transactionsList[0].status).toBe('requested')
    expect(transactionsList[0].wallet).toBe(wallet)

    unsubscribe()
  })

  it('Should trigger onTransactionsUpdate callback immediately when trigger=true', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    let callCount = 0
    let receivedTransactions: Transaction[] = []

    // Create a transaction first
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    // Subscribe with trigger=true should call immediately
    const unsubscribe = manager.transactions.onTransactionsUpdate((txs) => {
      callCount++
      receivedTransactions = txs
    }, true)

    // Give time for async callback
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(callCount).toBe(1)
    expect(receivedTransactions.length).toBe(1)
    expect(receivedTransactions[0].id).toBe(txId)

    unsubscribe()
  })

  it('Should trigger onTransactionUpdate callback immediately when trigger=true', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    let callCount = 0
    let receivedTransaction: Transaction | undefined

    // Subscribe with trigger=true should call immediately
    const unsubscribe = manager.transactions.onTransactionUpdate(
      txId,
      (tx) => {
        callCount++
        receivedTransaction = tx
      },
      true,
    )

    // Give time for async callback
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(callCount).toBe(1)
    expect(receivedTransaction).toBeDefined()
    expect(receivedTransaction!.id).toBe(txId)
    expect(receivedTransaction!.status).toBe('requested')

    unsubscribe()
  })

  it('Should handle define with nonce changes', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    // Define with custom nonce
    await manager.transactions.define(txId, {
      nonce: 999n,
    })

    const tx = await manager.transactions.get(txId)
    expect(tx.status).toBe('defined')
    expect(tx.envelope.payload.nonce).toBe(999n)
  })

  it('Should handle define with space changes', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    // Define with custom space
    await manager.transactions.define(txId, {
      space: 555n,
    })

    const tx = await manager.transactions.get(txId)
    expect(tx.status).toBe('defined')
    expect(tx.envelope.payload.space).toBe(555n)
  })

  it('Should handle define with gas limit changes', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
      {
        to: Address.from(Hex.random(20)),
        value: 200n,
      },
    ])

    // Define with custom gas limits
    await manager.transactions.define(txId, {
      calls: [{ gasLimit: 50000n }, { gasLimit: 75000n }],
    })

    const tx = await manager.transactions.get(txId)
    expect(tx.status).toBe('defined')
    expect(tx.envelope.payload.calls[0].gasLimit).toBe(50000n)
    expect(tx.envelope.payload.calls[1].gasLimit).toBe(75000n)
  })

  it('Should throw error when defining transaction not in requested state', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    // Define once
    await manager.transactions.define(txId)

    // Try to define again - should throw error
    await expect(manager.transactions.define(txId)).rejects.toThrow(`Transaction ${txId} is not in the requested state`)
  })

  it('Should throw error when call count mismatch in define changes', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    // Try to define with wrong number of gas limit changes
    await expect(
      manager.transactions.define(txId, {
        calls: [
          { gasLimit: 50000n },
          { gasLimit: 75000n }, // Too many calls
        ],
      }),
    ).rejects.toThrow(`Invalid number of calls for transaction ${txId}`)
  })

  it('Should handle transaction requests with custom options', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const customSpace = 12345n
    const txId = await manager.transactions.request(
      wallet!,
      42161n,
      [
        {
          to: Address.from(Hex.random(20)),
          value: 100n,
          data: '0x1234',
          gasLimit: 21000n,
        },
      ],
      {
        source: 'test-dapp',
        noConfigUpdate: true,
        space: customSpace,
      },
    )

    const tx = await manager.transactions.get(txId)
    expect(tx.status).toBe('requested')
    expect(tx.source).toBe('test-dapp')
    expect(tx.envelope.payload.space).toBe(customSpace)
    expect(tx.requests[0].data).toBe('0x1234')
    expect(tx.requests[0].gasLimit).toBe(21000n)
  })

  it('Should throw error for unknown network', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const unknownChainId = 999999n
    await expect(
      manager.transactions.request(wallet!, unknownChainId, [
        {
          to: Address.from(Hex.random(20)),
          value: 100n,
        },
      ]),
    ).rejects.toThrow(`Network not found for ${unknownChainId}`)
  })

  it('Should handle transactions with default values', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        // No value, data, or gasLimit - should use defaults
      },
    ])

    const tx = await manager.transactions.get(txId)
    expect(tx.status).toBe('requested')
    expect(tx.envelope.payload.calls[0].value).toBe(0n)
    expect(tx.envelope.payload.calls[0].data).toBe('0x')
    expect(tx.envelope.payload.calls[0].gasLimit).toBe(0n)
    expect(tx.envelope.payload.calls[0].delegateCall).toBe(false)
    expect(tx.envelope.payload.calls[0].onlyFallback).toBe(false)
    expect(tx.envelope.payload.calls[0].behaviorOnError).toBe('revert')
  })

  it('Should handle relay with signature ID instead of transaction ID', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0xa'],
    })

    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 1n,
      },
    ])

    await manager.transactions.define(txId)
    const tx = await manager.transactions.get(txId)

    if (tx.status !== 'defined') {
      throw new Error('Transaction not defined')
    }

    const sigId = await manager.transactions.selectRelayer(txId, tx.relayerOptions[0].id)

    // Sign the transaction
    const sigRequest = await manager.signatures.get(sigId)
    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    await deviceSigner.handle()

    // Relay using signature ID instead of transaction ID
    await manager.transactions.relay(sigId)

    const finalTx = await manager.transactions.get(txId)
    expect(finalTx.status).toBe('relayed')
  })

  it('Should get transaction and throw error for non-existent transaction', async () => {
    manager = newManager()
    const nonExistentId = 'non-existent-transaction-id'

    await expect(manager.transactions.get(nonExistentId)).rejects.toThrow(`Transaction ${nonExistentId} not found`)
  })

  it.skip('Should handle multiple transactions and subscriptions correctly', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    let allTransactionsUpdates = 0
    let allTransactions: Transaction[] = []

    const unsubscribeAll = manager.transactions.onTransactionsUpdate((txs) => {
      allTransactionsUpdates++
      allTransactions = txs
    })

    // Create first transaction
    const txId1 = await manager.transactions.request(wallet!, 42161n, [
      { to: Address.from(Hex.random(20)), value: 100n },
    ])

    // Create second transaction
    const txId2 = await manager.transactions.request(wallet!, 42161n, [
      { to: Address.from(Hex.random(20)), value: 200n },
    ])

    // Wait for callbacks
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(allTransactionsUpdates).toBeGreaterThanOrEqual(2)
    expect(allTransactions.length).toBe(2)
    expect(allTransactions.map((tx) => tx.id)).toContain(txId1)
    expect(allTransactions.map((tx) => tx.id)).toContain(txId2)

    // Test individual transaction subscriptions
    let tx1Updates = 0
    let tx2Updates = 0

    const unsubscribe1 = manager.transactions.onTransactionUpdate(txId1, () => {
      tx1Updates++
    })

    const unsubscribe2 = manager.transactions.onTransactionUpdate(txId2, () => {
      tx2Updates++
    })

    // Update only first transaction
    await manager.transactions.define(txId1)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(tx1Updates).toBe(1)
    expect(tx2Updates).toBe(0)

    // Update second transaction
    await manager.transactions.define(txId2)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(tx1Updates).toBe(1)
    expect(tx2Updates).toBe(1)

    // Cleanup subscriptions
    unsubscribeAll()
    unsubscribe1()
    unsubscribe2()
  })

  it('Should handle transaction source defaults', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    // Request without source
    const txId = await manager.transactions.request(wallet!, 42161n, [
      {
        to: Address.from(Hex.random(20)),
        value: 100n,
      },
    ])

    const tx = await manager.transactions.get(txId)
    expect(tx.source).toBe('unknown')
  })
})
