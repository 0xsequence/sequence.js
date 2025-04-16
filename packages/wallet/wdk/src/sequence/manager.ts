import { Signers as CoreSigners, Relayer, State } from '@0xsequence/wallet-core'
import { Config, Constants, Context, Extensions, Network, Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import * as Db from '../dbs'
import * as Identity from '../identity'
import { Devices } from './devices'
import { DevicesHandler, Handler, PasskeysHandler } from './handlers'
import { AuthCodePkceHandler } from './handlers/authcode-pkce'
import { MnemonicHandler } from './handlers/mnemonic'
import { OtpHandler } from './handlers/otp'
import { Logger } from './logger'
import { Sessions } from './sessions'
import { Signatures } from './signatures'
import { Signers } from './signers'
import { Transactions } from './transactions'
import { BaseSignatureRequest, SignatureRequest, Wallet } from './types'
import { Transaction, TransactionRequest } from './types/transactionRequest'
import { CompleteRedirectArgs, LoginArgs, SignupArgs, StartSignUpWithRedirectArgs, Wallets } from './wallets'
import { Kinds } from './types/signer'

export type ManagerOptions = {
  verbose?: boolean

  extensions?: Extensions.Extensions
  context?: Context.Context
  guest?: Address.Address

  encryptedPksDb?: CoreSigners.Pk.Encrypted.EncryptedPksDb
  managerDb?: Db.Wallets
  transactionsDb?: Db.Transactions
  signaturesDb?: Db.Signatures
  authCommitmentsDb?: Db.AuthCommitments

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
  managerDb: new Db.Wallets(),
  signaturesDb: new Db.Signatures(),
  transactionsDb: new Db.Transactions(),
  authCommitmentsDb: new Db.AuthCommitments(),

  stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore()),
  networks: Network.All,
  relayers: [Relayer.Local.LocalRelayer.createFromWindow(window)].filter((r) => r !== undefined),

  defaultGuardTopology: {
    // TODO: Move this somewhere else
    type: 'signer',
    address: '0xf71eC72C8C03a0857DD7601ACeF1e42b85983e99',
    weight: 1n,
  } as Config.SignerLeaf,

  defaultSessionsTopology: {
    // TODO: Move this somewhere else
    type: 'sapient-signer',
    address: Constants.DefaultSessionManager,
    weight: 1n,
  } as Omit<Config.SapientSignerLeaf, 'imageHash'>,
}

export const CreateWalletOptionsDefaults = {
  useGuard: false,
}

export function applyDefaults(options?: ManagerOptions) {
  return { ...ManagerOptionsDefaults, ...options }
}

export type Databases = {
  readonly encryptedPks: CoreSigners.Pk.Encrypted.EncryptedPksDb
  readonly manager: Db.Wallets
  readonly signatures: Db.Signatures
  readonly transactions: Db.Transactions
  readonly authCommitments: Db.AuthCommitments
}

export type Sequence = {
  readonly context: Context.Context
  readonly extensions: Extensions.Extensions
  readonly guest: Address.Address

  readonly stateProvider: State.Provider

  readonly networks: Network.Network[]
  readonly relayers: Relayer.Relayer[]

  readonly defaultGuardTopology: Config.Topology
  readonly defaultSessionsTopology: Omit<Config.SapientSignerLeaf, 'imageHash'>
}

