import { Signers as CoreSigners, Relayer, State } from '@0xsequence/wallet-core'

import { IdentityInstrument } from '@0xsequence/identity-instrument'
import { createAttestationVerifyingFetch } from '@0xsequence/tee-verifier'
import { Config, Constants, Context, Extensions, Network } from '@0xsequence/wallet-primitives'
import * as Guard from '@0xsequence/guard'
import { Address, Hex, Secp256k1 } from 'ox'
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
import { Recovery, RecoveryInterface } from './recovery.js'
import { Sessions, SessionsInterface } from './sessions.js'
import { Signatures, SignaturesInterface } from './signatures.js'
import { Signers } from './signers.js'
import { Transactions, TransactionsInterface } from './transactions.js'
import { Kinds } from './types/signer.js'
import { Wallets, WalletsInterface } from './wallets.js'
import { GuardHandler } from './handlers/guard.js'

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
  passkeyCredentialsDb?: Db.PasskeyCredentials

  dbPruningInterval?: number

  stateProvider?: State.Provider
  networks?: Network.Network[]
  relayers?: Relayer.Relayer[] | (() => Relayer.Relayer[])
  bundlers?: Relayer.Bundler[]
  guardUrl?: string
  guardAddress?: Address.Address

  defaultGuardTopology?: Config.Topology
  defaultRecoverySettings?: RecoverySettings

  // EIP-6963 support
  multiInjectedProviderDiscovery?: boolean

  identity?: {
    url?: string
    fetch?: typeof window.fetch
    verifyAttestation?: boolean
    expectedPcr0?: string[]
    scope?: string
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
  guest: Constants.DefaultGuestAddress,

  encryptedPksDb: new CoreSigners.Pk.Encrypted.EncryptedPksDb(),
  managerDb: new Db.Wallets(),
  signaturesDb: new Db.Signatures(),
  transactionsDb: new Db.Transactions(),
  messagesDb: new Db.Messages(),
  authCommitmentsDb: new Db.AuthCommitments(),
  recoveryDb: new Db.Recovery(),
  authKeysDb: new Db.AuthKeys(),
  passkeyCredentialsDb: new Db.PasskeyCredentials(),

  dbPruningInterval: 1000 * 60 * 60 * 24, // 24 hours

  stateProvider: new State.Sequence.Provider(),
  networks: Network.ALL,
  relayers: () => [Relayer.Standard.LocalRelayer.createFromWindow(window)].filter((r) => r !== undefined),
  bundlers: [],

  guardUrl: 'https://dev-guard.sequence.app',
  guardAddress: '0xa2e70CeaB3Eb145F32d110383B75B330fA4e288a' as Address.Address, // TODO: change to the actual guard address
  guardPrivateKey: '0x0046e54c861e7d4e1dcd952d86ab6462dedabc55dcf00ac3a99dcce59f516370' as Hex.Hex,

  defaultGuardTopology: {
    // TODO: Move this somewhere else
    type: 'signer',
    address: '0xa2e70CeaB3Eb145F32d110383B75B330fA4e288a', // TODO: change to the actual guard address
    weight: 1n,
  } as Config.SignerLeaf,

  defaultSessionsTopology: {
    // TODO: Move this somewhere else
    type: 'sapient-signer',
    weight: 1n,
  } as Omit<Config.SapientSignerLeaf, 'imageHash' | 'address'>,

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
  readonly passkeyCredentials: Db.PasskeyCredentials

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

  readonly guardUrl: string
  readonly guardAddress: Address.Address
  readonly guardPrivateKey: Hex.Hex
}

