import { describe, expect, it } from 'vitest'
import { Address, Bytes, Hex, Mnemonic } from 'ox'
import { Wallet as CoreWallet, State } from '@0xsequence/wallet-core'
import { Config, Constants, Context, Extensions, GenericTree, Signature } from '@0xsequence/wallet-primitives'
import { Manager, SignerActionable, SignerReady } from '../src/sequence/index.js'
import { newManager } from './constants.js'

const RECOVERY_EXTENSIONS = [
  Extensions.Dev1.recovery,
  Extensions.Dev2.recovery,
  Extensions.Rc3.recovery,
  Extensions.Rc4.recovery,
  Extensions.Rc5.recovery,
]

const RECOVERY_LEAF_PREFIX = Bytes.fromString('Sequence recovery leaf:\n')

const ZERO_LEAF: Extensions.Recovery.RecoveryLeaf = {
  type: 'leaf',
  signer: Constants.ZeroAddress,
  requiredDeltaTime: 0n,
  minTimestamp: 0n,
}

const ZERO_LEAF_IMAGE_HASH = Extensions.Recovery.hashConfiguration(ZERO_LEAF)

// Keeps track of every configuration written to the state provider
class RecordingProvider extends State.Local.Provider {
  public configurations: Config.Config[] = []

  constructor() {
    super(new State.Local.IndexedDbStore())
  }

  async saveWallet(deployConfiguration: Config.Config, context: Context.Context) {
    this.configurations.push(deployConfiguration)
    return super.saveWallet(deployConfiguration, context)
  }

  saveConfiguration(config: Config.Config) {
    this.configurations.push(config)
    return super.saveConfiguration(config)
  }

  async saveUpdate(wallet: Address.Address, configuration: Config.Config, signature: Signature.RawSignature) {
    this.configurations.push(configuration)
    return super.saveUpdate(wallet, configuration, signature)
  }
}

function expectPlaceholder(leaves: Extensions.Recovery.RecoveryLeaf[] | undefined) {
  expect(leaves?.length).toBe(1)
  const [leaf] = leaves!
  expect(Address.isEqual(leaf!.signer, Extensions.Recovery.PLACEHOLDER_SIGNER)).toBe(true)
  expect(leaf!.requiredDeltaTime).toBe(Extensions.Recovery.PLACEHOLDER_LEAF.requiredDeltaTime)
  expect(leaf!.minTimestamp).toBe(Extensions.Recovery.PLACEHOLDER_LEAF.minTimestamp)
}

function isRecoveryExtension(address: Address.Address) {
  return RECOVERY_EXTENSIONS.some((ext) => Address.isEqual(ext, address))
}

function findRecoverySapientLeaves(topology: Config.Topology): Config.SapientSignerLeaf[] {
  if (Config.isNode(topology)) {
    return [...findRecoverySapientLeaves(topology[0]), ...findRecoverySapientLeaves(topology[1])]
  }
  if (Config.isNestedLeaf(topology)) {
    return findRecoverySapientLeaves(topology.tree)
  }
  if (Config.isSapientSignerLeaf(topology) && isRecoveryExtension(topology.address)) {
    return [topology]
  }
  return []
}

// Same rules as the guard's recovery filter: the recovery tree must be retrievable,
// must not be the single zero leaf tree, and must not contain any leaf with signer 0x0
function hasZeroSignerLeaf(tree: GenericTree.Tree): boolean {
  if (GenericTree.isBranch(tree)) {
    return tree.some(hasZeroSignerLeaf)
  }
  if (GenericTree.isLeaf(tree)) {
    const value = tree.value
    if (
      value.length !== RECOVERY_LEAF_PREFIX.length + 20 + 32 + 32 ||
      !Bytes.isEqual(value.slice(0, RECOVERY_LEAF_PREFIX.length), RECOVERY_LEAF_PREFIX)
    ) {
      return false
    }
    const signer = value.slice(RECOVERY_LEAF_PREFIX.length, RECOVERY_LEAF_PREFIX.length + 20)
    return signer.every((b) => b === 0)
  }
  return false
}

