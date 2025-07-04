import { Signers as CoreSigners, Relayer, State } from '@0xsequence/wallet-core'

import { IdentityInstrument } from '@0xsequence/identity-instrument'
import { createAttestationVerifyingFetch } from '@0xsequence/tee-verifier'
import {
  Attestation,
  Config,
  Constants,
  Context,
  Extensions,
  Network,
  Payload,
  Signature as SequenceSignature,
  SessionConfig,
} from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import * as Db from '../dbs/index.js'
import { Cron } from './cron.js'
import { Devices } from './devices.js'
import { AuthCodeHandler } from './handlers/authcode.js'
import {
  AuthCodePkceHandler,
  DevicesHandler,
  Handler,
  MnemonicHandler,
  OtpHandler,
  PasskeysHandler,
} from './handlers/index.js'
import { RecoveryHandler } from './handlers/recovery.js'
import { Logger } from './logger.js'
import { Messages, MessagesInterface } from './messages.js'
import { Recovery } from './recovery.js'
import { AuthorizeImplicitSessionArgs, Sessions, SessionsInterface } from './sessions.js'
import { Signatures, SignaturesInterface } from './signatures.js'
import { Signers } from './signers.js'
import { Transactions, TransactionsInterface } from './transactions.js'
import { QueuedRecoveryPayload } from './types/index.js'
import { Message, MessageRequest } from './types/message-request.js'
import { Kinds, RecoverySigner } from './types/signer.js'
import { Wallets, WalletsInterface } from './wallets.js'

export type ManagerOptions = {
  verbose?: boolean

  extensions?: Extensions.Extensions
  context?: Context.Context
  guest?: Address.Address

  encryptedPksDb?: CoreSigners.Pk.Encrypted.EncryptedPksDb
  managerDb?: Db.Wallets
  transactionsDb?: Db.Transactions
  signaturesDb?: Db.Signatures
  messagesDb?: Db.Messages
  authCommitmentsDb?: Db.AuthCommitments
  authKeysDb?: Db.AuthKeys
  recoveryDb?: Db.Recovery

  dbPruningInterval?: number

  stateProvider?: State.Provider
  networks?: Network.Network[]
  relayers?: Relayer.Relayer[] | (() => Relayer.Relayer[])
  bundlers?: Relayer.Bundler[]

  defaultGuardTopology?: Config.Topology
  defaultRecoverySettings?: RecoverySettings

  // EIP-6963 support
  multiInjectedProviderDiscovery?: boolean

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
  context4337: Context.Dev2_4337,
  guest: Constants.DefaultGuest,

  encryptedPksDb: new CoreSigners.Pk.Encrypted.EncryptedPksDb(),
  managerDb: new Db.Wallets(),
  signaturesDb: new Db.Signatures(),
  transactionsDb: new Db.Transactions(),
  messagesDb: new Db.Messages(),
  authCommitmentsDb: new Db.AuthCommitments(),
  recoveryDb: new Db.Recovery(),
  authKeysDb: new Db.AuthKeys(),

  dbPruningInterval: 1000 * 60 * 60 * 24, // 24 hours

  stateProvider: new State.Sequence.Provider(),
  networks: Network.All,
  relayers: () => [Relayer.Standard.LocalRelayer.createFromWindow(window)].filter((r) => r !== undefined),
  bundlers: [],

  defaultGuardTopology: {
    // TODO: Move this somewhere else
    type: 'signer',
    address: '0xf71eC72C8C03a0857DD7601ACeF1e42b85983e99',
    weight: 1n,
  } as Config.SignerLeaf,

  defaultSessionsTopology: {
    // TODO: Move this somewhere else
    type: 'sapient-signer',
    weight: 10n,
  } as Omit<Config.SapientSignerLeaf, 'imageHash'>,

  defaultRecoverySettings: {
    requiredDeltaTime: 2592000n, // 30 days (in seconds)
    minTimestamp: 0n,
  },

  multiInjectedProviderDiscovery: true,

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
  readonly messages: Db.Messages
  readonly transactions: Db.Transactions
  readonly authCommitments: Db.AuthCommitments
  readonly authKeys: Db.AuthKeys
  readonly recovery: Db.Recovery

  readonly pruningInterval: number
}

export type Sequence = {
  readonly context: Context.Context
  readonly context4337: Context.Context
  readonly extensions: Extensions.Extensions
  readonly guest: Address.Address

  readonly stateProvider: State.Provider

  readonly networks: Network.Network[]
  readonly relayers: Relayer.Relayer[]
  readonly bundlers: Relayer.Bundler[]

  readonly defaultGuardTopology: Config.Topology
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
  readonly messages: Messages
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

  public readonly wallets: WalletsInterface
  public readonly signatures: SignaturesInterface
  public readonly transactions: TransactionsInterface
  public readonly messages: MessagesInterface
  public readonly sessions: SessionsInterface

  constructor(options?: ManagerOptions) {
    const ops = applyManagerOptionsDefaults(options)

    // Build relayers list
    let relayers: Relayer.Relayer[] = []

    // Add EIP-6963 relayers if enabled
    if (ops.multiInjectedProviderDiscovery) {
      try {
        relayers.push(...Relayer.Standard.EIP6963.getRelayers())
      } catch (error) {
        console.warn('Failed to initialize EIP-6963 relayers:', error)
      }
    }

    // Add configured relayers
    const configuredRelayers = typeof ops.relayers === 'function' ? ops.relayers() : ops.relayers
    relayers.push(...configuredRelayers)

    const shared: Shared = {
      verbose: ops.verbose,

      sequence: {
        context: ops.context,
        context4337: ops.context4337,
        extensions: ops.extensions,
        guest: ops.guest,

        stateProvider: ops.stateProvider,
        networks: ops.networks,
        relayers,
        bundlers: ops.bundlers,

        defaultGuardTopology: ops.defaultGuardTopology,
        defaultRecoverySettings: ops.defaultRecoverySettings,
      },

      databases: {
        encryptedPks: ops.encryptedPksDb,
        manager: ops.managerDb,
        signatures: ops.signaturesDb,
        transactions: ops.transactionsDb,
        messages: ops.messagesDb,
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
      messages: new Messages(shared),
      recovery: new Recovery(shared),
    }

    this.wallets = modules.wallets
    this.signatures = modules.signatures
    this.transactions = modules.transactions
    this.messages = modules.messages
    this.sessions = modules.sessions

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

  public getNetworks(): Network.Network[] {
    return this.shared.sequence.networks
  }

  public getNetwork(chainId: bigint): Network.Network | undefined {
    return this.shared.sequence.networks.find((n) => n.chainId === chainId)
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
