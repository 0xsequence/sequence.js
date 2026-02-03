import { Bundler, Signers as CoreSigners, State } from '@0xsequence/wallet-core'
import { Relayer } from '@0xsequence/relayer'
import { IdentityInstrument } from '@0xsequence/identity-instrument'
import { createAttestationVerifyingFetch } from '@0xsequence/tee-verifier'
import { Config, Constants, Context, Extensions, Network } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'
import * as Db from '../dbs/index.js'
import { resolveWdkEnv, type WdkEnv } from '../env.js'
import { Cron } from './cron.js'
import { Devices } from './devices.js'
import { Guards, GuardRole } from './guards.js'
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
import { GuardHandler, PromptCodeHandler } from './handlers/guard.js'
import { PasskeyCredential } from '../dbs/index.js'
import { PromptMnemonicHandler } from './handlers/mnemonic.js'
import { PromptOtpHandler } from './handlers/otp.js'
import { defaultPasskeyProvider, type PasskeyProvider } from './passkeys-provider.js'

export type ManagerOptions = {
  verbose?: boolean

  extensions?: Extensions.Extensions
  context?: Context.Context
  context4337?: Context.Context
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

  env?: WdkEnv
  passkeyProvider?: PasskeyProvider

  stateProvider?: State.Provider
  networks?: Network.Network[]
  relayers?: Relayer.Relayer[] | (() => Relayer.Relayer[])
  bundlers?: Bundler.Bundler[]
  guardUrl?: string
  guardAddresses?: Record<GuardRole, Address.Address>

  nonWitnessableSigners?: Address.Address[]

  // The default guard topology MUST have a placeholder address for the guard address
  defaultGuardTopology?: Config.Topology
  defaultRecoverySettings?: RecoverySettings

  // EIP-6963 support
  multiInjectedProviderDiscovery?: boolean

  identity?: {
    url?: string
    fetch?: typeof fetch
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
    customProviders?: {
      kind: `custom-${string}`
      authMethod: 'id-token' | 'authcode' | 'authcode-pkce'
      issuer: string
      oauthUrl: string
      clientId: string
    }[]
  }
}

export type ResolvedIdentityOptions = {
  url: string
  fetch?: typeof fetch
  verifyAttestation: boolean
  expectedPcr0?: string[]
  scope?: string
  email: {
    enabled: boolean
  }
  google: {
    enabled: boolean
    clientId: string
  }
  apple: {
    enabled: boolean
    clientId: string
  }
  customProviders?: {
    kind: `custom-${string}`
    authMethod: 'id-token' | 'authcode' | 'authcode-pkce'
    issuer: string
    oauthUrl: string
    clientId: string
  }[]
}

export type ResolvedManagerOptions = {
  verbose: boolean

  extensions: Extensions.Extensions
  context: Context.Context
  context4337: Context.Context
  guest: Address.Address

  encryptedPksDb: CoreSigners.Pk.Encrypted.EncryptedPksDb
  managerDb: Db.Wallets
  transactionsDb: Db.Transactions
  signaturesDb: Db.Signatures
  messagesDb: Db.Messages
  authCommitmentsDb: Db.AuthCommitments
  authKeysDb: Db.AuthKeys
  recoveryDb: Db.Recovery
  passkeyCredentialsDb: Db.PasskeyCredentials

  dbPruningInterval: number

  env: WdkEnv
  passkeyProvider: PasskeyProvider

  stateProvider: State.Provider
  networks: Network.Network[]
  relayers: Relayer.Relayer[] | (() => Relayer.Relayer[])
  bundlers: Bundler.Bundler[]
  guardUrl: string
  guardAddresses: Record<GuardRole, Address.Address>

  nonWitnessableSigners: Address.Address[]

  defaultGuardTopology: Config.Topology
  defaultRecoverySettings: RecoverySettings

  multiInjectedProviderDiscovery: boolean

  identity: ResolvedIdentityOptions
}

