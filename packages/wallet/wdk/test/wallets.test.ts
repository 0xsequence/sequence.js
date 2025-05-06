import { afterEach, describe, expect, it } from 'vitest'
import { Manager, SignerActionable, SignerReady } from '../src/sequence'
import { Mnemonic } from 'ox'
import { newManager } from './constants'
import { clearStorage } from './setup'

describe('Wallets', () => {
  let manager: Manager | undefined

  afterEach(async () => {
    await manager?.closeDBs()
    await clearStorage()
  })

  it('Should create a new wallet using a mnemonic', async () => {
    manager = newManager()
    const wallet = await manager.signUp({ mnemonic: Mnemonic.random(Mnemonic.english), kind: 'mnemonic' })
    expect(wallet).toBeDefined()
  })

  it('Should logout from a wallet using the login key', async () => {
    clearStorage()

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
    clearStorage()

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
})
