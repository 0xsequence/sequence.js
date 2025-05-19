import { Signers as CoreSigners, Relayer, State } from '@0xsequence/wallet-core'

import {
  Attestation,
  Config,
  Constants,
  Context,
  Extensions,
  Network,
  Payload,
  SessionConfig,
  Signature as SequenceSignature,
} from '@0xsequence/wallet-primitives'
import { IdentityInstrument } from '@0xsequence/identity-instrument'
import { createAttestationVerifyingFetch } from '@0xsequence/tee-verifier'
import { Address } from 'ox'
import * as Db from '../dbs/index.js'
import { Devices } from './devices.js'
import {
  AuthCodePkceHandler,
  DevicesHandler,
  Handler,
  MnemonicHandler,
  OtpHandler,
  PasskeysHandler,
} from './handlers/index.js'
import { Logger } from './logger.js'
import { AuthorizeImplicitSessionArgs, Sessions } from './sessions.js'
import { Signatures } from './signatures.js'
import { Signers } from './signers.js'
import { Transactions } from './transactions.js'
import { BaseSignatureRequest, QueuedRecoveryPayload, SignatureRequest, Wallet } from './types/index.js'
import { Transaction, TransactionRequest } from './types/transaction-request.js'
import { CompleteRedirectArgs, LoginArgs, SignupArgs, StartSignUpWithRedirectArgs, Wallets } from './wallets.js'
import { Kinds, RecoverySigner } from './types/signer.js'
import { WalletSelectionUiHandler } from './types/wallet.js'
import { Cron } from './cron.js'
import { Recovery } from './recovery.js'
import { RecoveryHandler } from './handlers/recovery.js'
import { AuthCodeHandler } from './handlers/authcode.js'

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
  authKeysDb?: Db.AuthKeys
  recoveryDb?: Db.Recovery

  dbPruningInterval?: number

  stateProvider?: State.Provider
  networks?: Network.Network[]
  relayers?: Relayer.Relayer[] | (() => Relayer.Relayer[])

  defaultGuardTopology?: Config.Topology
  defaultRecoverySettings?: RecoverySettings

  identity?: {
    url?: string
    fetch?: typeof window.fetch
    verifyAttestation?: boolean
    expectedPcr0?: string[]
    email?: {
      enabled: boolean
    }
    google?: {
      enabled: boolean
      clientId: string
    }
    apple?: {
      enabled: boolean
      clientId: string
    }
  }
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
  recoveryDb: new Db.Recovery(),
  authKeysDb: new Db.AuthKeys(),

  dbPruningInterval: 1000 * 60 * 60 * 24, // 24 hours

  stateProvider: new State.Local.Provider(new State.Local.IndexedDbStore()),
  networks: Network.All,
  relayers: () => [Relayer.Local.LocalRelayer.createFromWindow(window)].filter((r) => r !== undefined),

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
    weight: 10n,
  } as Omit<Config.SapientSignerLeaf, 'imageHash'>,

  defaultRecoverySettings: {
    requiredDeltaTime: 2592000n, // 30 days (in seconds)
    minTimestamp: 0n,
  },

  identity: {
    // TODO: change to prod url once deployed
    url: 'https://dev-identity.sequence-dev.app',
    fetch: window.fetch,
    verifyAttestation: true,
    email: {
      enabled: false,
    },
    google: {
      enabled: false,
      clientId: '',
    },
    apple: {
      enabled: false,
      clientId: '',
    },
  },
}

export const CreateWalletOptionsDefaults = {
  useGuard: false,
}

export function applyManagerOptionsDefaults(options?: ManagerOptions) {
  return {
    ...ManagerOptionsDefaults,
    ...options,
    identity: { ...ManagerOptionsDefaults.identity, ...options?.identity },
  }
}

export type RecoverySettings = {
  requiredDeltaTime: bigint
  minTimestamp: bigint
}

export type Databases = {
  readonly encryptedPks: CoreSigners.Pk.Encrypted.EncryptedPksDb
  readonly manager: Db.Wallets
  readonly signatures: Db.Signatures
  readonly transactions: Db.Transactions
  readonly authCommitments: Db.AuthCommitments
  readonly authKeys: Db.AuthKeys
  readonly recovery: Db.Recovery

  readonly pruningInterval: number
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
  readonly defaultRecoverySettings: RecoverySettings
}

