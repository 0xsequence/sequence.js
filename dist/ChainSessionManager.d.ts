import { Relayer, Signers } from '@0xsequence/wallet-core';
import { Address } from 'ox';
import { DappTransport } from './DappTransport.js';
import { ChainId } from '@0xsequence/network';
import { SequenceStorage } from './utils/storage.js';
import { ExplicitSessionEventListener, PreferredLoginMethod, RandomPrivateKeyFn, Session, SignatureEventListener, Transaction } from './types/index.js';
import { TypedData } from 'ox/TypedData';
interface ChainSessionManagerEventMap {
    signatureResponse: SignatureEventListener;
    explicitSessionResponse: ExplicitSessionEventListener;
}
/**
 * Manages sessions and wallet interactions for a single blockchain.
 * This class is used internally by the DappClient to handle chain-specific logic.
 */
export declare class ChainSessionManager {
    private readonly instanceId;
    private stateProvider;
    private readonly redirectUrl?;
    private readonly randomPrivateKeyFn;
    private eventListeners;
    private sessions;
    private walletAddress;
    private sessionManager;
    private wallet;
    private provider;
    private relayer;
    private readonly chainId;
    transport: DappTransport | null;
    private sequenceStorage;
    isInitialized: boolean;
    private isInitializing;
    loginMethod: PreferredLoginMethod | null;
    userEmail: string | null;
    /**
     * @param chainId The ID of the chain this manager is responsible for.
     * @param keyMachineUrl The URL of the key management service.
     * @param transport The transport mechanism for communicating with the wallet.
     * @param sequenceStorage The storage implementation for persistent session data.
     * @param redirectUrl (Optional) The URL to redirect back to after a redirect-based flow.
     * @param randomPrivateKeyFn (Optional) A function to generate random private keys.
     * @param canUseIndexedDb (Optional) A flag to enable or disable IndexedDB for caching.
     */
    constructor(chainId: ChainId, keyMachineUrl: string, transport: DappTransport, sequenceStorage: SequenceStorage, redirectUrl?: string, randomPrivateKeyFn?: RandomPrivateKeyFn, canUseIndexedDb?: boolean);
    /**
     * Registers an event listener for a specific event within this chain manager.
     * @param event The event to listen for ChainSessionManagerEvent events.
     * @param listener The function to call when the event occurs.
     * @returns A function to unsubscribe the listener.
     */
    on<K extends keyof ChainSessionManagerEventMap>(event: K, listener: ChainSessionManagerEventMap[K]): () => void;
    /**
     * @private Emits an event to all registered listeners for this chain manager.
     * @param event The event to emit.
     * @param data The data to pass to the listener.
     */
    private emit;
    /**
     * Initializes the manager by loading sessions from storage for this specific chain.
     * @returns A promise resolving to the login method and email if an implicit session is found, or void.
     * @throws {InitializationError} If initialization fails.
     */
    initialize(): Promise<{
        loginMethod: string | null;
        userEmail: string | null;
    } | void>;
    /**
     * Initializes the manager with a known wallet address, without loading sessions from storage.
     * This is used when a wallet address is known but the session manager for this chain hasn't been instantiated yet.
     * @param walletAddress The address of the wallet to initialize with.
     */
    initializeWithWallet(walletAddress: Address.Address): void;
    /**
     * @private Loads implicit and explicit sessions from storage for the current wallet address.
     * @param implicitSession The main implicit session data, which contains the wallet address.
     */
    private _loadSessionFromStorage;
    /**
     * Initiates the creation of a new session by sending a request to the wallet.
     * @param implicitSessionRedirectUrl The URL to redirect to after an implicit session is created.
     * @param permissions (Optional) Permissions for an initial explicit session.
     * @param options (Optional) Additional options like preferred login method.
     * @throws {InitializationError} If a session already exists or the transport fails to initialize.
     */
    createNewSession(implicitSessionRedirectUrl: string, permissions?: Signers.Session.ExplicitParams, options?: {
        preferredLoginMethod?: PreferredLoginMethod;
        email?: string;
    }): Promise<void>;
    /**
     * Initiates the addition of a new explicit session by sending a request to the wallet.
     * @param permissions The permissions for the new explicit session.
     * @throws {InitializationError} If the manager is not initialized.
     * @throws {AddExplicitSessionError} If adding the session fails.
     */
    addExplicitSession(permissions: Signers.Session.ExplicitParams): Promise<void>;
    /**
     * Initiates the modification of an existing explicit session by sending a request to the wallet.
     * @param sessionAddress The address of the explicit session to modify.
     * @param newPermissions The new permissions for the session.
     * @throws {InitializationError} If the manager is not initialized.
     * @throws {ModifyExplicitSessionError} If modifying the session fails.
     */
    modifyExplicitSession(sessionAddress: Address.Address, newPermissions: Signers.Session.ExplicitParams): Promise<void>;
    /**
     * @private Handles the connection-related part of a redirect response, initializing sessions.
     * @param response The response payload from the redirect.
     * @returns A promise resolving to true on success.
     */
    private _handleRedirectConnectionResponse;
    /**
     * Resets the manager state and clears all credentials from storage.
     */
    disconnect(): Promise<void>;
    /**
     * @private Initializes an implicit session signer and adds it to the session manager.
     * @param pk The private key of the session.
     * @param address The wallet address.
     * @param attestation The attestation from the wallet.
     * @param identitySignature The identity signature from the wallet.
     * @param saveSession Whether to persist the session in storage.
     * @param loginMethod The login method used.
     * @param userEmail The email associated with the session.
     */
    private _initializeImplicitSessionInternal;
    /**
     * @private Initializes an explicit session signer and adds it to the session manager.
     * It retries fetching permissions from the network if allowed.
     * @param pk The private key of the session.
     * @param allowRetries Whether to retry fetching permissions on failure.
     */
    private _initializeExplicitSessionInternal;
    /**
     * Fetches fee options for a set of transactions.
     * @param calls The transactions to estimate fees for.
     * @returns A promise that resolves with an array of fee options.
     * @throws {FeeOptionError} If fetching fee options fails.
     */
    getFeeOptions(calls: Transaction[]): Promise<Relayer.FeeOption[]>;
    /**
     * Builds, signs, and sends a batch of transactions.
     * @param transactions The transactions to be sent.
     * @param feeOption (Optional) The fee option to use for sponsoring the transaction. If provided, a token transfer call will be prepended.
     * @returns A promise that resolves with the transaction hash.
     * @throws {InitializationError} If the session is not initialized.
     * @throws {TransactionError} If the transaction fails at any stage.
     */
    buildSignAndSendTransactions(transactions: Transaction[], feeOption?: Relayer.FeeOption): Promise<string>;
    /**
     * Handles a redirect response from the wallet for this specific chain.
     * @param response The pre-parsed response from the transport.
     * @returns A promise that resolves to true if the response was handled successfully.
     * @throws {WalletRedirectError} If the response is invalid or causes an error.
     * @throws {InitializationError} If the session cannot be initialized from the response.
     */
    handleRedirectResponse(response: {
        payload: any;
        action: string;
    } | {
        error: any;
        action: string;
    }): Promise<boolean>;
    /**
     * Gets the wallet address associated with this manager.
     * @returns The wallet address, or null if not initialized.
     */
    getWalletAddress(): Address.Address | null;
    /**
     * Gets the sessions (signers) managed by this instance.
     * @returns An array of session objects.
     */
    getSessions(): Session[];
    /**
     * Requests a signature for a standard message (EIP-191).
     * The signature is delivered via the `signatureResponse` event.
     * @param message The message to sign.
     *
     * @throws {InitializationError} If the session is not initialized.
     * @throws {SigningError} If the signature request fails.
     *
     * @returns A promise that resolves when the signing process is initiated.
     */
    signMessage(message: string): Promise<void>;
    /**
     * Requests a signature for typed data (EIP-712).
     * The signature is delivered via the `signatureResponse` event.
     * @param typedData The EIP-712 typed data object to sign.
     *
     * @throws {InitializationError} If the session is not initialized.
     * @throws {SigningError} If the signature request fails.
     *
     * @returns A promise that resolves when the signing process is initiated.
     */
    signTypedData(typedData: TypedData): Promise<void>;
    /**
     * @private A generic helper to handle the logic for requesting any type of signature.
     *
     * @param action The action to request.
     * @param payload The payload to send.
     *
     * @throws {InitializationError} If the session is not initialized or transport is not available.
     * @throws {SigningError} If the signature request fails.
     */
    private _requestSignature;
    /**
     * @private Prepares, signs, and builds a transaction envelope.
     * @param calls The payload calls to include in the transaction.
     * @returns The signed transaction data ready for relaying.
     */
    private _buildAndSignCalls;
    /**
     * @private Polls the relayer for the status of a transaction until it is confirmed or fails.
     * @param opHash The operation hash of the relayed transaction.
     * @param chainId The chain ID of the transaction.
     * @returns The final status of the transaction.
     */
    private _waitForTransactionReceipt;
    /**
     * @private Resets the internal state of the manager without clearing stored credentials.
     */
    private _resetState;
    /**
     * @private Resets the internal state and clears all persisted session data from storage.
     */
    private _resetStateAndClearCredentials;
}
export {};
//# sourceMappingURL=ChainSessionManager.d.ts.map