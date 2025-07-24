import { afterEach, describe, expect, it } from 'vitest'
import { Manager, SignerActionable, Transaction, TransactionDefined, TransactionRelayed } from '../src/sequence'
import { Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { LOCAL_RPC_URL, newManager } from './constants'
import { Address, Payload } from '@0xsequence/wallet-primitives'

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

    const recipient = Address.checksum(Hex.random(20))
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
    const recipient = Address.checksum(Hex.random(20))
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

    const to = Address.checksum(Hex.random(20))
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

    const to = Address.checksum(Hex.random(20))
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

    const to = Address.checksum(Hex.random(20))
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

    const to = Address.checksum(Hex.random(20))
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

    const to = Address.checksum(Hex.random(20))
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
    const rSigId = await manager.recovery.addSigner(wallet!, Address.checksum(Hex.random(20)))
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

    const randomAddress = Address.checksum(Hex.random(20))
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
})
