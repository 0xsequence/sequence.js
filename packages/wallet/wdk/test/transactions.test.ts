import { afterEach, describe, expect, it } from 'vitest'
import { Manager, SignerActionable } from '../src/sequence'
import { Address, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { LOCAL_RPC_URL, newManager } from './constants'

describe('Transactions', () => {
  let manager: Manager | undefined

  afterEach(async () => {
    await manager?.stop()
  })

  it('Should send a transaction from a new wallet', async () => {
    manager = newManager()
    const wallet = await manager.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.hasWallet(wallet!)).resolves.toBeTruthy()

    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0xa'],
    })

    const recipient = Address.from(Hex.random(20))
    const txId = await manager.requestTransaction(wallet!, 42161n, [
      {
        to: recipient,
        value: 9n,
      },
    ])

    expect(txId).toBeDefined()
    await manager.defineTransaction(txId!)

    let tx = await manager.getTransaction(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('defined')

    if (tx.status !== 'defined') {
      throw new Error('Transaction status is not defined')
    }

    expect(tx.relayerOptions.length).toBe(1)
    expect(tx.relayerOptions[0].id).toBeDefined()

    const sigId = await manager.selectTransactionRelayer(txId!, tx.relayerOptions[0].id)
    expect(sigId).toBeDefined()

    tx = await manager.getTransaction(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('formed')

    // Sign using the device signer
    const sigRequest = await manager.getSignatureRequest(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('pending')
    expect(sigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    expect(deviceSigner).toBeDefined()

    await deviceSigner.handle()

    await manager.relayTransaction(txId)

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
    const wallet = await manager.signUp({
      mnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.hasWallet(wallet!)).resolves.toBeTruthy()

    // Logout without removing the device
    await manager.logout(wallet!, { skipRemoveDevice: true })

    // Login to the same wallet
    const loginId = await manager.login({ wallet: wallet! })
    expect(loginId).toBeDefined()

    // Register the UI for the mnemonic signer
    let signRequests = 0
    let unregisteredUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(mnemonic)
    })

    const loginRequest = await manager.getSignatureRequest(loginId!)
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

    await manager.completeLogin(loginId!)
    expect((await manager.getSignatureRequest(loginId!))?.status).toBe('completed')

    // Set balance for the wallet
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0xa'],
    })

    // Send a transaction
    const recipient = Address.from(Hex.random(20))
    const txId = await manager.requestTransaction(wallet!, 42161n, [
      {
        to: recipient,
        value: 9n,
      },
    ])

    expect(txId).toBeDefined()
    await manager.defineTransaction(txId!)

    let tx = await manager.getTransaction(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('defined')

    if (tx.status !== 'defined') {
      throw new Error('Transaction status is not defined')
    }

    expect(tx.relayerOptions.length).toBe(1)
    expect(tx.relayerOptions[0].id).toBeDefined()

    const sigId = await manager.selectTransactionRelayer(txId!, tx.relayerOptions[0].id)
    expect(sigId).toBeDefined()

    tx = await manager.getTransaction(txId!)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('formed')

    // Sign using the device signer
    const sigRequest = await manager.getSignatureRequest(sigId!)
    expect(sigRequest).toBeDefined()
    expect(sigRequest.status).toBe('pending')
    expect(sigRequest.signers.filter((s) => s.status === 'ready').length).toBe(1)

    const deviceSigner = sigRequest.signers.find((s) => s.status === 'ready')!
    expect(deviceSigner).toBeDefined()

    await deviceSigner.handle()

    await manager.relayTransaction(txId)

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
})
