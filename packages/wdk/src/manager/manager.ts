import { Address } from 'ox'

import { Extensions, Context, Config, Constants, Network, Payload } from '@0xsequence/sequence-primitives'
import { Signers as CoreSigners, State, Relayer } from '@0xsequence/sequence-core'
import * as Db from '../dbs'
import { Logger } from './logger'
import { Devices } from './devices'
import { SignupArgs, Wallets } from './wallets'
import { Transactions } from './transactions'
import { BaseSignatureRequest, SignatureRequest, Signatures } from './signatures'
import { Kinds, Signers } from './signers'
import { DevicesHandler, Handler, PasskeysHandler } from './handlers'
import { MnemonicHandler } from './handlers/mnemonic'

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

  encryptedPksDb?: CoreSigners.Pk.Encrypted.EncryptedPksDb
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

  encryptedPksDb: new CoreSigners.Pk.Encrypted.EncryptedPksDb(),
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

export type Databases = {
  readonly encryptedPks: CoreSigners.Pk.Encrypted.EncryptedPksDb
  readonly manager: Db.Manager
  readonly signatures: Db.Signatures
  readonly transactions: Db.Transactions
}

export type Sequence = {
  readonly context: Context.Context
  readonly extensions: Extensions.Extensions
  readonly guest: Address.Address

  readonly stateProvider: State.Provider

  readonly networks: Network.Network[]
  readonly relayers: Relayer.Relayer[]

  readonly defaultGuardTopology: Config.Topology
}

export type Modules = {
  readonly logger: Logger
  readonly devices: Devices
  readonly wallets: Wallets
  readonly signers: Signers
  readonly signatures: Signatures
  readonly transactions: Transactions
}

export type Shared = {
  readonly verbose: boolean

  readonly sequence: Sequence
  readonly databases: Databases

  readonly handlers: Map<string, Handler>

  modules: Modules
}

export class Manager {
  private readonly shared: Shared

  private readonly mnemonicHandler: MnemonicHandler
  private readonly devicesHandler: DevicesHandler
  private readonly passkeysHandler: PasskeysHandler

  constructor(options?: ManagerOptions) {
    const ops = applyDefaults(options)

    const shared: Shared = {
      verbose: ops.verbose,

      sequence: {
        context: ops.context,
        extensions: ops.extensions,
        guest: ops.guest,

        stateProvider: ops.stateProvider,
        networks: ops.networks,
        relayers: ops.relayers,

        defaultGuardTopology: ops.defaultGuardTopology,
      },

      databases: {
        encryptedPks: ops.encryptedPksDb,
        manager: ops.managerDb,
        signatures: ops.signaturesDb,
        transactions: ops.transactionsDb,
      },

      modules: {} as any,
      handlers: new Map(),
    }

    const modules: Modules = {
      logger: new Logger(shared),
      devices: new Devices(shared),
      wallets: new Wallets(shared),
      signers: new Signers(shared),
      signatures: new Signatures(shared),
      transactions: new Transactions(shared),
    }

    this.devicesHandler = new DevicesHandler(modules.signatures, modules.devices)
    shared.handlers.set(Kinds.LocalDevice, this.devicesHandler)

    this.passkeysHandler = new PasskeysHandler(
      modules.signatures,
      shared.sequence.extensions,
      shared.sequence.stateProvider,
    )
    shared.handlers.set(Kinds.LoginPasskey, this.passkeysHandler)

    this.mnemonicHandler = new MnemonicHandler(modules.signatures)
    shared.handlers.set(Kinds.LoginMnemonic, this.mnemonicHandler)

    shared.modules = modules
    this.shared = shared
  }

  // Wallets

  public async signUp(options: SignupArgs) {
    return this.shared.modules.wallets.signUp(options)
  }

  public async logout(wallet: Address.Address, options?: { skipRemoveDevice?: boolean }) {
    return this.shared.modules.wallets.logout(wallet, options)
  }

  public async completeLogout(requestId: string, options?: { skipValidateSave?: boolean }) {
    return this.shared.modules.wallets.completeLogout(requestId, options)
  }

  public async listWallets() {
    return this.shared.modules.wallets.list()
  }

  public async hasWallet(address: Address.Address) {
    return this.shared.modules.wallets.exists(address)
  }

  public onWalletsUpdate(cb: (wallets: Address.Address[]) => void, trigger?: boolean) {
    return this.shared.modules.wallets.onWalletsUpdate(cb, trigger)
  }

  // Signatures

  public async listSignatureRequests(): Promise<BaseSignatureRequest[]> {
    return this.shared.modules.signatures.list()
  }

  public async getSignatureRequest(requestId: string): Promise<BaseSignatureRequest> {
    return this.shared.modules.signatures.get(requestId)
  }

  public onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean) {
    return this.shared.modules.signatures.onSignatureRequestsUpdate(cb, trigger)
  }

  public async onSignatureRequestUpdate(
    requestId: string,
    cb: (requests: SignatureRequest) => void,
    onError?: (error: Error) => void,
    trigger?: boolean,
  ) {
    return this.shared.modules.signatures.onSignatureRequestUpdate(requestId, cb, onError, trigger)
  }

  // Transactions

  public async requestTransaction(
    from: Address.Address,
    chainId: bigint,
    txs: Db.TransactionRequest[],
    options?: { skipDefineGas?: boolean; source?: string },
  ) {
    return this.shared.modules.transactions.request(from, chainId, txs, options)
  }

  public async defineTransaction(
    transactionId: string,
    changes?: { nonce?: bigint; space?: bigint; calls?: Pick<Payload.Call, 'gasLimit'>[] },
  ) {
    return this.shared.modules.transactions.define(transactionId, changes)
  }

  public async selectRelayer(
    transactionId: string,
    selectRelayer: (relayerOptions: Db.RelayerOption[]) => Promise<Db.RelayerOption | undefined>,
  ) {
    return this.shared.modules.transactions.selectRelayer(transactionId, selectRelayer)
  }

  public onTransactionsUpdate(cb: (transactions: Db.TransactionRow[]) => void, trigger?: boolean) {
    return this.shared.modules.transactions.onTransactionsUpdate(cb, trigger)
  }

  public onTransactionUpdate(transactionId: string, cb: (transaction: Db.TransactionRow) => void, trigger?: boolean) {
    return this.shared.modules.transactions.onTransactionUpdate(transactionId, cb, trigger)
  }

  public async registerMnemonicUI(onPromptMnemonic: () => Promise<{ mnemonic: string; error: (e: string) => void }>) {
    return this.mnemonicHandler.registerUI(onPromptMnemonic)
  }
}
