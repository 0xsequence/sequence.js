import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AbiFunction, Address, Bytes, Hex, Mnemonic, Provider, RpcTransport, Secp256k1, Signature } from 'ox'
import { Wallet as CoreWallet } from '@0xsequence/wallet-core'
import { Config, Constants, Payload } from '@0xsequence/wallet-primitives'
import type { Relayer } from '@0xsequence/relayer'
import { Actions, guardSettlementSpace, Manager, SignerReady } from '../src/sequence/index.js'
import { Kinds } from '../src/sequence/types/signer.js'
import { LOCAL_RPC_URL, newManager } from './constants.js'

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

const newerWalletGuardPk = Secp256k1.randomPrivateKey()
guardKeys.set(addressOf(newerWalletGuardPk).toLowerCase(), newerWalletGuardPk)

const oldGuards = { wallet: addressOf(oldWalletGuardPk), sessions: addressOf(oldSessionsGuardPk) }
const newGuards = { wallet: addressOf(newWalletGuardPk), sessions: addressOf(newSessionsGuardPk) }
const newerGuards = { wallet: addressOf(newerWalletGuardPk), sessions: addressOf(newSessionsGuardPk) }

const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
// Anvil's first dev account, unlocked on the local fork
const relayerAccount: Address.Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

// Stands in for the Sequence relayer: sponsors the settlement and sends it from a funded dev account
const relayed: { to: Address.Address; data: Hex.Hex; chainId: number }[] = []
let failNextRelay = false
const testRelayer = {
  kind: 'standard',
  type: 'test',
  id: 'test-relayer',
  isAvailable: async () => true,
  feeTokens: async () => ({ isFeeRequired: false }),
  feeOptions: async () => ({ options: [], sponsored: true }),
  relay: async (to: Address.Address, data: Hex.Hex, chainId: number) => {
    if (failNextRelay) {
      failNextRelay = false
      throw new Error('relayer unavailable')
    }
    relayed.push({ to, data, chainId })
    const opHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: relayerAccount, to, data }],
    })
    // Wait until it is mined, and fail like a relayer would if it reverted
    for (let i = 0; i < 50; i++) {
      const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [opHash] })
      if (receipt) {
        if (receipt.status !== '0x1') {
          throw new Error(`settlement reverted: ${opHash}`)
        }
        return { opHash }
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`settlement not mined: ${opHash}`)
  },
  status: async () => ({ status: 'confirmed' }),
} as unknown as Relayer.Relayer

async function fund(wallet: Address.Address) {
  await provider.request({ method: 'anvil_setBalance' as any, params: [wallet, '0x16345785D8A0000'] as any })
}

async function onChainImageHash(manager: Manager, wallet: Address.Address) {
  const status = await new CoreWallet(wallet, {
    stateProvider: (manager as any).shared.sequence.stateProvider,
  }).getStatus(provider)
  return { onChain: status.onChainImageHash, latest: status.imageHash, deployed: status.isDeployed }
}