export type Modules = {
  readonly logger: Logger
  readonly devices: Devices
  readonly wallets: Wallets
  readonly sessions: Sessions
  readonly signers: Signers
  readonly signatures: Signatures
  readonly transactions: Transactions
  readonly recovery: Recovery
  readonly cron: Cron
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
  private readonly recoveryHandler: RecoveryHandler

  private readonly otpHandler?: OtpHandler

  constructor(options?: ManagerOptions) {
    const ops = applyManagerOptionsDefaults(options)

    const shared: Shared = {
      verbose: ops.verbose,

      sequence: {
        context: ops.context,
        extensions: ops.extensions,
        guest: ops.guest,

        stateProvider: ops.stateProvider,
        networks: ops.networks,
        relayers: typeof ops.relayers === 'function' ? ops.relayers() : ops.relayers,

        defaultGuardTopology: ops.defaultGuardTopology,
        defaultSessionsTopology: ops.defaultSessionsTopology,
        defaultRecoverySettings: ops.defaultRecoverySettings,
      },

      databases: {
        encryptedPks: ops.encryptedPksDb,
        manager: ops.managerDb,
        signatures: ops.signaturesDb,
        transactions: ops.transactionsDb,
        authCommitments: ops.authCommitmentsDb,
        authKeys: ops.authKeysDb,
        recovery: ops.recoveryDb,

        pruningInterval: ops.dbPruningInterval,
      },

      modules: {} as any,
      handlers: new Map(),
    }

    const modules: Modules = {
      cron: new Cron(shared),
      logger: new Logger(shared),
      devices: new Devices(shared),
      wallets: new Wallets(shared),
      sessions: new Sessions(shared),
      signers: new Signers(shared),
      signatures: new Signatures(shared),
      transactions: new Transactions(shared),
      recovery: new Recovery(shared),
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

    this.recoveryHandler = new RecoveryHandler(modules.signatures, modules.recovery)
    shared.handlers.set(Kinds.Recovery, this.recoveryHandler)

    const verifyingFetch = ops.identity.verifyAttestation
      ? createAttestationVerifyingFetch({
          fetch: ops.identity.fetch,
          expectedPCRs: ops.identity.expectedPcr0 ? new Map([[0, ops.identity.expectedPcr0]]) : undefined,
          logTiming: true,
        })
      : ops.identity.fetch
    const identityInstrument = new IdentityInstrument(ops.identity.url, verifyingFetch)

    if (ops.identity.email?.enabled) {
      this.otpHandler = new OtpHandler(identityInstrument, modules.signatures, shared.databases.authKeys)
      shared.handlers.set(Kinds.LoginEmailOtp, this.otpHandler)
    }
    if (ops.identity.google?.enabled) {
      shared.handlers.set(
        Kinds.LoginGooglePkce,
        new AuthCodePkceHandler(
          'google-pkce',
          'https://accounts.google.com',
          ops.identity.google.clientId,
          identityInstrument,
          modules.signatures,
          shared.databases.authCommitments,
          shared.databases.authKeys,
        ),
      )
    }
    if (ops.identity.apple?.enabled) {
      shared.handlers.set(
        Kinds.LoginApple,
        new AuthCodeHandler(
          'apple',
          'https://appleid.apple.com',
          ops.identity.apple.clientId,
          identityInstrument,
          modules.signatures,
          shared.databases.authCommitments,
          shared.databases.authKeys,
        ),
      )
    }

    shared.modules = modules
    this.shared = shared

    // Initialize modules
    for (const module of Object.values(modules)) {
      if ('initialize' in module && typeof module.initialize === 'function') {
        module.initialize()
      }
    }
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

  public registerWalletSelector(handler: WalletSelectionUiHandler) {
    return this.shared.modules.wallets.registerWalletSelector(handler)
  }

  public unregisterWalletSelector(handler?: WalletSelectionUiHandler) {
    return this.shared.modules.wallets.unregisterWalletSelector(handler)
  }

  public async getConfiguration(wallet: Address.Address) {
    return this.shared.modules.wallets.getConfiguration({ wallet })
  }

  // Signatures

  public async listSignatureRequests(): Promise<SignatureRequest[]> {
    return this.shared.modules.signatures.list()
  }

  public async getSignatureRequest(requestId: string): Promise<SignatureRequest> {
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

  public async cancelSignatureRequest(requestId: string) {
    return this.shared.modules.signatures.cancel(requestId)
  }

  // Transactions

  public async requestTransaction(
    from: Address.Address,
    chainId: bigint,
    txs: TransactionRequest[],
    options?: { skipDefineGas?: boolean; source?: string; noConfigUpdate?: boolean },
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

  public getTransaction(transactionId: string): Promise<Transaction> {
    return this.shared.modules.transactions.get(transactionId)
  }

  public registerMnemonicUI(onPromptMnemonic: (respond: (mnemonic: string) => Promise<void>) => Promise<void>) {
    return this.mnemonicHandler.registerUI(onPromptMnemonic)
  }

  public registerOtpUI(onPromptOtp: (recipient: string, respond: (otp: string) => Promise<void>) => Promise<void>) {
    return this.otpHandler?.registerUI(onPromptOtp) || (() => {})
  }

  public async setRedirectPrefix(prefix: string) {
    this.shared.handlers.forEach((handler) => {
      if (handler instanceof AuthCodeHandler) {
        handler.setRedirectUri(prefix + '/' + handler.signupKind)
      }
    })
  }

  // Sessions

  public async getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology> {
    return this.shared.modules.sessions.getSessionTopology(walletAddress)
  }

  public async prepareAuthorizeImplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    args: AuthorizeImplicitSessionArgs,
  ): Promise<string> {
    return this.shared.modules.sessions.prepareAuthorizeImplicitSession(walletAddress, sessionAddress, args)
    // Run completeAuthorizeImplicitSession next
  }

  public async completeAuthorizeImplicitSession(requestId: string): Promise<{
    attestation: Attestation.Attestation
    signature: SequenceSignature.RSY
  }> {
    return this.shared.modules.sessions.completeAuthorizeImplicitSession(requestId)
  }

  public async addExplicitSession(
    walletAddress: Address.Address,
    sessionAddress: Address.Address,
    permissions: CoreSigners.Session.ExplicitParams,
  ): Promise<string> {
    return this.shared.modules.sessions.addExplicitSession(walletAddress, sessionAddress, permissions)
    // Run completeSessionUpdate next
  }

  public async removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address): Promise<string> {
    return this.shared.modules.sessions.removeExplicitSession(walletAddress, sessionAddress)
    // Run completeSessionUpdate next
  }

  public async addBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string> {
    return this.shared.modules.sessions.addBlacklistAddress(walletAddress, address)
    // Run completeSessionUpdate next
  }

  public async removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string> {
    return this.shared.modules.sessions.removeBlacklistAddress(walletAddress, address)
    // Run completeSessionUpdate next
  }

  public async completeSessionUpdate(requestId: string) {
    return this.shared.modules.sessions.completeSessionUpdate(requestId)
  }

  // Recovery

  public async getRecoverySigners(wallet: Address.Address): Promise<RecoverySigner[] | undefined> {
    return this.shared.modules.recovery.getRecoverySigners(wallet)
  }

  public onQueuedRecoveryPayloadsUpdate(
    wallet: Address.Address,
    cb: (payloads: QueuedRecoveryPayload[]) => void,
    trigger?: boolean,
  ) {
    return this.shared.modules.recovery.onQueuedRecoveryPayloadsUpdate(wallet, cb, trigger)
  }

  public async queueRecoveryPayload(wallet: Address.Address, chainId: bigint, payload: Payload.Calls) {
    return this.shared.modules.recovery.queueRecoveryPayload(wallet, chainId, payload)
  }

  public async completeRecoveryPayload(requestId: string) {
    return this.shared.modules.recovery.completeRecoveryPayload(requestId)
  }

  public async addRecoveryMnemonic(wallet: Address.Address, mnemonic: string) {
    return this.shared.modules.recovery.addRecoveryMnemonic(wallet, mnemonic)
  }

  public async addRecoverySigner(wallet: Address.Address, address: Address.Address) {
    return this.shared.modules.recovery.addRecoverySigner(wallet, address)
  }

  public async removeRecoverySigner(wallet: Address.Address, address: Address.Address) {
    return this.shared.modules.recovery.removeRecoverySigner(wallet, address)
  }

  public async completeRecoveryUpdate(requestId: string) {
    return this.shared.modules.recovery.completeRecoveryUpdate(requestId)
  }

  public async updateQueuedRecoveryPayloads() {
    return this.shared.modules.recovery.updateQueuedRecoveryPayloads()
  }

  // DBs

  public async stop() {
    await this.shared.modules.cron.stop()

    await Promise.all([
      this.shared.databases.authKeys.close(),
      this.shared.databases.authCommitments.close(),
      this.shared.databases.manager.close(),
      this.shared.databases.recovery.close(),
      this.shared.databases.signatures.close(),
      this.shared.databases.transactions.close(),
    ])
  }
}
