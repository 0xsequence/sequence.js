import { describe, expect, it } from 'vitest'
import { Address, Hex, P256, WebAuthnP256 } from 'ox'
import { Signers, State } from '@0xsequence/wallet-core'
import { Extensions } from '@0xsequence/wallet-primitives'
import { defaultPasskeyProvider, type PasskeyProvider } from '../src/sequence/passkeys-provider.js'
import { newManager } from './constants.js'

// A WebAuthn authenticator backed by real P-256 keys, so passkey signatures
// pass the same validation the state provider applies to real ones. Like a
// real authenticator, every created credential gets its own key.
function fakeAuthenticator() {
  const privateKeys = new Map<string, Hex.Hex>()

  const webauthn: Signers.Passkey.WebAuthnLike = {
    createCredential: (async () => {
      const id = `credential-${privateKeys.size + 1}`
      const privateKey = P256.randomPrivateKey()
      privateKeys.set(id, privateKey)
      return { id, publicKey: P256.getPublicKey({ privateKey }), raw: { id } }
    }) as never,
    sign: (async ({ challenge, credentialId }: { challenge: Hex.Hex; credentialId?: string }) => {
      // Without a credential id the browser lets the user pick; take the first one
      const id = credentialId ?? [...privateKeys.keys()][0]!
      const privateKey = privateKeys.get(id)
      if (!privateKey) throw new Error(`unknown credential ${id}`)

      const { metadata, payload } = WebAuthnP256.getSignPayload({ challenge })
      const signature = P256.sign({ payload, privateKey, hash: true })
      return { metadata, signature, raw: { id } }
    }) as never,
  }

  const passkeyProvider: PasskeyProvider = {
    ...defaultPasskeyProvider,
    create: (extensions, options) => defaultPasskeyProvider.create(extensions, { ...options, webauthn }),
    find: (stateReader, extensions) => defaultPasskeyProvider.find(stateReader, extensions, { webauthn }),
    loadFromWitness: (stateReader, extensions, wallet, imageHash) =>
      defaultPasskeyProvider.loadFromWitness(stateReader, extensions, wallet, imageHash, { webauthn }),
    fromCredential: (args) => defaultPasskeyProvider.fromCredential({ ...args, webauthn }),
  }

  return { webauthn, passkeyProvider }
}