export const ManagerOptionsDefaults = {
  verbose: false,

  extensions: Extensions.Rc5,
  context: Context.Rc5,
  context4337: Context.Rc5_4337,
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

  passkeyProvider: defaultPasskeyProvider,

  stateProvider: typeof fetch !== 'undefined' ? new State.Sequence.Provider(undefined, fetch) : undefined,
  networks: Network.ALL,
  relayers: () => {
    if (typeof window !== 'undefined') {
      return [Relayer.LocalRelayer.createFromWindow(window)].filter((r) => r !== undefined)
    }
    return []
  },
  bundlers: [],

  nonWitnessableSigners: [] as Address.Address[],

  guardUrl: 'https://guard.sequence.app',
  guardAddresses: {
    wallet: '0x26f3D30F41FA897309Ae804A2AFf15CEb1dA5742',
    sessions: '0xF6Bc87F5F2edAdb66737E32D37b46423901dfEF1',
  } as Record<GuardRole, Address.Address>,

  defaultGuardTopology: {
    type: 'nested',
    weight: 1n,
    threshold: 1n,
    tree: [
      {
        type: 'signer',
        address: Constants.PlaceholderAddress,
        weight: 1n,
      },
      {
        type: 'signer',
        // Sequence dev multisig, as recovery guard signer
        address: '0x007a47e6BF40C1e0ed5c01aE42fDC75879140bc4',
        weight: 1n,
      },
    ],
  } as Config.NestedLeaf,

  defaultSessionsTopology: {
    type: 'sapient-signer',
    weight: 1n,
  } as Omit<Config.SapientSignerLeaf, 'imageHash' | 'address'>,

  defaultRecoverySettings: {
    requiredDeltaTime: 2592000n, // 30 days (in seconds)
    minTimestamp: 0n,
  },

  multiInjectedProviderDiscovery: true,

  identity: {
    url: 'https://identity.sequence.app',
    fetch: typeof window !== 'undefined' ? window.fetch : undefined,
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

export function applyManagerOptionsDefaults(options?: ManagerOptions): ResolvedManagerOptions {
  const env = resolveWdkEnv(options?.env)

  const identity: ResolvedIdentityOptions = {
    ...ManagerOptionsDefaults.identity,
    ...options?.identity,
    email: { ...ManagerOptionsDefaults.identity.email, ...options?.identity?.email },
    google: { ...ManagerOptionsDefaults.identity.google, ...options?.identity?.google },
    apple: { ...ManagerOptionsDefaults.identity.apple, ...options?.identity?.apple },
  }

  if (!identity.fetch && env.fetch) {
    identity.fetch = env.fetch
  }

  let encryptedPksDb = options?.encryptedPksDb ?? ManagerOptionsDefaults.encryptedPksDb
  if (!options?.encryptedPksDb && options?.env) {
    encryptedPksDb = new CoreSigners.Pk.Encrypted.EncryptedPksDb(undefined, undefined, env)
  }

  let authKeysDb = options?.authKeysDb ?? ManagerOptionsDefaults.authKeysDb
  if (!options?.authKeysDb && options?.env) {
    authKeysDb = new Db.AuthKeys(undefined, env)
  }

  let stateProvider = options?.stateProvider ?? ManagerOptionsDefaults.stateProvider
  if (!options?.stateProvider && options?.env?.fetch) {
    stateProvider = new State.Sequence.Provider(undefined, options.env.fetch)
  } else if (!stateProvider && env.fetch) {
    stateProvider = new State.Sequence.Provider(undefined, env.fetch)
  }

  if (!stateProvider) {
    throw new Error('stateProvider is required. Provide ManagerOptions.stateProvider or env.fetch')
  }

  const extensions = options?.extensions ?? ManagerOptionsDefaults.extensions
  const defaultGuardTopology = options?.defaultGuardTopology ?? ManagerOptionsDefaults.defaultGuardTopology

  // Merge and normalize non-witnessable signers.
  // We always include the sessions extension address for the active extensions set.
  const nonWitnessable = new Set<string>()
  for (const address of ManagerOptionsDefaults.nonWitnessableSigners ?? []) {
    nonWitnessable.add(address.toLowerCase())
  }
  for (const address of options?.nonWitnessableSigners ?? []) {
    nonWitnessable.add(address.toLowerCase())
  }
  nonWitnessable.add(extensions.sessions.toLowerCase())

  // Include static signer leaves from the guard topology (e.g. recovery guard signer),
  // but ignore the placeholder address that is later replaced per-role.
  if (defaultGuardTopology) {
    const guardTopologySigners = Config.getSigners(defaultGuardTopology)
    for (const signer of guardTopologySigners.signers) {
      if (Address.isEqual(signer, Constants.PlaceholderAddress)) {
        continue
      }
      nonWitnessable.add(signer.toLowerCase())
    }
    for (const signer of guardTopologySigners.sapientSigners) {
      nonWitnessable.add(signer.address.toLowerCase())
    }
  }

  return {
    verbose: options?.verbose ?? ManagerOptionsDefaults.verbose,

    extensions,
    context: options?.context ?? ManagerOptionsDefaults.context,
    context4337: options?.context4337 ?? ManagerOptionsDefaults.context4337,
    guest: options?.guest ?? ManagerOptionsDefaults.guest,

    encryptedPksDb,
    managerDb: options?.managerDb ?? ManagerOptionsDefaults.managerDb,
    transactionsDb: options?.transactionsDb ?? ManagerOptionsDefaults.transactionsDb,
    signaturesDb: options?.signaturesDb ?? ManagerOptionsDefaults.signaturesDb,
    messagesDb: options?.messagesDb ?? ManagerOptionsDefaults.messagesDb,
    authCommitmentsDb: options?.authCommitmentsDb ?? ManagerOptionsDefaults.authCommitmentsDb,
    recoveryDb: options?.recoveryDb ?? ManagerOptionsDefaults.recoveryDb,
    authKeysDb,
    passkeyCredentialsDb: options?.passkeyCredentialsDb ?? ManagerOptionsDefaults.passkeyCredentialsDb,

    dbPruningInterval: options?.dbPruningInterval ?? ManagerOptionsDefaults.dbPruningInterval,

    env,
    passkeyProvider: options?.passkeyProvider ?? ManagerOptionsDefaults.passkeyProvider,

    stateProvider,
    networks: options?.networks ?? ManagerOptionsDefaults.networks,
    relayers: options?.relayers ?? ManagerOptionsDefaults.relayers,
    bundlers: options?.bundlers ?? ManagerOptionsDefaults.bundlers,
    guardUrl: options?.guardUrl ?? ManagerOptionsDefaults.guardUrl,
    guardAddresses: options?.guardAddresses ?? ManagerOptionsDefaults.guardAddresses,

    nonWitnessableSigners: Array.from(nonWitnessable) as Address.Address[],

    defaultGuardTopology,
    defaultRecoverySettings: options?.defaultRecoverySettings ?? ManagerOptionsDefaults.defaultRecoverySettings,

    multiInjectedProviderDiscovery:
      options?.multiInjectedProviderDiscovery ?? ManagerOptionsDefaults.multiInjectedProviderDiscovery,

    identity,
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
  readonly bundlers: Bundler.Bundler[]

  readonly nonWitnessableSigners: ReadonlySet<Address.Address>

  readonly defaultGuardTopology: Config.Topology
  readonly defaultRecoverySettings: RecoverySettings

  readonly guardUrl: string
  readonly guardAddresses: Record<GuardRole, Address.Address>
}

export type Modules = {
  readonly logger: Logger
  readonly devices: Devices
  readonly guards: Guards
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
  readonly env: WdkEnv
  readonly passkeyProvider: PasskeyProvider

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
        relayers.push(...Relayer.EIP6963.getRelayers())
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

        nonWitnessableSigners: new Set(
          (ops.nonWitnessableSigners ?? []).map((address) => address.toLowerCase() as Address.Address),
        ),

        defaultGuardTopology: ops.defaultGuardTopology,
        defaultRecoverySettings: ops.defaultRecoverySettings,

        guardUrl: ops.guardUrl,
        guardAddresses: ops.guardAddresses,
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

      env: ops.env,
      passkeyProvider: ops.passkeyProvider,

      modules: {} as any,
      handlers: new Map(),
    }

    const modules: Modules = {
      cron: new Cron(shared),
      logger: new Logger(shared),
      devices: new Devices(shared),
      guards: new Guards(shared),
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
      shared.passkeyProvider,
    )
    shared.handlers.set(Kinds.LoginPasskey, this.passkeysHandler)

    this.mnemonicHandler = new MnemonicHandler(modules.signatures)
    shared.handlers.set(Kinds.LoginMnemonic, this.mnemonicHandler)

    this.recoveryHandler = new RecoveryHandler(modules.signatures, modules.recovery)
    shared.handlers.set(Kinds.Recovery, this.recoveryHandler)

    this.guardHandler = new GuardHandler(modules.signatures, modules.guards)
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
      this.otpHandler = new OtpHandler(identityInstrument, modules.signatures, shared.databases.authKeys, shared.env)
      shared.handlers.set(Kinds.LoginEmailOtp, this.otpHandler)
    }
    if (ops.identity.google?.enabled) {
      shared.handlers.set(
        Kinds.LoginGooglePkce,
        new AuthCodePkceHandler(
          'google-pkce',
          'https://accounts.google.com',
          'https://accounts.google.com/o/oauth2/v2/auth',
          ops.identity.google.clientId,
          identityInstrument,
          modules.signatures,
          shared.databases.authCommitments,
          shared.databases.authKeys,
          shared.env,
        ),
      )
    }
    if (ops.identity.apple?.enabled) {
      shared.handlers.set(
        Kinds.LoginApple,
        new AuthCodeHandler(
          'apple',
          'https://appleid.apple.com',
          'https://appleid.apple.com/auth/authorize',
          ops.identity.apple.clientId,
          identityInstrument,
          modules.signatures,
          shared.databases.authCommitments,
          shared.databases.authKeys,
          shared.env,
        ),
      )
    }
    if (ops.identity.customProviders?.length) {
      for (const provider of ops.identity.customProviders) {
        switch (provider.authMethod) {
          case 'id-token':
            throw new Error('id-token is not supported yet')
          case 'authcode':
            shared.handlers.set(
              provider.kind,
              new AuthCodeHandler(
                provider.kind,
                provider.issuer,
                provider.oauthUrl,
                provider.clientId,
                identityInstrument,
                modules.signatures,
                shared.databases.authCommitments,
                shared.databases.authKeys,
                shared.env,
              ),
            )
            break
          case 'authcode-pkce':
            shared.handlers.set(
              provider.kind,
              new AuthCodePkceHandler(
                provider.kind,
                provider.issuer,
                provider.oauthUrl,
                provider.clientId,
                identityInstrument,
                modules.signatures,
                shared.databases.authCommitments,
                shared.databases.authKeys,
                shared.env,
              ),
            )
            break
          default:
            throw new Error('unsupported auth method')
        }
      }
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

  public registerMnemonicUI(onPromptMnemonic: PromptMnemonicHandler) {
    return this.mnemonicHandler.registerUI(onPromptMnemonic)
  }

  public registerOtpUI(onPromptOtp: PromptOtpHandler) {
    return this.otpHandler?.registerUI(onPromptOtp) || (() => {})
  }

  public registerGuardUI(onPromptCode: PromptCodeHandler) {
    return this.guardHandler?.registerUI(onPromptCode) || (() => {})
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

  public async getPasskeyCredentials(): Promise<PasskeyCredential[]> {
    return this.shared.databases.passkeyCredentials.list()
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
