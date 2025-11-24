import { Bundler, Signers as CoreSigners, State } from '@0xsequence/wallet-core';
import { Relayer } from '@0xsequence/relayer';
import { Config, Context, Extensions, Network } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import * as Db from '../dbs/index.js';
import { Cron } from './cron.js';
import { Devices } from './devices.js';
import { Guards, GuardRole } from './guards.js';
import { Handler } from './handlers/index.js';
import { Logger } from './logger.js';
import { Messages, MessagesInterface } from './messages.js';
import { Recovery, RecoveryInterface } from './recovery.js';
import { Sessions, SessionsInterface } from './sessions.js';
import { Signatures, SignaturesInterface } from './signatures.js';
import { Signers } from './signers.js';
import { Transactions, TransactionsInterface } from './transactions.js';
import { Wallets, WalletsInterface } from './wallets.js';
import { PromptCodeHandler } from './handlers/guard.js';
import { PasskeyCredential } from '../dbs/index.js';
import { PromptMnemonicHandler } from './handlers/mnemonic.js';
import { PromptOtpHandler } from './handlers/otp.js';
export type ManagerOptions = {
    verbose?: boolean;
    extensions?: Extensions.Extensions;
    context?: Context.Context;
    guest?: Address.Address;
    encryptedPksDb?: CoreSigners.Pk.Encrypted.EncryptedPksDb;
    managerDb?: Db.Wallets;
    transactionsDb?: Db.Transactions;
    signaturesDb?: Db.Signatures;
    messagesDb?: Db.Messages;
    authCommitmentsDb?: Db.AuthCommitments;
    authKeysDb?: Db.AuthKeys;
    recoveryDb?: Db.Recovery;
    passkeyCredentialsDb?: Db.PasskeyCredentials;
    dbPruningInterval?: number;
    stateProvider?: State.Provider;
    networks?: Network.Network[];
    relayers?: Relayer.Relayer[] | (() => Relayer.Relayer[]);
    bundlers?: Bundler.Bundler[];
    guardUrl?: string;
    guardAddresses?: Record<GuardRole, Address.Address>;
    defaultGuardTopology?: Config.Topology;
    defaultRecoverySettings?: RecoverySettings;
    multiInjectedProviderDiscovery?: boolean;
    identity?: {
        url?: string;
        fetch?: typeof window.fetch;
        verifyAttestation?: boolean;
        expectedPcr0?: string[];
        scope?: string;
        email?: {
            enabled: boolean;
        };
        google?: {
            enabled: boolean;
            clientId: string;
        };
        apple?: {
            enabled: boolean;
            clientId: string;
        };
    };
};
export declare const ManagerOptionsDefaults: {
    verbose: boolean;
    extensions: Extensions.Extensions;
    context: Context.Context;
    context4337: Context.Context;
    guest: "0x0000000000601fcA38f0cCA649453F6739436d6C";
    encryptedPksDb: CoreSigners.Pk.Encrypted.EncryptedPksDb;
    managerDb: Db.Wallets;
    signaturesDb: Db.Signatures;
    transactionsDb: Db.Transactions;
    messagesDb: Db.Messages;
    authCommitmentsDb: Db.AuthCommitments;
    recoveryDb: Db.Recovery;
    authKeysDb: Db.AuthKeys;
    passkeyCredentialsDb: Db.PasskeyCredentials;
    dbPruningInterval: number;
    stateProvider: State.Sequence.Provider;
    networks: Network.Network[];
    relayers: () => Relayer.LocalRelayer[];
    bundlers: never[];
    guardUrl: string;
    guardAddresses: Record<GuardRole, Address.Address>;
    defaultGuardTopology: Config.NestedLeaf;
    defaultSessionsTopology: Omit<Config.SapientSignerLeaf, "imageHash" | "address">;
    defaultRecoverySettings: {
        requiredDeltaTime: bigint;
        minTimestamp: bigint;
    };
    multiInjectedProviderDiscovery: boolean;
    identity: {
        url: string;
        fetch: (((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & typeof fetch) | undefined;
        verifyAttestation: boolean;
        email: {
            enabled: boolean;
        };
        google: {
            enabled: boolean;
            clientId: string;
        };
        apple: {
            enabled: boolean;
            clientId: string;
        };
    };
};
export declare const CreateWalletOptionsDefaults: {
    useGuard: boolean;
};
export declare function applyManagerOptionsDefaults(options?: ManagerOptions): {
    identity: {
        url: string;
        fetch: typeof window.fetch;
        verifyAttestation: boolean;
        expectedPcr0?: string[];
        scope?: string;
        email: {
            enabled: boolean;
        };
        google: {
            enabled: boolean;
            clientId: string;
        };
        apple: {
            enabled: boolean;
            clientId: string;
        };
    };
    verbose: boolean;
    extensions: Extensions.Extensions;
    context: Context.Context;
    guest: Address.Address;
    encryptedPksDb: CoreSigners.Pk.Encrypted.EncryptedPksDb;
    managerDb: Db.Wallets;
    transactionsDb: Db.Transactions;
    signaturesDb: Db.Signatures;
    messagesDb: Db.Messages;
    authCommitmentsDb: Db.AuthCommitments;
    authKeysDb: Db.AuthKeys;
    recoveryDb: Db.Recovery;
    passkeyCredentialsDb: Db.PasskeyCredentials;
    dbPruningInterval: number;
    stateProvider: State.Provider;
    networks: Network.Network[];
    relayers: (() => Relayer.LocalRelayer[]) | Relayer.Relayer[] | (() => Relayer.Relayer[]);
    bundlers: Bundler.Bundler[];
    guardUrl: string;
    guardAddresses: Record<GuardRole, Address.Address>;
    defaultGuardTopology: Config.Topology;
    defaultRecoverySettings: RecoverySettings;
    multiInjectedProviderDiscovery: boolean;
    context4337: Context.Context;
    defaultSessionsTopology: Omit<Config.SapientSignerLeaf, "imageHash" | "address">;
};
export type RecoverySettings = {
    requiredDeltaTime: bigint;
    minTimestamp: bigint;
};
export type Databases = {
    readonly encryptedPks: CoreSigners.Pk.Encrypted.EncryptedPksDb;
    readonly manager: Db.Wallets;
    readonly signatures: Db.Signatures;
    readonly messages: Db.Messages;
    readonly transactions: Db.Transactions;
    readonly authCommitments: Db.AuthCommitments;
    readonly authKeys: Db.AuthKeys;
    readonly recovery: Db.Recovery;
    readonly passkeyCredentials: Db.PasskeyCredentials;
    readonly pruningInterval: number;
};
export type Sequence = {
    readonly context: Context.Context;
    readonly context4337: Context.Context;
    readonly extensions: Extensions.Extensions;
    readonly guest: Address.Address;
    readonly stateProvider: State.Provider;
    readonly networks: Network.Network[];
    readonly relayers: Relayer.Relayer[];
    readonly bundlers: Bundler.Bundler[];
    readonly defaultGuardTopology: Config.Topology;
    readonly defaultRecoverySettings: RecoverySettings;
    readonly guardUrl: string;
    readonly guardAddresses: Record<GuardRole, Address.Address>;
};
export type Modules = {
    readonly logger: Logger;
    readonly devices: Devices;
    readonly guards: Guards;
    readonly wallets: Wallets;
    readonly sessions: Sessions;
    readonly signers: Signers;
    readonly signatures: Signatures;
    readonly transactions: Transactions;
    readonly messages: Messages;
    readonly recovery: Recovery;
    readonly cron: Cron;
};
export type Shared = {
    readonly verbose: boolean;
    readonly sequence: Sequence;
    readonly databases: Databases;
    readonly handlers: Map<string, Handler>;
    modules: Modules;
};
export declare class Manager {
    private readonly shared;
    private readonly mnemonicHandler;
    private readonly devicesHandler;
    private readonly passkeysHandler;
    private readonly recoveryHandler;
    private readonly guardHandler;
    private readonly otpHandler?;
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
    readonly wallets: WalletsInterface;
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
    readonly signatures: SignaturesInterface;
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
    readonly transactions: TransactionsInterface;
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
    readonly messages: MessagesInterface;
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
    readonly sessions: SessionsInterface;
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
    readonly recovery: RecoveryInterface;
    constructor(options?: ManagerOptions);
    registerMnemonicUI(onPromptMnemonic: PromptMnemonicHandler): () => void;
    registerOtpUI(onPromptOtp: PromptOtpHandler): () => void;
    registerGuardUI(onPromptCode: PromptCodeHandler): () => void;
    setRedirectPrefix(prefix: string): Promise<void>;
    getNetworks(): Network.Network[];
    getNetwork(chainId: number): Network.Network | undefined;
    getPasskeyCredentials(): Promise<PasskeyCredential[]>;
    stop(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map