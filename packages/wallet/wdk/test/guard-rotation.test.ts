import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Address, Bytes, Hex, Mnemonic, Secp256k1, Signature } from 'ox'
import { State } from '@0xsequence/wallet-core'
import { Config, Constants, Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives'
import { AbiFunction } from 'ox'
import { GuardSettlement, GuardSettlementSpace, Manager, SignerReady } from '../src/sequence/index.js'
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

  const settlements: GuardSettlement[] = []

  async function signUpWithOldGuards() {
    settlements.length = 0
    manager = newManager(
      {
        guardUrl: 'https://guard.test',
        guardAddresses: { ...oldGuards },
        onGuardSettlement: async (settlement) => {
          settlements.push(settlement)
        },
      },
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

  it('Should sign a chain-agnostic settlement of the migrated configuration with the new guard', async () => {
    const wallet = await signUpWithOldGuards()
    rotate(manager!)

    // Settling is refused while the wallet still has the old guard
    await expect(manager!.wallets.prepareGuardSettlement(wallet)).rejects.toThrow('guard-migration-pending')

    const migrationId = await manager!.wallets.migrateGuard(wallet)
    await signAll(manager!, migrationId!)
    await manager!.wallets.completeConfigurationUpdate(migrationId!)
    guardRequests.length = 0

    // Completing the migration queues the settlement request
    const pending = await manager!.signatures.list()
    const queued = pending.filter((r) => r.action === 'guard-settlement' && r.status === 'pending')
    expect(queued.length).toBe(1)
    const settlementId = queued[0]!.id
    await signAll(manager!, settlementId)

    // The settlement is signed under the new configuration, so the new guard co-signs it
    expect(guardRequests).toEqual([newGuards.wallet])

    const settlement = await manager!.wallets.completeGuardSettlement(settlementId!)
    expect(settlements).toEqual([settlement])

    // It writes the latest configuration, with no chain id, in the dedicated nonce space
    const latest = await (manager as any).shared.modules.wallets.getConfigurationParts(wallet)
    const imageHash = Bytes.toHex(Config.hashConfiguration(settlement.envelope.configuration))
    expect(settlement.imageHash).toBe(imageHash)
    expect(Config.findSignerLeaf(latest.guardTopology, newGuards.wallet)).toBeDefined()
    expect(settlement.envelope.chainId).toBe(0)
    expect(settlement.envelope.payload.space).toBe(GuardSettlementSpace)
    expect(settlement.envelope.payload.nonce).toBe(0n)
    expect(settlement.envelope.payload.calls).toEqual([
      expect.objectContaining({
        to: wallet,
        data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [imageHash]),
        delegateCall: false,
      }),
    ])

    // The signature recovers to the new configuration with enough weight, on any chain
    const decoded = SequenceSignature.decodeSignature(Bytes.fromHex(settlement.signature))
    expect(decoded.noChainId).toBe(true)
    const recovered = await SequenceSignature.recover(decoded, wallet, 0, settlement.envelope.payload as Payload.Calls)
    expect(Bytes.toHex(Config.hashConfiguration(recovered.configuration))).toBe(imageHash)
    expect(recovered.weight >= recovered.configuration.threshold).toBe(true)
  })

  it('Should not queue a settlement when the update did not move the wallet off an old guard', async () => {
    const wallet = await signUpWithOldGuards()

    const requestId = await manager!.wallets.logout(wallet)
    await signAll(manager!, requestId)
    await manager!.wallets.completeConfigurationUpdate(requestId)

    const pending = await manager!.signatures.list()
    expect(pending.filter((r) => r.action === 'guard-settlement').length).toBe(0)
  })

  it('Should rotate only the wallet-role guard when only it is rotated out (sessions stays on its guard)', async () => {
    const wallet = await signUpWithOldGuards()
    const sequence = (manager as any).shared.sequence
    sequence.guardAddresses = { wallet: newGuards.wallet, sessions: oldGuards.sessions }
    sequence.legacyGuardAddresses = { wallet: [oldGuards.wallet] }

    const requestId = await manager!.wallets.migrateGuard(wallet)
    await signAll(manager!, requestId!)
    await manager!.wallets.completeConfigurationUpdate(requestId!)

    const after = await manager!.wallets.getConfiguration(wallet)
    expect(after.walletGuard?.address).toBe(newGuards.wallet)
    expect(after.moduleGuards.get(sequence.extensions.sessions)?.address).toBe(oldGuards.sessions)
    expect(await manager!.wallets.needsGuardMigration(wallet)).toBe(false)
  })

  it('Should hand settlements to the state provider by default', async () => {
    const saveGuardSettlement = vi.fn(async () => {})
    const stateProvider = Object.assign(new State.Local.Provider(new State.Local.IndexedDbStore()), {
      saveGuardSettlement,
    })
    manager = newManager(
      { guardUrl: 'https://guard.test', guardAddresses: { ...oldGuards }, stateProvider },
      undefined,
      `guard_rotation_default_${Date.now()}`,
    )
    manager.registerGuardUI(vi.fn())
    const wallet = (await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: false,
    }))!
    rotate(manager)

    const migrationId = await manager.wallets.migrateGuard(wallet)
    await signAll(manager, migrationId!)
    await manager.wallets.completeConfigurationUpdate(migrationId!)
    const queued = (await manager.signatures.list()).filter((r) => r.action === 'guard-settlement')
    expect(queued.length).toBe(1)
    await signAll(manager, queued[0]!.id)
    const settlement = await manager.wallets.completeGuardSettlement(queued[0]!.id)

    expect(saveGuardSettlement).toHaveBeenCalledWith(wallet, settlement.envelope.payload, settlement.signature)
  })
})