describe('Reusing a passkey for another wallet', () => {
  it('signs up a second wallet with a stored passkey and keeps both under that passkey', async () => {
    const { webauthn, passkeyProvider } = fakeAuthenticator()
    const stateProvider = new State.Local.Provider(new State.Local.IndexedDbStore('passkey-reuse-state'))
    const manager = newManager({ passkeyProvider, stateProvider })
    const extensions = Extensions.Rc6

    const firstWallet = await manager.wallets.signUp({ kind: 'passkey', noGuard: true })
    expect(firstWallet).toBeDefined()

    const [credential] = await manager.getPasskeyCredentials()
    expect(credential).toBeDefined()
    expect(Address.isEqual(credential!.walletAddress, firstWallet!)).toBe(true)
    const imageHash = Extensions.Passkeys.rootFor(credential!.publicKey)

    // The app's selector asks for a new wallet for a login that already has one
    let offeredOnSignUp: Address.Address[] = []
    manager.wallets.registerWalletSelector(async ({ existingWallets }) => {
      offeredOnSignUp = existingWallets
      return 'create-new'
    })

    const secondWallet = await manager.wallets.signUp({
      kind: 'passkey',
      credentialId: credential!.credentialId,
      noGuard: true,
    })
    expect(secondWallet).toBeDefined()
    expect(Address.isEqual(secondWallet!, firstWallet!)).toBe(false)
    expect(offeredOnSignUp.map((wallet) => wallet.toLowerCase())).toEqual([firstWallet!.toLowerCase()])

    // Both wallets stay signed in on this device
    const signedIn = (await manager.wallets.list()).map((wallet) => wallet.address.toLowerCase())
    expect(signedIn.sort()).toEqual([firstWallet!, secondWallet!].map((wallet) => wallet.toLowerCase()).sort())

    // The same credential is kept and now points at the new wallet
    const credentials = await manager.getPasskeyCredentials()
    expect(credentials).toHaveLength(1)
    expect(credentials[0]!.createdAt).toBe(credential!.createdAt)
    expect(Address.isEqual(credentials[0]!.walletAddress, secondWallet!)).toBe(true)

    // Signing for the new wallet on another device loads the passkey from its witness
    const loaded = await Signers.Passkey.Passkey.loadFromWitness(stateProvider, extensions, secondWallet!, imageHash, {
      webauthn,
    })
    expect(loaded.credentialId).toBe(credential!.credentialId)
    expect(loaded.imageHash).toBe(imageHash)

    // Passkey login offers both wallets
    let offeredOnLogin: Address.Address[] = []
    await expect(
      manager.wallets.login({
        kind: 'passkey',
        credentialId: credential!.credentialId,
        selectWallet: async (wallets) => {
          offeredOnLogin = wallets
          throw new Error('stop-after-select')
        },
      }),
    ).rejects.toThrow('stop-after-select')

    expect(offeredOnLogin.map((wallet) => wallet.toLowerCase()).sort()).toEqual(
      [firstWallet!, secondWallet!].map((wallet) => wallet.toLowerCase()).sort(),
    )
  })

  it('signs with the metadata a stored passkey embeds, so its wallets are found under that passkey', async () => {
    const { webauthn, passkeyProvider } = fakeAuthenticator()
    // A passkey whose public key carries its credential id, which is part of its image hash
    const embeddedSigners: (boolean | undefined)[] = []
    const embeddingProvider: PasskeyProvider = {
      ...passkeyProvider,
      create: (extensions, options) => passkeyProvider.create(extensions, { ...options, embedMetadata: true }),
      fromCredential: (args) => {
        embeddedSigners.push(args.embedMetadata)
        return passkeyProvider.fromCredential(args)
      },
    }
    const stateProvider = new State.Local.Provider(new State.Local.IndexedDbStore('passkey-reuse-embedded'))
    const manager = newManager({ passkeyProvider: embeddingProvider, stateProvider })
    const extensions = Extensions.Rc6

    await manager.wallets.signUp({ kind: 'passkey', noGuard: true })
    const [credential] = await manager.getPasskeyCredentials()
    expect(credential!.publicKey.metadata).toBeDefined()
    const imageHash = Extensions.Passkeys.rootFor(credential!.publicKey)

    manager.wallets.registerWalletSelector(async () => 'create-new')
    const secondWallet = await manager.wallets.signUp({
      kind: 'passkey',
      credentialId: credential!.credentialId,
      noGuard: true,
    })

    // The new wallet's witness proves the passkey's image hash, so it's found under it
    const loaded = await Signers.Passkey.Passkey.loadFromWitness(stateProvider, extensions, secondWallet!, imageHash, {
      webauthn,
    })
    expect(loaded.embedMetadata).toBe(true)

    // Signing in with the stored passkey embeds the metadata too
    await expect(
      manager.wallets.login({
        kind: 'passkey',
        credentialId: credential!.credentialId,
        selectWallet: async () => {
          throw new Error('stop-after-select')
        },
      }),
    ).rejects.toThrow('stop-after-select')
    expect(embeddedSigners).toEqual([true, true])
  })

  it('fails sign-up for a passkey that is not stored on this device', async () => {
    const { passkeyProvider } = fakeAuthenticator()
    const manager = newManager({ passkeyProvider })

    await expect(
      manager.wallets.signUp({ kind: 'passkey', credentialId: 'unknown-credential', noGuard: true }),
    ).rejects.toThrow('credential-not-found')
  })

  it('rejects a witness signed by a different key', async () => {
    const original = fakeAuthenticator()
    const other = fakeAuthenticator()
    const stateProvider = new State.Local.Provider(new State.Local.IndexedDbStore('passkey-reuse-wrong-key'))
    const extensions = Extensions.Rc6
    const created = await original.passkeyProvider.create(extensions, { stateProvider })
    // The other authenticator holds a different key under the same credential id
    await other.passkeyProvider.create(extensions)

    // Same stored public key, but the authenticator signs with another key
    const mismatched = other.passkeyProvider.fromCredential({
      credentialId: created.credentialId,
      publicKey: created.publicKey,
      extensions,
      metadata: { credentialId: created.credentialId },
    })

    await expect(
      mismatched.witness(stateProvider, Address.from('0x00000000000000000000000000000000000000b2')),
    ).rejects.toThrow('Invalid passkey signature')
  })

  it('needs the credential id in the metadata to load the passkey for the new wallet', async () => {
    const { webauthn, passkeyProvider } = fakeAuthenticator()
    const stateProvider = new State.Local.Provider(new State.Local.IndexedDbStore('passkey-reuse-no-metadata'))
    const extensions = Extensions.Rc6
    const created = await passkeyProvider.create(extensions, { stateProvider })

    const withoutMetadata = passkeyProvider.fromCredential({
      credentialId: created.credentialId,
      publicKey: created.publicKey,
      extensions,
    })
    const wallet = Address.from('0x00000000000000000000000000000000000000b2')
    await withoutMetadata.witness(stateProvider, wallet)

    await expect(
      Signers.Passkey.Passkey.loadFromWitness(stateProvider, extensions, wallet, withoutMetadata.imageHash, {
        webauthn,
      }),
    ).rejects.toThrow('Metadata does not contain credential id')
  })
})