async function expectValidConfiguration(provider: State.Provider, configuration: Config.Config) {
  for (const leaf of findRecoverySapientLeaves(configuration.topology)) {
    expect(leaf.imageHash).not.toBe(ZERO_LEAF_IMAGE_HASH)

    const tree = await provider.getTree(leaf.imageHash)
    expect(tree).toBeDefined()
    expect(hasZeroSignerLeaf(tree!)).toBe(false)

    // A placeholder leaf is only ever alone
    const { leaves, isComplete } = Extensions.Recovery.getRecoveryLeaves(Extensions.Recovery.fromGenericTree(tree!))
    expect(isComplete).toBe(true)
    if (leaves.some(Extensions.Recovery.isPlaceholderLeaf)) {
      expectPlaceholder(leaves)
    }
  }

  // Signable, and the threshold is reachable without any recovery module
  expect(() => Config.evaluateConfigurationSafety(configuration)).not.toThrow()
  const { maxWeight } = Config.getWeight(
    configuration.topology,
    (leaf) => !(Config.isSapientSignerLeaf(leaf) && isRecoveryExtension(leaf.address)),
  )
  expect(maxWeight >= configuration.threshold).toBe(true)
}

async function expectValidConfigurations(provider: RecordingProvider, from = 0) {
  const configurations = provider.configurations.slice(from)
  expect(configurations.length).toBeGreaterThan(0)
  for (const configuration of configurations) {
    await expectValidConfiguration(provider, configuration)
  }
}

async function recoveryLeaves(manager: Manager, provider: State.Provider, wallet: Address.Address) {
  const { modules } = await manager.wallets.getConfigurationParts(wallet)
  const recovery = modules.find((m) => Address.isEqual(m.sapientLeaf.address, Extensions.Rc5.recovery))
  if (!recovery) {
    return undefined
  }
  const tree = await provider.getTree(recovery.sapientLeaf.imageHash)
  return Extensions.Recovery.getRecoveryLeaves(Extensions.Recovery.fromGenericTree(tree!)).leaves
}

async function signWithDevice(manager: Manager, requestId: string) {
  const request = await manager.signatures.get(requestId)
  const device = request.signers.find((s) => s.handler?.kind === 'local-device')
  expect(device?.status).toBe('ready')
  await (device as SignerReady).handle()
}

async function signWithMnemonic(manager: Manager, requestId: string, mnemonic: string) {
  const unregister = manager.registerMnemonicUI(async (respond) => {
    await respond(mnemonic)
  })
  try {
    const request = await manager.signatures.get(requestId)
    const signer = request.signers.find((s) => s.handler?.kind === 'login-mnemonic')
    expect(signer?.status).toBe('actionable')
    await (signer as SignerActionable).handle()
  } finally {
    unregister()
  }
}

async function loginNewDevice(provider: RecordingProvider, wallet: Address.Address, mnemonic: string, tag: string) {
  const manager = newManager({ stateProvider: provider }, undefined, tag)
  const requestId = await manager.wallets.login({ wallet })
  await signWithMnemonic(manager, requestId, mnemonic)
  await manager.wallets.completeLogin(requestId)
  return manager
}

async function logoutDevice(manager: Manager, wallet: Address.Address) {
  const requestId = await manager.wallets.logout(wallet)
  await signWithDevice(manager, requestId)
  await manager.wallets.completeLogout(requestId)
}

async function localDevice(manager: Manager, wallet: Address.Address) {
  const devices = await manager.wallets.listDevices(wallet)
  return devices.find((d) => d.isLocal)!.address
}

async function loginSigners(manager: Manager, wallet: Address.Address) {
  return (await manager.wallets.getConfiguration(wallet)).login.map((l) => l.address)
}

async function addedLoginSigner(manager: Manager, wallet: Address.Address, before: Address.Address[]) {
  const added = (await loginSigners(manager, wallet)).filter((a) => !before.some((b) => Address.isEqual(a, b)))
  expect(added.length).toBe(1)
  return added[0]!
}

// Writes a configuration update directly, without going through the wallet flows,
// to reproduce configurations created by earlier versions
async function writeConfigurationUpdate(
  manager: Manager,
  wallet: Address.Address,
  mutate: (configuration: Config.Config) => void,
) {
  const shared = (manager as any).shared
  const coreWallet = new CoreWallet(wallet, {
    stateProvider: shared.sequence.stateProvider,
    guest: shared.sequence.guest,
  })
  const status = await coreWallet.getStatus()
  const next = structuredClone(status.configuration)
  next.checkpoint += 1n
  mutate(next)

  const envelope = await coreWallet.prepareUpdate(next)
  const requestId = await shared.modules.signatures.request(envelope, 'session-update')
  await signWithDevice(manager, requestId)
  await manager.wallets.completeConfigurationUpdate(requestId)
}

