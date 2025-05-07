import { afterEach, describe, expect, it } from 'vitest'
import { Manager, SignerActionable, SignerReady } from '../src/sequence'
import { Mnemonic } from 'ox'
import { newManager } from './constants'

describe('Wallets', () => {
  let manager: Manager | undefined

  afterEach(async () => {
    await manager?.stop()
  })

  it('Should create a new wallet using a mnemonic', async () => {
    manager = newManager()
    const wallet = await manager.signUp({ mnemonic: Mnemonic.random(Mnemonic.english), kind: 'mnemonic' })
    expect(wallet).toBeDefined()
  })

  it('Should logout from a wallet using the login key', async () => {
    const manager = newManager()
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.signUp({ mnemonic: loginMnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    const wallets = await manager.listWallets()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)

    const requestId = await manager.logout(wallet!)
    expect(requestId).toBeDefined()

    let signRequests = 0
    const unregistedUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(loginMnemonic)
    })

    const request = await manager.getSignatureRequest(requestId)
    expect(request).toBeDefined()
    expect(request.action).toBe('logout')

    const loginSigner = request.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(loginSigner).toBeDefined()
    expect(loginSigner?.status).toBe('actionable')

    const result = await (loginSigner as SignerActionable).handle()
    expect(result).toBe(true)

    expect(signRequests).toBe(1)
    unregistedUI()

    await manager.completeLogout(requestId)
    expect((await manager.getSignatureRequest(requestId))?.status).toBe('completed')
    const wallets2 = await manager.listWallets()
    expect(wallets2.length).toBe(0)
  })

  it('Should logout from a wallet using the device key', async () => {
    const manager = newManager()
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.signUp({ mnemonic: loginMnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    const wallets = await manager.listWallets()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)

    const requestId = await manager.logout(wallet!)
    expect(requestId).toBeDefined()

    const request = await manager.getSignatureRequest(requestId)
    expect(request).toBeDefined()
    expect(request.action).toBe('logout')

    const deviceSigner = request.signers.find((signer) => signer.handler?.kind === 'local-device')
    expect(deviceSigner).toBeDefined()
    expect(deviceSigner?.status).toBe('ready')

    const result = await (deviceSigner as SignerReady).handle()
    expect(result).toBe(true)

    await manager.completeLogout(requestId)
    expect((await manager.getSignatureRequest(requestId))?.status).toBe('completed')
    const wallets2 = await manager.listWallets()
    expect(wallets2.length).toBe(0)
  })

  it('Should login to an existing wallet using the mnemonic signer', async () => {
    manager = newManager()
    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Clear the storage without logging out
    await manager.stop()

    manager = newManager(undefined, undefined, 'device-2')
    expect(manager.listWallets()).resolves.toEqual([])
    const requestId1 = await manager.login({ wallet: wallet! })
    expect(requestId1).toBeDefined()

    let signRequests = 0
    const unregistedUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(mnemonic)
    })

    const request = await manager.getSignatureRequest(requestId1!)
    expect(request).toBeDefined()
    expect(request.action).toBe('login')

    const mnemonicSigner = request.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(mnemonicSigner).toBeDefined()
    expect(mnemonicSigner?.status).toBe('actionable')

    const result = await (mnemonicSigner as SignerActionable).handle()
    expect(result).toBe(true)

    expect(signRequests).toBe(1)
    unregistedUI()

    // Complete the login process
    await manager.completeLogin(requestId1!)
    expect((await manager.getSignatureRequest(requestId1!))?.status).toBe('completed')
    const wallets2 = await manager.listWallets()
    expect(wallets2.length).toBe(1)
    expect(wallets2[0].address).toBe(wallet!)

    // The wallet should have 2 device keys and 2 recovery keys
    const config = await manager.getConfiguration(wallet!)
    expect(config.devices.length).toBe(2)
    const recovery = await manager.getRecoverySigners(wallet!)
    expect(recovery?.length).toBe(2)
  })

  it('Should logout and then login to an existing wallet using the mnemonic signer', async () => {
    manager = newManager()

    expect(manager.listWallets()).resolves.toEqual([])

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    const wallets = await manager.listWallets()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)

    const requestId = await manager.logout(wallet!)
    expect(requestId).toBeDefined()

    const request = await manager.getSignatureRequest(requestId)
    expect(request).toBeDefined()
    expect(request.action).toBe('logout')

    const deviceSigner = request.signers.find((signer) => signer.handler?.kind === 'local-device')
    expect(deviceSigner).toBeDefined()
    expect(deviceSigner?.status).toBe('ready')

    const result = await (deviceSigner as SignerReady).handle()
    expect(result).toBe(true)

    await manager.completeLogout(requestId)
    expect((await manager.getSignatureRequest(requestId))?.status).toBe('completed')

    expect(manager.listWallets()).resolves.toEqual([])

    // Login again to the same wallet
    const requestId2 = await manager.login({ wallet: wallet! })
    expect(requestId2).toBeDefined()

    let signRequests2 = 0
    const unregistedUI2 = manager.registerMnemonicUI(async (respond) => {
      signRequests2++
      await respond(mnemonic)
    })

    const request2 = await manager.getSignatureRequest(requestId2!)
    expect(request2).toBeDefined()
    expect(request2.action).toBe('login')

    const mnemonicSigner2 = request2.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(mnemonicSigner2).toBeDefined()
    expect(mnemonicSigner2?.status).toBe('actionable')

    const result2 = await (mnemonicSigner2 as SignerActionable).handle()
    expect(result2).toBe(true)

    expect(signRequests2).toBe(1)
    unregistedUI2()

    await manager.completeLogin(requestId2!)
    expect((await manager.getSignatureRequest(requestId2!))?.status).toBe('completed')
    const wallets3 = await manager.listWallets()
    expect(wallets3.length).toBe(1)
    expect(wallets3[0].address).toBe(wallet!)

    // The wallet should have a single device key and a single recovery key
    const config = await manager.getConfiguration(wallet!)
    expect(config.devices.length).toBe(1)
    const recovery = await manager.getRecoverySigners(wallet!)
    expect(recovery?.length).toBe(1)

    // The kind of the device key should be 'local-device'
    expect(config.devices[0].kind).toBe('local-device')

    // The kind of the recovery key should be 'local-recovery'
    expect(recovery?.[0].kind).toBe('local-device')
  })
})