export type Modules = {
  readonly logger: Logger
  readonly devices: Devices
  readonly wallets: Wallets
  readonly sessions: Sessions
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
  private readonly otpHandler: OtpHandler

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
        defaultSessionsTopology: ops.defaultSessionsTopology,
      },

      databases: {
        encryptedPks: ops.encryptedPksDb,
        manager: ops.managerDb,
        signatures: ops.signaturesDb,
        transactions: ops.transactionsDb,
        authCommitments: ops.authCommitmentsDb,
      },

      modules: {} as any,
      handlers: new Map(),
    }

    const modules: Modules = {
      logger: new Logger(shared),
      devices: new Devices(shared),
      wallets: new Wallets(shared),
      sessions: new Sessions(shared),
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

    // TODO: configurable nitro rpc
    const nitro = new Identity.IdentityInstrument('https://dev-identity.sequence-dev.app', window.fetch)
    this.otpHandler = new OtpHandler(nitro, modules.signatures)
    shared.handlers.set(Kinds.LoginEmailOtp, this.otpHandler)
    shared.handlers.set(
      Kinds.LoginGooglePkce,
      new AuthCodePkceHandler(
        'google-pkce',
        'https://accounts.google.com',
        '970987756660-1evc76k7g9sd51qn9lodiu7e97ls0mmm.apps.googleusercontent.com',
        nitro,
        modules.signatures,
        shared.databases.authCommitments,
      ),
    )

    shared.modules = modules
    this.shared = shared
  }

  // Wallets

  public async startSignUpWithRedirect(args: StartSignUpWithRedirectArgs) {
    return this.shared.modules.wallets.startSignUpWithRedirect(args)
  }

  public async completeRedirect(args: CompleteRedirectArgs) {
    return this.shared.modules.wallets.completeRedirect(args)
  }

  public async signUp(options: SignupArgs) {
    return this.shared.modules.wallets.signUp(options)
  }

  public async logout(wallet: Address.Address, options?: { skipRemoveDevice?: boolean }) {
    return this.shared.modules.wallets.logout(wallet, options)
  }

  public async completeLogout(requestId: string, options?: { skipValidateSave?: boolean }) {
    return this.shared.modules.wallets.completeLogout(requestId, options)
  }

  public async login(args: LoginArgs) {
    return this.shared.modules.wallets.login(args)
  }

  public async completeLogin(requestId: string) {
    return this.shared.modules.wallets.completeLogin(requestId)
  }

  public async listWallets() {
    return this.shared.modules.wallets.list()
  }

  public async hasWallet(address: Address.Address) {
    return this.shared.modules.wallets.exists(address)
  }

  public onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean) {
    return this.shared.modules.wallets.onWalletsUpdate(cb, trigger)
  }

  // Signatures

  public async listSignatureRequests(): Promise<SignatureRequest[]> {
    return this.shared.modules.signatures.list()
  }

  public async getSignatureRequest(requestId: string): Promise<BaseSignatureRequest> {
    return this.shared.modules.signatures.get(requestId)
  }

  public onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean) {
    return this.shared.modules.signatures.onSignatureRequestsUpdate(cb, trigger)
  }

  public onSignatureRequestUpdate(
    requestId: string,
    cb: (requests: SignatureRequest) => void,
    onError?: (error: Error) => void,
    trigger?: boolean,
  ) {
    return this.shared.modules.signatures.onSignatureRequestUpdate(requestId, cb, onError, trigger)
  }

  public async deleteSignatureRequest(requestId: string) {
    return this.shared.modules.signatures.delete(requestId)
  }

  // Transactions

  public async requestTransaction(
    from: Address.Address,
    chainId: bigint,
    txs: TransactionRequest[],
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

  public async selectTransactionRelayer(transactionId: string, relayerOptionId: string) {
    return this.shared.modules.transactions.selectRelayer(transactionId, relayerOptionId)
  }

  public async relayTransaction(transactionOrSignatureId: string) {
    return this.shared.modules.transactions.relay(transactionOrSignatureId)
  }

  public async deleteTransaction(transactionId: string) {
    return this.shared.modules.transactions.delete(transactionId)
  }

  public onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean) {
    return this.shared.modules.transactions.onTransactionsUpdate(cb, trigger)
  }

  public onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean) {
    return this.shared.modules.transactions.onTransactionUpdate(transactionId, cb, trigger)
  }

  public registerMnemonicUI(onPromptMnemonic: (respond: (mnemonic: string) => Promise<void>) => Promise<void>) {
    return this.mnemonicHandler.registerUI(onPromptMnemonic)
  }

  public registerOtpUI(onPromptOtp: (recipient: string, respond: (otp: string) => Promise<void>) => Promise<void>) {
    return this.otpHandler.registerUI(onPromptOtp)
  }

  public async setRedirectPrefix(prefix: string) {
    this.shared.handlers.forEach((handler) => {
      if (handler instanceof AuthCodePkceHandler) {
        handler.setRedirectUri(prefix + '/' + handler.signupKind)
      }
    })
  }

  // Sessions

  public async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    return this.shared.modules.sessions.getSessionTopology(walletAddress)
  }

  public async addImplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address) {
    return this.shared.modules.sessions.addImplicitSession(walletAddress, sessionAddress)
  }

  public async addExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
  ): Promise<string> {
    return this.shared.modules.sessions.addExplicitSession(walletAddress, sessionAddress, permissions)
  }

  public async removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address): Promise<string> {
    return this.shared.modules.sessions.removeExplicitSession(walletAddress, sessionAddress)
  }

  public async addBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string> {
    return this.shared.modules.sessions.addBlacklistAddress(walletAddress, address)
  }

  public async removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string> {
    return this.shared.modules.sessions.removeBlacklistAddress(walletAddress, address)
  }

  public async completeSessionUpdate(requestId: string) {
    const sigRequest = await this.shared.modules.signatures.get(requestId)
    if (sigRequest.action !== 'session-update' || !Payload.isConfigUpdate(sigRequest.envelope.payload)) {
      throw new Error('Invalid action')
    }
    console.log('Completing session update:', requestId)
    return this.shared.modules.sessions.completeSessionUpdate(sigRequest.wallet, requestId)
  }

  public async getConfiguration(wallet: Address.Address) {
    return this.shared.modules.wallets.getConfiguration({ wallet })
  }
}