export type Modules = {
  readonly logger: Logger
  readonly devices: Devices
  readonly guard: CoreSigners.Guard
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
  private readonly guardHandler: GuardHandler

  private readonly otpHandler?: OtpHandler

  // ======== Begin Public Modules ========

  /**
   * Manages the lifecycle of user wallets within the WDK, from creation (sign-up)
   * to session management (login/logout).
   *
   * This is the primary entry point for users. It handles the association of login
   * credentials (like mnemonics or passkeys) with on-chain wallet configurations.
   *
   * Key behaviors:
   * - `signUp()`: Creates a new wallet configuration and deploys it.
   * - `login()`: Adds the current device as a new authorized signer to an existing wallet. This is a 2-step process requiring a signature from an existing signer.
   * - `logout()`: Can perform a "soft" logout (local session removal) or a "hard" logout (on-chain key removal), which is also a 2-step process.
   *
   * This module orchestrates with the `signatures` module to handle the signing of
   * configuration updates required for login and hard-logout operations.
   *
   * @see {WalletsInterface} for all available methods.
   */
  public readonly wallets: WalletsInterface

  /**
   * Acts as the central coordinator for all signing operations. It does not perform
   * the signing itself but manages the entire process.
   *
   * When an action requires a signature (e.g., sending a transaction, updating configuration),
   * a `SignatureRequest` is created here. This module then determines which signers
   * (devices, passkeys, etc.) are required to meet the wallet's security threshold.
   *
   * Key features:
   * - Tracks the real-time status of each required signer (`ready`, `actionable`, `signed`, `unavailable`).
   * - Calculates the collected signature weight against the required threshold.
   * - Provides hooks (`onSignatureRequestUpdate`) for building reactive UIs that guide the user through the signing process.
   *
   * Developers will primarily interact with this module to monitor the state of a signing
   * request initiated by other modules like `transactions` or `wallets`.
   *
   * @see {SignaturesInterface} for all available methods.
   * @see {SignatureRequest} for the detailed structure of a request object.
   */
  public readonly signatures: SignaturesInterface

  /**
   * Manages the end-to-end lifecycle of on-chain transactions, from creation to final confirmation.
   *
   * This module follows a distinct state machine:
   * 1. `request()`: Creates a new transaction request.
   * 2. `define()`: Fetches quotes and fee options from all available relayers and ERC-4337 bundlers.
   * 3. `selectRelayer()`: Finalizes the transaction payload based on the chosen relayer and creates a `SignatureRequest`.
   * 4. `relay()`: Submits the signed transaction to the chosen relayer/bundler for execution.
   *
   * The final on-chain status (`confirmed` or `failed`) is updated asynchronously by a background
   * process. Use `onTransactionUpdate` to monitor a transaction's progress.
   *
   * @see {TransactionsInterface} for all available methods.
   * @see {Transaction} for the detailed structure of a transaction object and its states.
   */
  public readonly transactions: TransactionsInterface

  /**
   * Handles the signing of off-chain messages, such as EIP-191 personal_sign messages
   * or EIP-712 typed data.
   *
   * The flow is simpler than on-chain transactions:
   * 1. `request()`: Prepares the message and creates a `SignatureRequest`.
   * 2. The user signs the request via the `signatures` module UI.
   * 3. `complete()`: Builds the final, EIP-1271/EIP-6492 compliant signature string.
   *
   * This module is essential for dapps that require off-chain proof of ownership or authorization.
   * The resulting signature is verifiable on-chain by calling `isValidSignature` on the wallet contract.
   *
   * @see {MessagesInterface} for all available methods.
   */
  public readonly messages: MessagesInterface

  /**
   * Manages session keys, which are temporary, often permissioned, signers for a wallet.
   * This allows dapps to perform actions on the user's behalf without prompting for a signature
   * for every transaction.
   *
   * Two types of sessions are supported:
   * - **Implicit Sessions**: Authorized by an off-chain attestation from the user's primary identity
   *   signer. They are dapp-specific and don't require a configuration update to create. Ideal for
   *   low-risk, frequent actions within a single application.
   * - **Explicit Sessions**: Authorized by a wallet configuration update. These sessions
   *   are more powerful and can be governed by detailed, on-chain permissions (e.g., value limits,
   *   contract targets, function call rules).
   *
   * This module handles the creation, removal, and configuration of both session types.
   *
   * @see {SessionsInterface} for all available methods.
   */
  public readonly sessions: SessionsInterface

  /**
   * Manages the wallet's recovery mechanism, allowing designated recovery signers
   * to execute transactions after a time delay.
   *
   * This module is responsible for:
   * - **Configuration**: Adding or removing recovery signers (e.g., a secondary mnemonic). This is a standard configuration update that must be signed by the wallet's primary signers.
   * - **Execution**: A two-step process to use the recovery feature:
   *   1. `queuePayload()`: A recovery signer signs a payload, which is then sent on-chain to start a timelock.
   *   2. After the timelock, the `recovery` handler itself can sign a transaction to execute the queued payload.
   * - **Monitoring**: `updateQueuedPayloads()` fetches on-chain data about pending recovery attempts, a crucial security feature.
   *
   * @see {RecoveryInterface} for all available methods.
   */
  public readonly recovery: RecoveryInterface

  // ======== End Public Modules ========

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

        guardUrl: ops.guardUrl,
        guardAddress: ops.guardAddress,
        guardPrivateKey: ops.guardPrivateKey,
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
        passkeyCredentials: ops.passkeyCredentialsDb,

        pruningInterval: ops.dbPruningInterval,
      },

      modules: {} as any,
      handlers: new Map(),
    }

    const modules: Modules = {
      cron: new Cron(shared),
      logger: new Logger(shared),
      devices: new Devices(shared),
      guard: new CoreSigners.Guard(
        shared.sequence.guardUrl
          ? new Guard.Sequence.Guard(shared.sequence.guardUrl, shared.sequence.guardAddress)
          : new Guard.Local.Guard(shared.sequence.guardPrivateKey || Secp256k1.randomPrivateKey()),
      ),
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
    this.recovery = modules.recovery

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

    this.guardHandler = new GuardHandler(modules.signatures, modules.guard)
    shared.handlers.set(Kinds.Guard, this.guardHandler)

    const verifyingFetch = ops.identity.verifyAttestation
      ? createAttestationVerifyingFetch({
          fetch: ops.identity.fetch,
          expectedPCRs: ops.identity.expectedPcr0 ? new Map([[0, ops.identity.expectedPcr0]]) : undefined,
          logTiming: true,
        })
      : ops.identity.fetch
    const identityInstrument = new IdentityInstrument(ops.identity.url, ops.identity.scope, verifyingFetch)

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

  public getNetworks(): Network.Network[] {
    return this.shared.sequence.networks
  }

  public getNetwork(chainId: number): Network.Network | undefined {
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