async function writeRecoveryTree(
  manager: Manager,
  provider: State.Provider,
  wallet: Address.Address,
  leaves: Extensions.Recovery.RecoveryLeaf[],
  extension: Address.Address = Extensions.Rc5.recovery,
) {
  // Built by hand, as fromRecoveryLeaves refuses zero address signers
  const tree = leaves
    .map((l) => Extensions.Recovery.toGenericTree(l))
    .reduce((acc, l) => [acc, l] as GenericTree.Branch)
  await provider.saveTree(tree)
  const imageHash = GenericTree.hash(tree)

  await writeConfigurationUpdate(manager, wallet, (configuration) => {
    const [leaf] = findRecoverySapientLeaves(configuration.topology)
    leaf!.address = extension
    leaf!.imageHash = imageHash
  })
}

function deviceLeaf(address: Address.Address): Extensions.Recovery.RecoveryLeaf {
  return {
    type: 'leaf',
    signer: address,
    requiredDeltaTime: 2592000n,
    minTimestamp: 0n,
  }
}

describe('Recovery configuration', () => {
  it('Should sign up with the device as the only recovery signer', async () => {
    const provider = new RecordingProvider()
    const manager = newManager({ stateProvider: provider })
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const device = await localDevice(manager, wallet!)
    expect((await recoveryLeaves(manager, provider, wallet!))?.map((l) => l.signer)).toEqual([device])
    await expectValidConfigurations(provider)
  })

  for (const noSessionManager of [false, true]) {
    it(`Should keep a noRecovery wallet without recovery across new device logins and logouts${noSessionManager ? ' (no modules)' : ''}`, async () => {
      const provider = new RecordingProvider()
      const mnemonic = Mnemonic.random(Mnemonic.english)
      const manager1 = newManager({ stateProvider: provider }, undefined, `norecovery-1-${noSessionManager}`)
      const wallet = await manager1.wallets.signUp({
        mnemonic,
        kind: 'mnemonic',
        noGuard: true,
        noRecovery: true,
        noSessionManager,
      })
      await expect(manager1.recovery.getSigners(wallet!)).resolves.toBeUndefined()
      const { modules } = await manager1.wallets.getConfigurationParts(wallet!)
      expect(modules.length).toBe(noSessionManager ? 0 : 1)

      // New device login
      const manager2 = await loginNewDevice(provider, wallet!, mnemonic, `norecovery-2-${noSessionManager}`)
      expect((await manager2.wallets.listDevices(wallet!)).length).toBe(2)
      await expect(manager2.recovery.getSigners(wallet!)).resolves.toBeUndefined()

      // Both devices log out, then a third device logs in
      await logoutDevice(manager1, wallet!)
      await logoutDevice(manager2, wallet!)
      await expect(manager2.recovery.getSigners(wallet!)).resolves.toBeUndefined()

      const manager3 = await loginNewDevice(provider, wallet!, mnemonic, `norecovery-3-${noSessionManager}`)
      expect((await manager3.wallets.listDevices(wallet!)).length).toBe(1)
      await expect(manager3.recovery.getSigners(wallet!)).resolves.toBeUndefined()

      // Recovery can't be enabled on it by adding a recovery signer
      await expect(manager3.recovery.addMnemonic(wallet!, Mnemonic.random(Mnemonic.english))).rejects.toThrow(
        'recovery-module-not-enabled',
      )

      expect((await manager3.wallets.getConfigurationParts(wallet!)).modules.length).toBe(noSessionManager ? 0 : 1)
      await expectValidConfigurations(provider)
      await Promise.all([manager1.stop(), manager2.stop(), manager3.stop()])
    })
  }

  it('Should keep recovery enabled when the only device logs out, and add the next device', async () => {
    const provider = new RecordingProvider()
    const mnemonic = Mnemonic.random(Mnemonic.english)
    const manager1 = newManager({ stateProvider: provider }, undefined, 'only-device-1')
    const wallet = await manager1.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })

    await logoutDevice(manager1, wallet!)
    expectPlaceholder(await recoveryLeaves(manager1, provider, wallet!))
    await expect(manager1.recovery.getSigners(wallet!)).resolves.toEqual([])

    const manager2 = await loginNewDevice(provider, wallet!, mnemonic, 'only-device-2')
    const device2 = await localDevice(manager2, wallet!)
    expect((await recoveryLeaves(manager2, provider, wallet!))?.map((l) => l.signer)).toEqual([device2])
    const signers = await manager2.recovery.getSigners(wallet!)
    expect(signers?.map((s) => s.address)).toEqual([device2])
    expect(signers?.[0]?.kind).toBe('local-device')

    await expectValidConfigurations(provider)
    await Promise.all([manager1.stop(), manager2.stop()])
  })

  it('Should keep the placeholder when the last recovery signer is remotely logged out', async () => {
    const provider = new RecordingProvider()
    const mnemonic = Mnemonic.random(Mnemonic.english)
    const manager1 = newManager({ stateProvider: provider }, undefined, 'remote-1')
    const wallet = await manager1.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    const device1 = await localDevice(manager1, wallet!)
    const manager2 = await loginNewDevice(provider, wallet!, mnemonic, 'remote-2')
    const device2 = await localDevice(manager2, wallet!)

    // Device 1 stops being a recovery signer, device 2 is the last one
    const removeId = await manager1.recovery.removeSigner(wallet!, device1)
    await signWithDevice(manager1, removeId)
    await manager1.recovery.completeUpdate(removeId)
    expect((await recoveryLeaves(manager1, provider, wallet!))?.map((l) => l.signer)).toEqual([device2])

    const logoutId = await manager1.wallets.remoteLogout(wallet!, device2)
    await signWithDevice(manager1, logoutId)
    await manager1.wallets.completeConfigurationUpdate(logoutId)
    expectPlaceholder(await recoveryLeaves(manager1, provider, wallet!))

    await expectValidConfigurations(provider)
    await Promise.all([manager1.stop(), manager2.stop()])
  })

  it('Should keep the placeholder when the last recovery signer is removed as a login signer', async () => {
    const provider = new RecordingProvider()
    const manager = newManager({ stateProvider: provider })
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    const device = await localDevice(manager, wallet!)

    // A second login signer is also added as a recovery signer
    const loginMnemonic = Mnemonic.random(Mnemonic.english)
    const addId = await manager.wallets.addLoginSigner({ wallet: wallet!, kind: 'mnemonic', mnemonic: loginMnemonic })
    await signWithDevice(manager, addId)
    await manager.wallets.completeAddLoginSigner(addId)
    const loginSigner = (await recoveryLeaves(manager, provider, wallet!))!.find(
      (l) => !Address.isEqual(l.signer, device),
    )!.signer

    const removeDeviceId = await manager.recovery.removeSigner(wallet!, device)
    await signWithDevice(manager, removeDeviceId)
    await manager.recovery.completeUpdate(removeDeviceId)
    expect((await recoveryLeaves(manager, provider, wallet!))?.map((l) => l.signer)).toEqual([loginSigner])

    const removeLoginId = await manager.wallets.removeLoginSigner({ wallet: wallet!, signerAddress: loginSigner })
    await signWithDevice(manager, removeLoginId)
    await manager.wallets.completeRemoveLoginSigner(removeLoginId)
    expectPlaceholder(await recoveryLeaves(manager, provider, wallet!))
    expect((await manager.wallets.getConfiguration(wallet!)).login.length).toBe(1)

    await expectValidConfigurations(provider)
  })

  it('Should keep the placeholder when the last recovery signer is removed, and replace it when one is added', async () => {
    const provider = new RecordingProvider()
    const manager = newManager({ stateProvider: provider })
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    const device = await localDevice(manager, wallet!)

    const removeId = await manager.recovery.removeSigner(wallet!, device)
    await signWithDevice(manager, removeId)
    await manager.recovery.completeUpdate(removeId)
    expectPlaceholder(await recoveryLeaves(manager, provider, wallet!))

    // Unrelated updates keep the placeholder as is
    const blacklistId = await manager.sessions.addBlacklistAddress(wallet!, Address.from(Hex.random(20)))
    await signWithDevice(manager, blacklistId)
    await manager.sessions.complete(blacklistId)
    expectPlaceholder(await recoveryLeaves(manager, provider, wallet!))

    // Removing it again is a no-op
    const removeAgainId = await manager.recovery.removeSigner(wallet!, device)
    await signWithDevice(manager, removeAgainId)
    await manager.recovery.completeUpdate(removeAgainId)
    expectPlaceholder(await recoveryLeaves(manager, provider, wallet!))

    const addId = await manager.recovery.addSigner(wallet!, device)
    await signWithDevice(manager, addId)
    await manager.recovery.completeUpdate(addId)
    expect((await recoveryLeaves(manager, provider, wallet!))?.map((l) => l.signer)).toEqual([device])

    await expectValidConfigurations(provider)
  })

  it('Should never produce a zero address recovery leaf', async () => {
    const provider = new RecordingProvider()
    const manager = newManager({ stateProvider: provider })
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    // Adding the zero address or the placeholder signer as a recovery signer is refused
    await expect(manager.recovery.addSigner(wallet!, Constants.ZeroAddress)).rejects.toThrow('invalid-recovery-signer')
    await expect(manager.recovery.addSigner(wallet!, Extensions.Recovery.PLACEHOLDER_SIGNER)).rejects.toThrow(
      'invalid-recovery-signer',
    )

    // So is any configuration pointing to a zero address leaf, or to a tree that can't be inspected
    const shared = (manager as any).shared
    const recovery = shared.modules.recovery
    const configuration = (
      await new CoreWallet(wallet!, { stateProvider: provider, guest: shared.sequence.guest }).getStatus()
    ).configuration

    const zeroTree = Extensions.Recovery.toGenericTree(ZERO_LEAF)
    await provider.saveTree(zeroTree)
    const withZeroLeaf = structuredClone(configuration)
    findRecoverySapientLeaves(withZeroLeaf.topology)[0]!.imageHash = GenericTree.hash(zeroTree)
    await expect(recovery.assertConfiguration(withZeroLeaf)).rejects.toThrow('recovery-module-zero-address-signer')

    const withUnknownTree = structuredClone(configuration)
    findRecoverySapientLeaves(withUnknownTree.topology)[0]!.imageHash = Hex.random(32)
    await expect(recovery.assertConfiguration(withUnknownTree)).rejects.toThrow('recovery-module-tree-not-found')

    await expect(recovery.assertConfiguration(configuration)).resolves.toBeUndefined()
  })

  describe('Configurations with a zero address recovery leaf', () => {
    type Flow = (args: {
      manager: Manager
      provider: RecordingProvider
      wallet: Address.Address
      mnemonic: string
      device: Address.Address
    }) => Promise<{ manager: Manager; expected: (device: Address.Address) => Address.Address[] }>

    const flows: [string, Flow][] = [
      [
        'login',
        async ({ provider, wallet, mnemonic }) => {
          const manager = await loginNewDevice(provider, wallet, mnemonic, 'legacy-login')
          const device2 = await localDevice(manager, wallet)
          return { manager, expected: (device) => [device, device2] }
        },
      ],
      [
        'logout',
        async ({ manager, wallet }) => {
          await logoutDevice(manager, wallet)
          return { manager, expected: () => [] }
        },
      ],
      [
        'remote logout',
        async ({ manager, provider, wallet, mnemonic }) => {
          const manager2 = await loginNewDevice(provider, wallet, mnemonic, 'legacy-remote')
          const device2 = await localDevice(manager2, wallet)
          const before = provider.configurations.length
          const requestId = await manager.wallets.remoteLogout(wallet, device2)
          await signWithDevice(manager, requestId)
          await manager.wallets.completeConfigurationUpdate(requestId)
          expect(provider.configurations.length).toBeGreaterThan(before)
          return { manager, expected: (device) => [device] }
        },
      ],
      [
        'add login signer',
        async ({ manager, wallet }) => {
          const before = await loginSigners(manager, wallet)
          const requestId = await manager.wallets.addLoginSigner({
            wallet,
            kind: 'mnemonic',
            mnemonic: Mnemonic.random(Mnemonic.english),
          })
          await signWithDevice(manager, requestId)
          await manager.wallets.completeAddLoginSigner(requestId)
          const added = await addedLoginSigner(manager, wallet, before)
          return { manager, expected: (device) => [device, added] }
        },
      ],
      [
        'remove login signer',
        async ({ manager, wallet }) => {
          const before = await loginSigners(manager, wallet)
          const addId = await manager.wallets.addLoginSigner({
            wallet,
            kind: 'mnemonic',
            mnemonic: Mnemonic.random(Mnemonic.english),
          })
          await signWithDevice(manager, addId)
          await manager.wallets.completeAddLoginSigner(addId)
          const added = await addedLoginSigner(manager, wallet, before)
          const removeId = await manager.wallets.removeLoginSigner({ wallet, signerAddress: added })
          await signWithDevice(manager, removeId)
          await manager.wallets.completeRemoveLoginSigner(removeId)
          return { manager, expected: (device) => [device] }
        },
      ],
      [
        'add recovery signer',
        async ({ manager, wallet }) => {
          const signer = Address.from(Hex.random(20))
          const requestId = await manager.recovery.addSigner(wallet, signer)
          await signWithDevice(manager, requestId)
          await manager.recovery.completeUpdate(requestId)
          return { manager, expected: (device) => [device, signer] }
        },
      ],
      [
        'remove recovery signer',
        async ({ manager, wallet, device }) => {
          const requestId = await manager.recovery.removeSigner(wallet, device)
          await signWithDevice(manager, requestId)
          await manager.recovery.completeUpdate(requestId)
          return { manager, expected: () => [] }
        },
      ],
      [
        'sessions update',
        async ({ manager, wallet }) => {
          const requestId = await manager.sessions.addBlacklistAddress(wallet, Address.from(Hex.random(20)))
          await signWithDevice(manager, requestId)
          await manager.sessions.complete(requestId)
          return { manager, expected: (device) => [device] }
        },
      ],
    ]

    const shapes: [string, (device: Address.Address) => Extensions.Recovery.RecoveryLeaf[]][] = [
      ['only a zero address leaf', () => [ZERO_LEAF]],
      ['a zero address leaf next to the device', (device) => [deviceLeaf(device), ZERO_LEAF]],
    ]

    for (const [shapeName, shape] of shapes) {
      for (const [flowName, flow] of flows) {
        it(`Should clean ${shapeName} on ${flowName}`, async () => {
          const provider = new RecordingProvider()
          const mnemonic = Mnemonic.random(Mnemonic.english)
          const manager = newManager({ stateProvider: provider }, undefined, `legacy-${flowName}`)
          const wallet = (await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true }))!
          const device = await localDevice(manager, wallet)

          await writeRecoveryTree(manager, provider, wallet, shape(device))
          const leaves = await recoveryLeaves(manager, provider, wallet)
          expect(leaves?.some((l) => Address.isEqual(l.signer, Constants.ZeroAddress))).toBe(true)
          const from = provider.configurations.length

          const result = await flow({ manager, provider, wallet, mnemonic, device })

          // The device is only expected if it was a recovery signer to begin with
          const deviceWasSigner = shape(device).some((l) => Address.isEqual(l.signer, device))
          const expectedSigners = result
            .expected(device)
            .filter((signer) => deviceWasSigner || !Address.isEqual(signer, device))
          const nextLeaves = await recoveryLeaves(result.manager, provider, wallet)
          if (expectedSigners.length === 0) {
            expectPlaceholder(nextLeaves)
          } else {
            expect(nextLeaves?.map((l) => l.signer).sort()).toEqual([...expectedSigners].sort())
          }
          await expectValidConfigurations(provider, from)
        })
      }
    }

    it('Should clean a zero address leaf of an older recovery extension', async () => {
      const provider = new RecordingProvider()
      const manager = newManager({ stateProvider: provider })
      const wallet = (await manager.wallets.signUp({
        mnemonic: Mnemonic.random(Mnemonic.english),
        kind: 'mnemonic',
        noGuard: true,
      }))!

      await writeRecoveryTree(manager, provider, wallet, [ZERO_LEAF], Extensions.Rc3.recovery)
      const from = provider.configurations.length

      const requestId = await manager.sessions.addBlacklistAddress(wallet, Address.from(Hex.random(20)))
      await signWithDevice(manager, requestId)
      await manager.sessions.complete(requestId)

      const { modules } = await manager.wallets.getConfigurationParts(wallet)
      const recovery = modules.find((m) => Address.isEqual(m.sapientLeaf.address, Extensions.Rc3.recovery))
      const tree = await provider.getTree(recovery!.sapientLeaf.imageHash)
      expectPlaceholder(Extensions.Recovery.getRecoveryLeaves(Extensions.Recovery.fromGenericTree(tree!)).leaves)
      await expectValidConfigurations(provider, from)
    })
  })
})
