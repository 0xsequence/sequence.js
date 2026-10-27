import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Bytes, Hex, Mnemonic, Secp256k1, Signature } from 'ox'
import { Config } from '@0xsequence/wallet-primitives'
import { Manager, SignerReady } from '../src/sequence/index.js'
import { Kinds } from '../src/sequence/types/signer.js'
import { newManager } from './constants.js'

// Throwaway guard keys, they only ever sign inside this test
const oldWalletGuardPk = Secp256k1.randomPrivateKey()
const oldSessionsGuardPk = Secp256k1.randomPrivateKey()
const newWalletGuardPk = Secp256k1.randomPrivateKey()
const newSessionsGuardPk = Secp256k1.randomPrivateKey()

const guardKeys = new Map<string, Hex.Hex>(
  [oldWalletGuardPk, oldSessionsGuardPk, newWalletGuardPk, newSessionsGuardPk].map((pk) => [
    Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pk })).toLowerCase(),
    pk,
  ]),
)

function addressOf(pk: Hex.Hex): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pk }))
}

const oldGuards = { wallet: addressOf(oldWalletGuardPk), sessions: addressOf(oldSessionsGuardPk) }
const newGuards = { wallet: addressOf(newWalletGuardPk), sessions: addressOf(newSessionsGuardPk) }

// Stands in for guard.sequence.app: signs the requested digest with the key behind `signer`,
// and records which guard was asked to sign.
const guardRequests: Address.Address[] = []
const guardFetch = vi.fn(async (_url: string, init: { body: string }) => {
  const { signer, request } = JSON.parse(init.body)
  guardRequests.push(signer)
  const pk = guardKeys.get(signer.toLowerCase())
  if (!pk) {
    return new Response(JSON.stringify({ error: 'unknown signer' }), { status: 400 })
  }
  const signature = Secp256k1.sign({ payload: Bytes.fromHex(request.msg), privateKey: pk })
  return new Response(JSON.stringify({ sig: Signature.toHex(signature) }), { status: 200 })
})

async function signAll(manager: Manager, requestId: string) {
  // Devices sign first, the guard refuses to sign first
  const request = await manager.signatures.get(requestId)
  const device = request.signers.find((s) => s.handler?.kind === Kinds.LocalDevice)
  await (device as SignerReady).handle()

  const afterDevice = await manager.signatures.get(requestId)
  const guard = afterDevice.signers.find((s) => s.handler?.kind === Kinds.Guard && s.status === 'ready')
  expect(guard).toBeDefined()
  await (guard as SignerReady).handle()
}

describe('Guard rotation', () => {
  let manager: Manager | undefined

  beforeEach(() => {
    // The guard client uses window.fetch
    vi.stubGlobal('fetch', guardFetch)
    ;(window as any).fetch = guardFetch
  })

  afterEach(async () => {
    await manager?.stop()
    vi.unstubAllGlobals()
    guardRequests.length = 0
  })

  function rotate(manager: Manager) {
    // Simulates shipping a new release: new guards become current, the old ones become legacy
    const sequence = (manager as any).shared.sequence
    sequence.guardAddresses = { ...newGuards }
    sequence.legacyGuardAddresses = { wallet: [oldGuards.wallet], sessions: [oldGuards.sessions] }
  }

  async function signUpWithOldGuards() {
    manager = newManager(
      { guardUrl: 'https://guard.test', guardAddresses: { ...oldGuards } },
      undefined,
      `guard_rotation_${Date.now()}`,
    )
    manager.registerGuardUI(vi.fn())

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: false,
    })
    return wallet!
  }

  it('Should resolve legacy guard addresses to their role', async () => {
    manager = newManager({ guardAddresses: { ...newGuards }, legacyGuardAddresses: { wallet: [oldGuards.wallet] } })
    const guards = (manager as any).shared.modules.guards
    const signers = (manager as any).shared.modules.signers

    const [role, signer] = guards.getByAddress(oldGuards.wallet)
    expect(role).toBe('wallet')
    expect(signer.address).toBe(oldGuards.wallet)
    expect(await signers.kindOf(Address.from('0x' + '11'.repeat(20)), oldGuards.wallet)).toBe(Kinds.Guard)

    // Unknown addresses are still not guards
    expect(guards.getByAddress(oldGuards.sessions)).toBeUndefined()
  })

  it('Should not migrate wallets that already use the current guards', async () => {
    const wallet = await signUpWithOldGuards()
    expect(await manager!.wallets.needsGuardMigration(wallet)).toBe(false)
    expect(await manager!.wallets.migrateGuard(wallet)).toBeUndefined()
  })

  it('Should migrate a wallet to the new guards, co-signed by the old guard', async () => {
    const wallet = await signUpWithOldGuards()
    rotate(manager!)

    // Before migrating, the wallet still shows its old guards
    const before = await manager!.wallets.getConfiguration(wallet)
    expect(before.walletGuard?.address).toBe(oldGuards.wallet)
    expect(before.walletGuard?.kind).toBe(Kinds.Guard)
    expect(await manager!.wallets.needsGuardMigration(wallet)).toBe(true)

    const requestId = await manager!.wallets.migrateGuard(wallet)
    expect(requestId).toBeDefined()
    await signAll(manager!, requestId!)

    // The update is validated against the current configuration, so the old guard signs it
    expect(guardRequests).toEqual([oldGuards.wallet])

    await manager!.wallets.completeConfigurationUpdate(requestId!)

    const after = await manager!.wallets.getConfiguration(wallet)
    expect(after.walletGuard?.address).toBe(newGuards.wallet)
    const sessionsModule = (manager as any).shared.sequence.extensions.sessions
    expect(after.moduleGuards.get(sessionsModule)?.address).toBe(newGuards.sessions)

    // Only the guard addresses changed: the recovery multisig stays in the guard branch
    expect(Config.findSignerLeaf(after.raw.guardTopology!, oldGuards.wallet)).toBeUndefined()
    expect(Config.getSigners(after.raw.guardTopology!).signers.length).toBe(
      Config.getSigners(before.raw.guardTopology!).signers.length,
    )

    expect(await manager!.wallets.needsGuardMigration(wallet)).toBe(false)
  })

  it('Should migrate the guards as part of any other configuration update', async () => {
    const wallet = await signUpWithOldGuards()
    rotate(manager!)

    // Logging out is a regular configuration update, it also moves the wallet to the new guards
    const requestId = await manager!.wallets.logout(wallet, { skipRemoveDevice: false } as any)
    await signAll(manager!, requestId)
    expect(guardRequests).toEqual([oldGuards.wallet])
    await manager!.wallets.completeConfigurationUpdate(requestId)

    const after = await manager!.wallets.getConfiguration(wallet)
    expect(after.walletGuard?.address).toBe(newGuards.wallet)
  })
})
