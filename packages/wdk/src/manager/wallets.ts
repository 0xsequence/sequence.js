import { Logger } from './logger'
import * as Db from '../dbs'
import { Address } from 'ox'
import { Signers, State, Wallet } from '@0xsequence/sequence-core'
import { Config, Context, Extensions } from '@0xsequence/sequence-primitives'
import { Devices } from './devices'

export type CreateWalletOptions = {
  kind: 'passkey'
  useGuard?: boolean
}

function buildCappedTree(members: Address.Address[]): Config.Topology {
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

export class Wallets {
  private walletsDbListener: (() => void) | undefined
  private walletsListeners: ((wallets: Address.Address[]) => void)[] = []

  constructor(
    private readonly logger: Logger,
    private readonly devices: Devices,
    private readonly managerDb: Db.Manager,
    private readonly extensions: Extensions.Extensions,
    private readonly context: Context.Context,
    private readonly defaultGuardTopology: Config.Topology,
    private readonly stateProvider: State.Provider,
    private readonly guestModule: Address.Address,
  ) {}

  public async exists(wallet: Address.Address): Promise<boolean> {
    return this.managerDb.get(wallet).then((r) => r !== undefined)
  }

  public async list(): Promise<Address.Address[]> {
    return this.managerDb.list().then((r) => r.map((x) => x.wallet))
  }

  public onWalletsUpdate(cb: (wallets: Address.Address[]) => void, trigger?: boolean) {
    if (!this.walletsDbListener) {
      this.walletsDbListener = this.managerDb.addListener(() => {
        this.list().then((wallets) => {
          this.walletsListeners.forEach((cb) => cb(wallets))
        })
      })
    }

    this.walletsListeners.push(cb)

    if (trigger) {
      this.list().then((wallets) => {
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

  async create(args: CreateWalletOptions) {
    switch (args.kind) {
      case 'passkey':
        const passkeySigner = await Signers.Passkey.Passkey.create(this.extensions)

        this.logger.log('Created new passkey signer:', passkeySigner.address)

        // Create the first session
        const device = await this.devices.create()

        // If the guard is defined, set threshold to 2, if not, set to 1
        const threshold = this.defaultGuardTopology ? 2n : 1n

        // Build the login tree
        const loginTopology = buildCappedTree([passkeySigner.address])
        const devicesTopology = buildCappedTree([device.address])
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
        const wallet = await Wallet.fromConfiguration(initialConfiguration, {
          context: this.context,
          stateProvider: this.stateProvider,
          guest: this.guestModule,
        })

        this.logger.log('Created new sequence wallet:', wallet.address)

        // Sign witness using device signer
        await device.witness(this.stateProvider, wallet.address)

        // Sign witness using the passkey signer
        await passkeySigner.witness(this.stateProvider, wallet.address)

        // Save entry in the manager db
        await this.managerDb.set({
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