// Stands in for guard.sequence.app: signs the requested digest with the key behind `signer`,
// and records which guard was asked to sign.
const guardRequests: Address.Address[] = []
const realFetch = globalThis.fetch
const guardFetch = vi.fn(async (url: string, init: { body: string }) => {
  if (!String(url).startsWith('https://guard.test')) {
    return realFetch(url, init as any)
  }
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
    relayed.length = 0
    failNextRelay = false
  })

  function rotate(manager: Manager) {
    // Simulates shipping a new release: new guards become current, the old ones become legacy
    const sequence = (manager as any).shared.sequence
    sequence.guardAddresses = { ...newGuards }
    sequence.legacyGuardAddresses = { wallet: [oldGuards.wallet], sessions: [oldGuards.sessions] }
  }

  async function signUpWithOldGuards() {
    manager = newManager(
      {
        guardUrl: 'https://guard.test',
        guardAddresses: { ...oldGuards },
        relayers: [testRelayer],
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

    const requestId = await manager!.wallets.requestConfigurationUpdate(wallet, {}, Actions.SessionUpdate)
    await signAll(manager!, requestId)
    expect(guardRequests).toEqual([oldGuards.wallet])
    await manager!.wallets.completeConfigurationUpdate(requestId)

    const after = await manager!.wallets.getConfiguration(wallet)
    expect(after.walletGuard?.address).toBe(newGuards.wallet)
  })

  it('Should not move the guards when logging out', async () => {
    const wallet = await signUpWithOldGuards()
    rotate(manager!)

    // The device that signs a logout is leaving: the next update by a remaining device moves the wallet
    const requestId = await manager!.wallets.logout(wallet)
    await signAll(manager!, requestId)
    expect(guardRequests).toEqual([oldGuards.wallet])
    await manager!.wallets.completeConfigurationUpdate(requestId)

    const status = await new CoreWallet(wallet, {
      stateProvider: (manager as any).shared.sequence.stateProvider,
    }).getStatus()
    expect(Config.findSignerLeaf(status.configuration.topology, oldGuards.wallet)).toBeDefined()
    expect(Config.findSignerLeaf(status.configuration.topology, newGuards.wallet)).toBeUndefined()
    expect((await manager!.signatures.list()).filter((r) => r.action === 'guard-settlement').length).toBe(0)
  })

  async function migrateAndSign(wallet: Address.Address) {
    const migrationId = await manager!.wallets.migrateGuard(wallet)
    await signAll(manager!, migrationId!)
    await manager!.wallets.completeConfigurationUpdate(migrationId!)
  }

  async function pendingSettlement() {
    const pending = (await manager!.signatures.list()).filter(
      (r) => r.action === 'guard-settlement' && r.status === 'pending',
    )
    return pending.map((r) => r.id)
  }

  it('Should settle the migrated configuration on chains where the wallet is funded', async () => {
    const wallet = await signUpWithOldGuards()
    await fund(wallet)
    rotate(manager!)

    // Settling is refused while the wallet still has the old guard
    await expect(manager!.wallets.prepareGuardSettlement(wallet)).rejects.toThrow('guard-migration-pending')

    await migrateAndSign(wallet)
    guardRequests.length = 0

    // Completing the migration queues the settlement
    const [settlementId] = await pendingSettlement()
    expect(settlementId).toBeDefined()
    const request = await manager!.signatures.get(settlementId!)
    const before = await onChainImageHash(manager!, wallet)
    expect(request.envelope.chainId).toBe(0)
    expect(request.envelope.payload).toEqual({
      type: 'call',
      space: guardSettlementSpace(before.latest),
      nonce: 0n,
      calls: [
        expect.objectContaining({
          to: wallet,
          data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [before.latest]),
        }),
      ],
    })

    // The new guard co-signs it, and the relayer sends it
    await signAll(manager!, settlementId!)
    expect(guardRequests).toEqual([newGuards.wallet])
    const results = await manager!.wallets.completeGuardSettlement(settlementId!)
    expect(results).toEqual([{ chainId: 42161, opHash: expect.any(String) }])

    // The wallet is deployed with the new configuration on-chain, nothing is left to settle
    const after = await onChainImageHash(manager!, wallet)
    expect(after.deployed).toBe(true)
    expect(after.onChain).toBe(after.latest)
    expect(await manager!.wallets.prepareGuardSettlement(wallet)).toBeUndefined()
  }, 30_000)

  it('Should not settle where the wallet is neither deployed nor funded', async () => {
    const wallet = await signUpWithOldGuards()
    rotate(manager!)

    await migrateAndSign(wallet)

    expect(await pendingSettlement()).toEqual([])
    expect(await manager!.wallets.prepareGuardSettlement(wallet)).toBeUndefined()
  }, 30_000)

  it('Should retry a failed settlement the next time the wallet opens', async () => {
    const wallet = await signUpWithOldGuards()
    await fund(wallet)
    rotate(manager!)
    await migrateAndSign(wallet)

    const [firstId] = await pendingSettlement()
    await signAll(manager!, firstId!)
    failNextRelay = true
    expect(await manager!.wallets.completeGuardSettlement(firstId!)).toEqual([
      { chainId: 42161, error: 'relayer unavailable' },
    ])

    // Nothing is stored: the next open finds the chain still behind and settles it
    const retryId = await manager!.wallets.prepareGuardSettlement(wallet)
    expect(retryId).toBeDefined()
    await signAll(manager!, retryId!)
    const retryResults = await manager!.wallets.completeGuardSettlement(retryId!)
    expect(retryResults).toEqual([{ chainId: 42161, opHash: expect.any(String) }])
    const after = await onChainImageHash(manager!, wallet)
    expect(after.onChain).toBe(after.latest)
  }, 30_000)

  it('Should settle two successive rotations, each in its own nonce space', async () => {
    const wallet = await signUpWithOldGuards()
    await fund(wallet)
    rotate(manager!)
    await migrateAndSign(wallet)

    const [firstId] = await pendingSettlement()
    const firstSpace = ((await manager!.signatures.get(firstId!)).envelope.payload as Payload.Calls).space
    await signAll(manager!, firstId!)
    await manager!.wallets.completeGuardSettlement(firstId!)

    // A second rotation: the first new guard becomes legacy too
    const sequence = (manager as any).shared.sequence
    sequence.guardAddresses = { ...newerGuards }
    sequence.legacyGuardAddresses = { wallet: [oldGuards.wallet, newGuards.wallet], sessions: [oldGuards.sessions] }
    await migrateAndSign(wallet)

    const [secondId] = await pendingSettlement()
    const secondSpace = ((await manager!.signatures.get(secondId!)).envelope.payload as Payload.Calls).space
    expect(secondSpace).not.toBe(firstSpace)
    await signAll(manager!, secondId!)
    expect(await manager!.wallets.completeGuardSettlement(secondId!)).toEqual([
      { chainId: 42161, opHash: expect.any(String) },
    ])

    const after = await onChainImageHash(manager!, wallet)
    expect(after.onChain).toBe(after.latest)
    expect((await manager!.wallets.getConfiguration(wallet)).walletGuard?.address).toBe(newerGuards.wallet)
  }, 30_000)

  it('Should not queue a settlement when the update did not move the wallet off an old guard', async () => {
    const wallet = await signUpWithOldGuards()
    await fund(wallet)

    const requestId = await manager!.wallets.requestConfigurationUpdate(wallet, {}, Actions.SessionUpdate)
    await signAll(manager!, requestId)
    await manager!.wallets.completeConfigurationUpdate(requestId)

    expect(await pendingSettlement()).toEqual([])
  }, 30_000)

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
})
