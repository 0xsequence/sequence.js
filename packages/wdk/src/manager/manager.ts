import { Address } from 'ox'

import { Extensions, Context, Config, Constants, Network } from '@0xsequence/sequence-primitives'
import { Signers, Wallet as CoreWallet, State, Relayer } from '@0xsequence/sequence-core'
import { ManagerDb } from './db'

export type ManagerOptions = {
  verbose?: boolean

  extensions?: Extensions.Extensions
  context?: Context.Context
  guest?: Address.Address

  encryptedPksDb?: Signers.Pk.Encrypted.EncryptedPksDb
  managerDb?: ManagerDb

  stateProvider?: State.Provider
  networks?: Network.Network[]
  relayers?: Relayer.Relayer[]

  defaultGuardTopology?: Config.Topology
}

export const ManagerOptionsDefaults = {
  verbose: false,

  extensions: Extensions.Dev1,
  context: Context.Dev1,
  guest: Constants.DefaultGuest,
  encryptedPksDb: new Signers.Pk.Encrypted.EncryptedPksDb(),
  managerDb: new ManagerDb(),

  stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore()),
  network: Network.All,
  relayers: [], // TODO: How to auto-populate local relayer?

  defaultGuardTopology: {
    // TODO: Move this somewhere else
    type: 'signer',
    address: '0xf71eC72C8C03a0857DD7601ACeF1e42b85983e99',
    weight: 1n,
  } as Config.SignerLeaf,
}

export type CreateWalletOptions = {
  kind: 'passkey'
  useGuard?: boolean
}

export const CreateWalletOptionsDefaults = {
  useGuard: false,
}

export function applyDefaults(options?: ManagerOptions) {
  return { ...ManagerOptionsDefaults, ...options }
}

function buildCappedTreeFromTopology(weight: bigint, topology: Config.Topology): Config.Topology {
  // We may optimize this for some topology types
  // but it is not worth it, because the topology
  // that we will use for prod won't be optimizable
  return {
    type: 'nested',
    weight: weight,
    threshold: weight,
    tree: topology,
  }
}

function buildCappedTree(weight: bigint, members: Address.Address[]): Config.Topology {
  const loginMemberWeight = 1n

  if (members.length === 0) {
    throw new Error('Cannot build login tree with no members')
  }

  if (members.length === 1) {
    return {
      type: 'signer',
      address: members[0],
      weight: loginMemberWeight,
    } as Config.SignerLeaf
  }

  // Limit their total signing power
  return {
    type: 'nested',
    weight: loginMemberWeight,
    threshold: 1n,
    tree: Config.flatLeavesToTopology(
      members.map((member) => ({
        type: 'signer',
        address: member,
        weight: 1n,
      })),
    ),
  } as Config.NestedLeaf
}

export class Manager {
  public readonly verbose: boolean

  public readonly extensions: Extensions.Extensions
  public readonly context: Context.Context
  public readonly guestModule: Address.Address

  public readonly stateProvider: State.Provider

  private readonly encryptedPksDb
  private readonly managerDb

  public readonly defaultGuardTopology: Config.Topology

  private walletsDbListener: (() => void) | undefined
  private walletsListeners: ((wallets: Address.Address[]) => void)[] = []

  constructor(options?: ManagerOptions) {
    const ops = applyDefaults(options)
    this.extensions = ops.extensions
    this.context = ops.context
    this.verbose = ops.verbose
    this.defaultGuardTopology = ops.defaultGuardTopology
    this.stateProvider = ops.stateProvider
    this.guestModule = ops.guest
    this.encryptedPksDb = ops.encryptedPksDb
    this.managerDb = ops.managerDb
  }

  public async listWallets(): Promise<Address.Address[]> {
    return this.managerDb.listWallets().then((r) => r.map((x) => x.wallet))
  }

  public onWalletsUpdate(cb: (wallets: Address.Address[]) => void, trigger?: boolean) {
    if (!this.walletsDbListener) {
      this.walletsDbListener = this.managerDb.addListener(() => {
        this.listWallets().then((wallets) => {
          this.walletsListeners.forEach((cb) => cb(wallets))
        })
      })
    }

    this.walletsListeners.push(cb)

    if (trigger) {
      this.listWallets().then((wallets) => {
        cb(wallets)
      })
    }

    return () => {
      this.removeOnWalletsUpdate(cb)
    }
  }

  public removeOnWalletsUpdate(cb: (wallets: Address.Address[]) => void) {
    this.walletsListeners = this.walletsListeners.filter((x) => x !== cb)
    if (this.walletsListeners.length === 0 && this.walletsDbListener) {
      this.walletsDbListener()
      this.walletsDbListener = undefined
    }
  }

  private log(...args: any[]) {
    if (this.verbose) {
      console.log(...args)
    }
  }

  private async createDevice() {
    const e = await this.encryptedPksDb.generateAndStore()
    const s = await this.encryptedPksDb.getEncryptedPkStore(e.address)

    if (!s) {
      throw new Error('Failed to create session')
    }

    this.log('Created new session:', s.address)
    return new Signers.Pk.Pk(s)
  }

  async create(args: CreateWalletOptions) {
    switch (args.kind) {
      case 'passkey':
        const passkeySigner = await Signers.Passkey.Passkey.create(this.extensions)

        this.log('Created new passkey signer:', passkeySigner.address)

        // Create the first session
        const device = await this.createDevice()

        // If the guard is defined, set threshold to 2, if not, set to 1
        const threshold = this.defaultGuardTopology ? 2n : 1n

        // Build the login tree
        const loginTopology = buildCappedTree(1n, [passkeySigner.address])
        const devicesTopology = buildCappedTree(1n, [device.address])
        const guardTopology = buildCappedTreeFromTopology(1n, this.defaultGuardTopology)

        // TODO: Add recovery module
        // TODO: Add smart sessions module

        // Create initial configuration
        const initialConfiguration: Config.Config = {
          checkpoint: 0n,
          threshold,
          topology: Config.flatLeavesToTopology(
            [loginTopology, devicesTopology, guardTopology].filter((x) => x !== undefined) as Config.Leaf[],
          ),
        }

        // Create wallet
        const wallet = await CoreWallet.fromConfiguration(initialConfiguration, {
          context: this.context,
          stateProvider: this.stateProvider,
          guest: this.guestModule,
        })

        this.log('Created new sequence wallet:', wallet.address)

        // Sign witness using device signer
        await device.witness(this.stateProvider, wallet.address)

        // Sign witness using the passkey signer
        await passkeySigner.witness(this.stateProvider, wallet.address)

        // Save entry in the manager db
        await this.managerDb.saveWallet({
          wallet: wallet.address,
          status: 'logged-in',
          loginDate: new Date().toISOString(),
          device: device.address,
          loginType: 'passkey',
          useGuard: args.useGuard || false,
        })

        return wallet.address
      default:
        throw new Error(`Unsupported wallet kind: ${args.kind}`)
    }
  }
}
