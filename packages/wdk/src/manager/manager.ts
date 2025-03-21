import { Address, Provider } from 'ox'

import { Extensions, Context, Config, Constants, Network, Payload } from '@0xsequence/sequence-primitives'
import { Signers, Wallet as CoreWallet, State, Relayer, Wallet } from '@0xsequence/sequence-core'
import * as Db from '../dbs'
import { v7 as uuidv7 } from 'uuid'
import { Logger } from './logger'
import { Devices } from './devices'
import { CreateWalletOptions, Wallets } from './wallets'
import { Transactions } from './transactions'
import { Signatures } from './signatures'

export type Transaction = {
  to: Address.Address
  value?: bigint
  data?: Uint8Array
}

export type ManagerOptions = {
  verbose?: boolean

  extensions?: Extensions.Extensions
  context?: Context.Context
  guest?: Address.Address

  encryptedPksDb?: Signers.Pk.Encrypted.EncryptedPksDb
  managerDb?: Db.Manager
  transactionsDb?: Db.Transactions
  signaturesDb?: Db.Signatures

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
  managerDb: new Db.Manager(),
  signaturesDb: new Db.Signatures(),
  transactionsDb: new Db.Transactions(),

  stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore()),
  networks: Network.All,
  relayers: [], // TODO: How to auto-populate local relayer?

  defaultGuardTopology: {
    // TODO: Move this somewhere else
    type: 'signer',
    address: '0xf71eC72C8C03a0857DD7601ACeF1e42b85983e99',
    weight: 1n,
  } as Config.SignerLeaf,
}

export const CreateWalletOptionsDefaults = {
  useGuard: false,
}

export function applyDefaults(options?: ManagerOptions) {
  return { ...ManagerOptionsDefaults, ...options }
}

export class Manager {
  public readonly verbose: boolean

  public readonly extensions: Extensions.Extensions
  public readonly context: Context.Context
  public readonly guestModule: Address.Address

  public readonly stateProvider: State.Provider
  public readonly networks: Network.Network[]
  public readonly relayers: Relayer.Relayer[]

  private readonly encryptedPksDb
  private readonly managerDb
  private readonly signaturesDb
  private readonly transactionsDb

  public readonly defaultGuardTopology: Config.Topology
  private readonly modules

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
    this.signaturesDb = ops.signaturesDb
    this.transactionsDb = ops.transactionsDb
    this.networks = ops.networks
    this.relayers = ops.relayers

    const logger = new Logger(this.verbose)
    const devices = new Devices(logger, this.encryptedPksDb)
    const wallets = new Wallets(
      logger,
      devices,
      this.managerDb,
      this.extensions,
      this.context,
      this.defaultGuardTopology,
      this.stateProvider,
      this.guestModule,
    )
    const signatures = new Signatures(this.signaturesDb, this.networks, this.stateProvider)
    const transactions = new Transactions(
      signatures,
      this.transactionsDb,
      this.networks,
      this.stateProvider,
      this.relayers,
    )

    this.modules = {
      logger,
      devices,
      wallets,
      signatures,
      transactions,
    }
  }

  public async createWallet(options: CreateWalletOptions) {
    return this.modules.wallets.create(options)
  }

  public async listWallets() {
    return this.modules.wallets.list()
  }

  public async hasWallet(address: Address.Address) {
    return this.modules.wallets.exists(address)
  }

  public async requestTransaction(
    from: Address.Address,
    chainId: bigint,
    txs: Db.TransactionRequest[],
    options?: { skipDefineGas?: boolean; source?: string },
  ) {
    return this.modules.transactions.request(from, chainId, txs, options)
  }
}
