import { Signers as CoreSigners, Relayer, State } from '@0xsequence/wallet-core';
import { Attestation, Config, Context, Extensions, Network, Payload, Signature as SequenceSignature, SessionConfig } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import * as Db from '../dbs/index.js';
import { Cron } from './cron.js';
import { Devices } from './devices.js';
import { Handler } from './handlers/index.js';
import { Logger } from './logger.js';
import { Messages } from './messages.js';
import { Recovery } from './recovery.js';
import { AuthorizeImplicitSessionArgs, Sessions } from './sessions.js';
import { Signatures } from './signatures.js';
import { Signers } from './signers.js';
import { Transactions } from './transactions.js';
import { BaseSignatureRequest, QueuedRecoveryPayload, SignatureRequest, Wallet } from './types/index.js';
import { Message, MessageRequest } from './types/message-request.js';
import { RecoverySigner } from './types/signer.js';
import { Transaction, TransactionRequest } from './types/transaction-request.js';
import { WalletSelectionUiHandler } from './types/wallet.js';
import { CompleteRedirectArgs, LoginArgs, SignupArgs, StartSignUpWithRedirectArgs, Wallets } from './wallets.js';
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
    dbPruningInterval?: number;
    stateProvider?: State.Provider;
    networks?: Network.Network[];
    relayers?: Relayer.Relayer[] | (() => Relayer.Relayer[]);
    defaultGuardTopology?: Config.Topology;
    defaultRecoverySettings?: RecoverySettings;
    identity?: {
        url?: string;
        fetch?: typeof window.fetch;
        verifyAttestation?: boolean;
        expectedPcr0?: string[];
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
    guest: `0x${string}`;
    encryptedPksDb: CoreSigners.Pk.Encrypted.EncryptedPksDb;
    managerDb: Db.Wallets;
    signaturesDb: Db.Signatures;
    transactionsDb: Db.Transactions;
    messagesDb: Db.Messages;
    authCommitmentsDb: Db.AuthCommitments;
    recoveryDb: Db.Recovery;
    authKeysDb: Db.AuthKeys;
    dbPruningInterval: number;
    stateProvider: State.Local.Provider;
    networks: Network.Network[];
    relayers: () => Relayer.Local.LocalRelayer[];
    defaultGuardTopology: Config.SignerLeaf;
    defaultSessionsTopology: Omit<Config.SapientSignerLeaf, "imageHash">;
    defaultRecoverySettings: {
        requiredDeltaTime: bigint;
        minTimestamp: bigint;
    };
    identity: {
        url: string;
        fetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & typeof fetch;
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
    dbPruningInterval: number;
    stateProvider: State.Provider;
    networks: Network.Network[];
    relayers: (() => Relayer.Local.LocalRelayer[]) | Relayer.Relayer[] | (() => Relayer.Relayer[]);
    defaultGuardTopology: Config.Topology;
    defaultRecoverySettings: RecoverySettings;
    defaultSessionsTopology: Omit<Config.SapientSignerLeaf, "imageHash">;
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
    readonly pruningInterval: number;
};
export type Sequence = {
    readonly context: Context.Context;
    readonly extensions: Extensions.Extensions;
    readonly guest: Address.Address;
    readonly stateProvider: State.Provider;
    readonly networks: Network.Network[];
    readonly relayers: Relayer.Relayer[];
    readonly defaultGuardTopology: Config.Topology;
    readonly defaultRecoverySettings: RecoverySettings;
};
export type Modules = {
    readonly logger: Logger;
    readonly devices: Devices;
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
    private readonly otpHandler?;
    constructor(options?: ManagerOptions);
    startSignUpWithRedirect(args: StartSignUpWithRedirectArgs): Promise<string>;
    completeRedirect(args: CompleteRedirectArgs): Promise<string>;
    signUp(options: SignupArgs): Promise<`0x${string}` | undefined>;
    logout(wallet: Address.Address, options?: {
        skipRemoveDevice?: boolean;
    }): Promise<string>;
    completeLogout(requestId: string, options?: {
        skipValidateSave?: boolean;
    }): Promise<void>;
    login(args: LoginArgs): Promise<string | undefined>;
    completeLogin(requestId: string): Promise<void>;
    listWallets(): Promise<Wallet[]>;
    hasWallet(address: Address.Address): Promise<boolean>;
    onWalletsUpdate(cb: (wallets: Wallet[]) => void, trigger?: boolean): () => void;
    registerWalletSelector(handler: WalletSelectionUiHandler): () => void;
    unregisterWalletSelector(handler?: WalletSelectionUiHandler): void;
    getConfiguration(wallet: Address.Address): Promise<{
        devices: import("./types/signer.js").SignerWithKind[];
        login: import("./types/signer.js").SignerWithKind[];
        raw: {
            loginTopology: Config.Topology;
            devicesTopology: Config.Topology;
            modules: Config.SapientSignerLeaf[];
            guardTopology?: Config.Topology;
        };
    }>;
    getOnchainConfiguration(wallet: Address.Address, chainId: bigint): Promise<{
        devices: import("./types/signer.js").SignerWithKind[];
        login: import("./types/signer.js").SignerWithKind[];
        raw: {
            loginTopology: Config.Topology;
            devicesTopology: Config.Topology;
            modules: Config.SapientSignerLeaf[];
            guardTopology?: Config.Topology;
        };
    }>;
    isUpdatedOnchain(wallet: Address.Address, chainId: bigint): Promise<boolean>;
    listSignatureRequests(): Promise<SignatureRequest[]>;
    getSignatureRequest(requestId: string): Promise<SignatureRequest>;
    onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean): () => void;
    onSignatureRequestUpdate(requestId: string, cb: (requests: SignatureRequest) => void, onError?: (error: Error) => void, trigger?: boolean): () => void;
    cancelSignatureRequest(requestId: string): Promise<void>;
    requestTransaction(from: Address.Address, chainId: bigint, txs: TransactionRequest[], options?: {
        skipDefineGas?: boolean;
        source?: string;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
    }): Promise<string>;
    defineTransaction(transactionId: string, changes?: {
        nonce?: bigint;
        space?: bigint;
        calls?: Pick<Payload.Call, 'gasLimit'>[];
    }): Promise<void>;
    selectTransactionRelayer(transactionId: string, relayerOptionId: string): Promise<string>;
    relayTransaction(transactionOrSignatureId: string): Promise<`0x${string}`>;
    deleteTransaction(transactionId: string): Promise<void>;
    onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean): () => void;
    onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean): () => void;
    getTransaction(transactionId: string): Promise<Transaction>;
    registerMnemonicUI(onPromptMnemonic: (respond: (mnemonic: string) => Promise<void>) => Promise<void>): () => void;
    registerOtpUI(onPromptOtp: (recipient: string, respond: (otp: string) => Promise<void>) => Promise<void>): () => void;
    setRedirectPrefix(prefix: string): Promise<void>;
    listMessageRequests(): Promise<Message[]>;
    getMessageRequest(messageOrSignatureId: string): Promise<Message>;
    onMessageRequestsUpdate(cb: (messages: Message[]) => void, trigger?: boolean): () => void;
    onMessageRequestUpdate(messageOrSignatureId: string, cb: (message: Message) => void, trigger?: boolean): () => void;
    requestMessageSignature(wallet: Address.Address, message: MessageRequest, chainId?: bigint, options?: {
        source?: string;
    }): Promise<string>;
    completedMessageSignature(messageOrSignatureId: string): Promise<string>;
    deleteMessageRequest(messageOrSignatureId: string): Promise<void>;
    getSessionTopology(walletAddress: Address.Address): Promise<SessionConfig.SessionsTopology>;
    prepareAuthorizeImplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, args: AuthorizeImplicitSessionArgs): Promise<string>;
    completeAuthorizeImplicitSession(requestId: string): Promise<{
        attestation: Attestation.Attestation;
        signature: SequenceSignature.RSY;
    }>;
    addExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address, permissions: CoreSigners.Session.ExplicitParams): Promise<string>;
    removeExplicitSession(walletAddress: Address.Address, sessionAddress: Address.Address): Promise<string>;
    addBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string>;
    removeBlacklistAddress(walletAddress: Address.Address, address: Address.Address): Promise<string>;
    completeSessionUpdate(requestId: string): Promise<void>;
    getRecoverySigners(wallet: Address.Address): Promise<RecoverySigner[] | undefined>;
    onQueuedRecoveryPayloadsUpdate(wallet: Address.Address, cb: (payloads: QueuedRecoveryPayload[]) => void, trigger?: boolean): () => void;
    queueRecoveryPayload(wallet: Address.Address, chainId: bigint, payload: Payload.Calls): Promise<string>;
    completeRecoveryPayload(requestId: string): Promise<{
        to: Address.Address;
        data: import("ox/Hex").Hex;
    }>;
    addRecoveryMnemonic(wallet: Address.Address, mnemonic: string): Promise<string>;
    addRecoverySigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    removeRecoverySigner(wallet: Address.Address, address: Address.Address): Promise<string>;
    completeRecoveryUpdate(requestId: string): Promise<void>;
    updateQueuedRecoveryPayloads(): Promise<void>;
    getNetworks(): Network.Network[];
    getNetwork(chainId: bigint): Network.Network | undefined;
    stop(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map