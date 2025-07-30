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
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()
    await expect(manager.wallets.has(wallet!)).resolves.toBeTruthy()
  })

  it('Should logout from a wallet using the login key', async () => {
    const manager = newManager()
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic: loginMnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    const wallets = await manager.wallets.list()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)

    const requestId = await manager.wallets.logout(wallet!)
    expect(requestId).toBeDefined()

    let signRequests = 0
    const unregistedUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(loginMnemonic)
    })

    const request = await manager.signatures.get(requestId)
    expect(request).toBeDefined()
    expect(request.action).toBe('logout')

    const loginSigner = request.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(loginSigner).toBeDefined()
    expect(loginSigner?.status).toBe('actionable')

    const result = await (loginSigner as SignerActionable).handle()
    expect(result).toBe(true)

    expect(signRequests).toBe(1)
    unregistedUI()

    await manager.wallets.completeLogout(requestId)
    expect((await manager.signatures.get(requestId))?.status).toBe('completed')
    const wallets2 = await manager.wallets.list()
    expect(wallets2.length).toBe(0)
    await expect(manager.wallets.has(wallet!)).resolves.toBeFalsy()
  })

  it('Should logout from a wallet using the device key', async () => {
    const manager = newManager()
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic: loginMnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    const wallets = await manager.wallets.list()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)
    expect(wallets[0].status).toBe('ready')

    const requestId = await manager.wallets.logout(wallet!)
    expect(requestId).toBeDefined()

    const wallets2 = await manager.wallets.list()
    expect(wallets2.length).toBe(1)
    expect(wallets2[0].address).toBe(wallet!)
    expect(wallets2[0].status).toBe('logging-out')

    const request = await manager.signatures.get(requestId)
    expect(request).toBeDefined()
    expect(request.action).toBe('logout')

    const deviceSigner = request.signers.find((signer) => signer.handler?.kind === 'local-device')
    expect(deviceSigner).toBeDefined()
    expect(deviceSigner?.status).toBe('ready')

    const result = await (deviceSigner as SignerReady).handle()
    expect(result).toBe(true)

    await manager.wallets.completeLogout(requestId)
    expect((await manager.signatures.get(requestId))?.status).toBe('completed')
    const wallets3 = await manager.wallets.list()
    expect(wallets3.length).toBe(0)
    await expect(manager.wallets.has(wallet!)).resolves.toBeFalsy()
  })

  it('Should login to an existing wallet using the mnemonic signer', async () => {
    manager = newManager()
    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Clear the storage without logging out
    await manager.stop()

    manager = newManager(undefined, undefined, 'device-2')
    await expect(manager.wallets.list()).resolves.toEqual([])
    const requestId1 = await manager.wallets.login({ wallet: wallet! })
    expect(requestId1).toBeDefined()

    const wallets = await manager.wallets.list()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)
    expect(wallets[0].status).toBe('logging-in')

    let signRequests = 0
    const unregistedUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(mnemonic)
    })

    const request = await manager.signatures.get(requestId1!)
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
    await manager.wallets.completeLogin(requestId1!)
    expect((await manager.signatures.get(requestId1!))?.status).toBe('completed')
    const wallets2 = await manager.wallets.list()
    expect(wallets2.length).toBe(1)
    expect(wallets2[0].address).toBe(wallet!)
    expect(wallets2[0].status).toBe('ready')

    // The wallet should have 2 device keys and 2 recovery keys
    const config = await manager.wallets.getConfiguration(wallet!)
    expect(config.devices.length).toBe(2)
    const recovery = await manager.recovery.getSigners(wallet!)
    expect(recovery?.length).toBe(2)
  })

  it('Should logout and then login to an existing wallet using the mnemonic signer', async () => {
    manager = newManager()

    await expect(manager.wallets.list()).resolves.toEqual([])

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    const wallets = await manager.wallets.list()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)

    const requestId = await manager.wallets.logout(wallet!)
    expect(requestId).toBeDefined()

    const request = await manager.signatures.get(requestId)
    expect(request).toBeDefined()
    expect(request.action).toBe('logout')

    const deviceSigner = request.signers.find((signer) => signer.handler?.kind === 'local-device')
    expect(deviceSigner).toBeDefined()
    expect(deviceSigner?.status).toBe('ready')

    const result = await (deviceSigner as SignerReady).handle()
    expect(result).toBe(true)

    await manager.wallets.completeLogout(requestId)
    expect((await manager.signatures.get(requestId))?.status).toBe('completed')

    await expect(manager.wallets.list()).resolves.toEqual([])

    // Login again to the same wallet
    const requestId2 = await manager.wallets.login({ wallet: wallet! })
    expect(requestId2).toBeDefined()

    let signRequests2 = 0
    const unregistedUI2 = manager.registerMnemonicUI(async (respond) => {
      signRequests2++
      await respond(mnemonic)
    })

    const request2 = await manager.signatures.get(requestId2!)
    expect(request2).toBeDefined()
    expect(request2.action).toBe('login')

    const mnemonicSigner2 = request2.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(mnemonicSigner2).toBeDefined()
    expect(mnemonicSigner2?.status).toBe('actionable')

    const result2 = await (mnemonicSigner2 as SignerActionable).handle()
    expect(result2).toBe(true)

    expect(signRequests2).toBe(1)
    unregistedUI2()

    await manager.wallets.completeLogin(requestId2!)
    expect((await manager.signatures.get(requestId2!))?.status).toBe('completed')
    const wallets3 = await manager.wallets.list()
    expect(wallets3.length).toBe(1)
    expect(wallets3[0].address).toBe(wallet!)

    // The wallet should have a single device key and a single recovery key
    const config = await manager.wallets.getConfiguration(wallet!)
    expect(config.devices.length).toBe(1)
    const recovery = await manager.recovery.getSigners(wallet!)
    expect(recovery?.length).toBe(1)

    // The kind of the device key should be 'local-device'
    expect(config.devices[0].kind).toBe('local-device')

    // The kind of the recovery key should be 'local-recovery'
    expect(recovery?.[0].kind).toBe('local-device')
  })

  it('Should fail to logout from a non-existent wallet', async () => {
    const manager = newManager()
    const requestId = manager.wallets.logout('0x1234567890123456789012345678901234567890')
    await expect(requestId).rejects.toThrow('wallet-not-found')
  })

  it('Should fail to login to an already logged in wallet', async () => {
    const manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    const requestId = manager.wallets.login({ wallet: wallet! })
    await expect(requestId).rejects.toThrow('wallet-already-logged-in')
  })

  it('Should make you select among a single option if login with mnemonic', async () => {
    const manager = newManager()
    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    await manager.wallets.logout(wallet!, { skipRemoveDevice: true })

    let signRequests = 0
    const unregistedUI = manager.registerMnemonicUI(async (respond) => {
      signRequests++
      await respond(mnemonic)
    })

    let selectWalletCalls = 0
    const requestId = await manager.wallets.login({
      mnemonic: mnemonic,
      kind: 'mnemonic',
      selectWallet: async () => {
        selectWalletCalls++
        return wallet!
      },
    })

    expect(selectWalletCalls).toBe(1)
    expect(requestId).toBeDefined()

    const wallets = await manager.wallets.list()
    expect(wallets.length).toBe(1)
    expect(wallets[0].address).toBe(wallet!)
    expect(wallets[0].status).toBe('logging-in')

    const request = await manager.signatures.get(requestId!)
    expect(request).toBeDefined()
    expect(request.action).toBe('login')

    const mnemonicSigner = request.signers.find((signer) => signer.handler?.kind === 'login-mnemonic')
    expect(mnemonicSigner).toBeDefined()
    expect(mnemonicSigner?.status).toBe('actionable')

    const result = await (mnemonicSigner as SignerActionable).handle()
    expect(result).toBe(true)

    expect(signRequests).toBe(1)
    unregistedUI()

    await manager.wallets.completeLogin(requestId!)
    expect((await manager.signatures.get(requestId!))?.status).toBe('completed')
    const wallets2 = await manager.wallets.list()
    expect(wallets2.length).toBe(1)
    expect(wallets2[0].address).toBe(wallet!)
    expect(wallets2[0].status).toBe('ready')
  })

  it('Should trigger an update when a wallet is logged in', async () => {
    const manager = newManager()

    let wallet: any | undefined

    let callbackCalls = 0
    let unregisterCallback: (() => void) | undefined

    const callbackFiredPromise = new Promise<void>((resolve) => {
      unregisterCallback = manager.wallets.onWalletsUpdate((wallets) => {
        callbackCalls++
        expect(wallets.length).toBe(1)
        expect(wallets[0].address).toBe(wallet!)
        expect(wallets[0].status).toBe('ready')
        resolve()
      })
    })

    wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    await callbackFiredPromise

    expect(callbackCalls).toBe(1)
    unregisterCallback!()
  })

  it('Should trigger an update when a wallet is logged out', async () => {
    const manager = newManager()

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    let callbackCalls = 0
    let unregisterCallback: (() => void) | undefined
    const callbackFiredPromise = new Promise<void>((resolve) => {
      unregisterCallback = manager.wallets.onWalletsUpdate((wallets) => {
        callbackCalls++
        expect(wallets.length).toBe(0)
        resolve()
      })
    })

    await manager.wallets.logout(wallet!, { skipRemoveDevice: true })
    await callbackFiredPromise

    expect(callbackCalls).toBe(1)
    unregisterCallback!()
  })

  it('Should trigger an update when a wallet is logging out', async () => {
    const manager = newManager()

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    let callbackCalls = 0
    let unregisterCallback: (() => void) | undefined
    const callbackFiredPromise = new Promise<void>((resolve) => {
      unregisterCallback = manager.wallets.onWalletsUpdate((wallets) => {
        callbackCalls++
        expect(wallets.length).toBe(1)
        expect(wallets[0].address).toBe(wallet!)
        expect(wallets[0].status).toBe('logging-out')
        resolve()
      })
    })

    await manager.wallets.logout(wallet!)
    await callbackFiredPromise

    expect(callbackCalls).toBe(1)
    unregisterCallback!()
  })

  it('Should list all active devices for a wallet', async () => {
    const manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const devices = await manager.wallets.listDevices(wallet!)
    expect(devices.length).toBe(1)
    expect(devices[0].address).not.toBe(wallet)
    expect(devices[0].isLocal).toBe(true)
    expect(devices[0]).toBeDefined()
  })

  it('Should list all active devices for a wallet, including a new remote device', async () => {
    // Step 1: Wallet signs up on device 1
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const managerDevice1 = newManager(undefined, undefined, 'device-1')

    const wallet = await managerDevice1.wallets.signUp({
      mnemonic: loginMnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    // Verify initial state from Device 1's perspective
    const devices1 = await managerDevice1.wallets.listDevices(wallet!)
    expect(devices1.length).toBe(1)
    expect(devices1[0].isLocal).toBe(true)
    const device1Address = devices1[0].address

    // Wallet logs in on device 2
    const managerDevice2 = newManager(undefined, undefined, 'device-2')

    // Initiate the login process from Device 2. This returns a signature request ID.
    const requestId = await managerDevice2.wallets.login({ wallet: wallet! })
    expect(requestId).toBeDefined()

    // Register the Mnemonic UI handler for Device 2 to authorize the new device.
    // It will provide the master mnemonic when asked.
    const unregisterUI = managerDevice2.registerMnemonicUI(async (respond) => {
      await respond(loginMnemonic)
    })

    // Get the signature request and handle it using the mnemonic signer.
    const sigRequest = await managerDevice2.signatures.get(requestId)
    const mnemonicSigner = sigRequest.signers.find((s) => s.handler?.kind === 'login-mnemonic')
    expect(mnemonicSigner).toBeDefined()
    expect(mnemonicSigner?.status).toBe('actionable')

    const handled = await (mnemonicSigner as SignerActionable).handle()
    expect(handled).toBe(true)

    // Clean up the UI handler
    unregisterUI()

    // Finalize the login for Device 2
    await managerDevice2.wallets.completeLogin(requestId)

    // Step 3: Verification from both devices' perspectives

    // Verify from Device 2's perspective
    const devices2 = await managerDevice2.wallets.listDevices(wallet!)
    expect(devices2.length).toBe(2)

    const device2Entry = devices2.find((d) => d.isLocal === true) // Device 2 is the local device
    const device1EntryForDevice2 = devices2.find((d) => d.isLocal === false) // Device 1 is the remote device

    expect(device2Entry).toBeDefined()
    expect(device2Entry?.isLocal).toBe(true)
    expect(device1EntryForDevice2).toBeDefined()
    expect(device1EntryForDevice2?.address).toBe(device1Address)

    // Verify from Device 1's perspective
    const devices1AfterLogin = await managerDevice1.wallets.listDevices(wallet!)
    expect(devices1AfterLogin.length).toBe(2) // Now the wallet has logged in on two devices

    const device1EntryForDevice1 = devices1AfterLogin.find((d) => d.isLocal === true)
    const device2EntryForDevice1 = devices1AfterLogin.find((d) => d.isLocal === false)

    expect(device1EntryForDevice1).toBeDefined()
    expect(device1EntryForDevice1?.isLocal).toBe(true)
    expect(device1EntryForDevice1?.address).toBe(device1Address)
    expect(device2EntryForDevice1).toBeDefined()
    expect(device2EntryForDevice1?.isLocal).toBe(false)

    // Stop the managers to clean up resources
    await managerDevice1.stop()
    await managerDevice2.stop()
  })

  it('Should remotely log out a device', async () => {
    // === Step 1: Setup with two devices ===
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const managerDevice1 = newManager(undefined, undefined, 'device-1')

    const wallet = await managerDevice1.wallets.signUp({
      mnemonic: loginMnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    const managerDevice2 = newManager(undefined, undefined, 'device-2')
    const loginRequestId = await managerDevice2.wallets.login({ wallet: wallet! })

    const unregisterUI = managerDevice2.registerMnemonicUI(async (respond) => {
      await respond(loginMnemonic)
    })

    const loginSigRequest = await managerDevice2.signatures.get(loginRequestId)
    const mnemonicSigner = loginSigRequest.signers.find((s) => s.handler?.kind === 'login-mnemonic')!
    await (mnemonicSigner as SignerActionable).handle()
    unregisterUI()

    await managerDevice2.wallets.completeLogin(loginRequestId)

    const initialDevices = await managerDevice1.wallets.listDevices(wallet!)
    console.log('Initial devices', initialDevices)
    expect(initialDevices.length).toBe(2)
    const device2Address = initialDevices.find((d) => !d.isLocal)!.address

    // === Step 2: Initiate remote logout from Device 1 ===
    const remoteLogoutRequestId = await managerDevice1.wallets.remoteLogout(wallet!, device2Address)
    expect(remoteLogoutRequestId).toBeDefined()

    // === Step 3: Authorize the remote logout from Device 1 ===
    const logoutSigRequest = await managerDevice1.signatures.get(remoteLogoutRequestId)
    expect(logoutSigRequest.action).toBe('remote-logout')

    const device1Signer = logoutSigRequest.signers.find((s) => s.handler?.kind === 'local-device')
    expect(device1Signer).toBeDefined()
    expect(device1Signer?.status).toBe('ready')

    const handled = await (device1Signer as SignerReady).handle()
    expect(handled).toBe(true)

    await managerDevice1.wallets.completeConfigurationUpdate(remoteLogoutRequestId)

    // The signature request should now be marked as completed
    expect((await managerDevice1.signatures.get(remoteLogoutRequestId))?.status).toBe('completed')

    // === Step 5: Verification ===
    const finalDevices = await managerDevice1.wallets.listDevices(wallet!)
    console.log('Final devices', finalDevices)
    expect(finalDevices.length).toBe(1)
    expect(finalDevices[0].isLocal).toBe(true)
    expect(finalDevices[0].address).not.toBe(device2Address)

    await managerDevice1.stop()
    await managerDevice2.stop()
  })

  it('Should not be able to remotely log out from the current device', async () => {
    manager = newManager()
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    const devices = await manager.wallets.listDevices(wallet!)
    expect(devices.length).toBe(1)
    const localDeviceAddress = devices[0].address

    const remoteLogoutPromise = manager.wallets.remoteLogout(wallet!, localDeviceAddress)

    await expect(remoteLogoutPromise).rejects.toThrow('cannot-remote-logout-from-local-device')
  })
})
