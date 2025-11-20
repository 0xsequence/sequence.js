import { Address, Hex } from 'ox';
import { type ExplicitSession, type ExplicitSessionConfig, type ImplicitSession, type Session } from './index.js';
import { SequenceStorage, type SessionlessConnectionData } from './utils/storage.js';
import { DappClientExplicitSessionEventListener, DappClientWalletActionEventListener, FeeOption, GetFeeTokensResponse, GuardConfig, LoginMethod, RandomPrivateKeyFn, SequenceSessionStorage, Transaction, TransactionRequest, TransportMode } from './types/index.js';
import { TypedData } from 'ox/TypedData';
export type DappClientEventListener = (data?: any) => void;
interface DappClientEventMap {
    sessionsUpdated: () => void;
    walletActionResponse: DappClientWalletActionEventListener;
    explicitSessionResponse: DappClientExplicitSessionEventListener;
}
/**
 * The main entry point for interacting with the Wallet.
 * This client manages user sessions across multiple chains, handles connection
 * and disconnection, and provides methods for signing and sending transactions.
 *
 * @example
 * // It is recommended to manage a singleton instance of this client.
 * const dappClient = new DappClient('http://localhost:5173');
 *
 * async function main() {
 *   // Initialize the client on page load to restore existing sessions.
 *   await dappClient.initialize();
 *
 *   // If not connected, prompt the user to connect.
 *   if (!dappClient.isInitialized) {
 *     await client.connect(137, window.location.origin);
 *   }
 * }
 */
export declare class DappClient {
    isInitialized: boolean;
    loginMethod: LoginMethod | null;
    userEmail: string | null;
    guard?: GuardConfig;
    readonly origin: string;
    private chainSessionManagers;
    private walletUrl;
    private transport;
    private transportModeSetting;
    private projectAccessKey;
    private nodesUrl;
    private relayerUrl;
    private keymachineUrl;
    private sequenceStorage;
    private redirectPath?;
    private sequenceSessionStorage?;
    private randomPrivateKeyFn?;
    private redirectActionHandler?;
    private canUseIndexedDb;
    private isInitializing;
    private walletAddress;
    private hasSessionlessConnection;
    private cachedSessionlessConnection;
    private eventListeners;
    private get isBrowser();
    /**
     * @param walletUrl The URL of the Wallet Webapp.
     * @param origin The origin of the dapp
     * @param projectAccessKey Your project access key from sequence.build. Used for services like relayer and nodes.
     * @param options Configuration options for the client.
     * @param options.transportMode The communication mode to use with the wallet. Defaults to 'popup'.
     * @param options.redirectPath The path to redirect back to after a redirect-based flow. Constructed with origin + redirectPath.
     * @param options.nodesUrl The URL template for the nodes service. Use `{network}` as a placeholder for the network name. Defaults to the Sequence nodes ('https://nodes.sequence.app/{network}').
     * @param options.relayerUrl The URL template for the relayer service. Use `{network}` as a placeholder for the network name. Defaults to the Sequence relayer ('https://dev-{network}-relayer.sequence.app').
     * @param options.keymachineUrl The URL of the key management service.
     * @param options.sequenceStorage The storage implementation for persistent session data. Defaults to WebStorage using IndexedDB.
     * @param options.sequenceSessionStorage The storage implementation for temporary data (e.g., pending requests). Defaults to sessionStorage.
     * @param options.randomPrivateKeyFn A function to generate random private keys for new sessions.
     * @param options.redirectActionHandler A handler to manually control navigation for redirect flows.
     * @param options.canUseIndexedDb A flag to enable or disable the use of IndexedDB for caching.
     */
    constructor(walletUrl: string, origin: string, projectAccessKey: string, options?: {
        transportMode?: TransportMode;
        redirectPath?: string;
        keymachineUrl?: string;
        nodesUrl?: string;
        relayerUrl?: string;
        sequenceStorage?: SequenceStorage;
        sequenceSessionStorage?: SequenceSessionStorage;
        randomPrivateKeyFn?: RandomPrivateKeyFn;
        redirectActionHandler?: (url: string) => void;
        canUseIndexedDb?: boolean;
    });
    /**
     * @returns The transport mode of the client. {@link TransportMode}
     */
    get transportMode(): TransportMode;
    /**
     * Registers an event listener for a specific event.
     * @param event The event to listen for.
     * @param listener The listener to call when the event occurs.
     * @returns A function to remove the listener.
     *
     * @example
     * useEffect(() => {
     *   const handleWalletAction = (response) => {
     *     console.log('Received wallet action response:', response);
     *   };
     *
     *   const unsubscribe = dappClient.on("walletActionResponse", handleWalletAction);
     *
     *   return () => unsubscribe();
     * }, [dappClient]);
     */
    on<K extends keyof DappClientEventMap>(event: K, listener: DappClientEventMap[K]): () => void;
    /**
     * Retrieves the wallet address of the current session.
     * @returns The wallet address of the current session, or null if not initialized. {@link Address.Address}
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const walletAddress = dappClient.getWalletAddress();
     *   console.log('Wallet address:', walletAddress);
     * }
     */
    getWalletAddress(): Address.Address | null;
    /**
     * Retrieves a list of all active explicit sessions (signers) associated with the current wallet.
     * @returns An array of all the active explicit sessions. {@link ExplicitSession[]}
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const explicitSessions = dappClient.getAllExplicitSessions();
     *   console.log('Sessions:', explicitSessions);
     * }
     */
    getAllExplicitSessions(): ExplicitSession[];
    /**
     * Retrieves a list of all active implicit sessions (signers) associated with the current wallet.
     * @note There can only be one implicit session per chain.
     * @returns An array of all the active implicit sessions. {@link ImplicitSession[]}
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const implicitSessions = dappClient.getAllImplicitSessions();
     *   console.log('Sessions:', implicitSessions);
     * }
     */
    getAllImplicitSessions(): ImplicitSession[];
    /**
     * Gets all the sessions (explicit and implicit) managed by the client.
     * @returns An array of session objects. {@link Session[]}
     */
    getAllSessions(): Session[];
    /**
     * @private Loads the client's state from storage, initializing all chain managers
     * for previously established sessions.
     */
    private _loadStateFromStorage;
    /**
     * Initializes the client by loading any existing session from storage and handling any pending redirect responses.
     * This should be called once when your application loads.
     *
     * @remarks
     * An `Implicit` session is a session that can interact only with specific, Dapp-defined contracts.
     * An `Explicit` session is a session that can interact with any contract as long as the user has granted the necessary permissions.
     *
     * @throws If the initialization process fails. {@link InitializationError}
     *
     * @returns A promise that resolves when initialization is complete.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     */
    initialize(): Promise<void>;
    /**
     * Indicates if there is cached sessionless connection data that can be restored.
     */
    hasRestorableSessionlessConnection(): Promise<boolean>;
    /**
     * Returns the cached sessionless connection metadata without altering client state.
     * @returns The cached sessionless connection or null if none is available.
     */
    getSessionlessConnectionInfo(): Promise<SessionlessConnectionData | null>;
    /**
     * Restores a sessionless connection that was previously persisted via {@link disconnect} or a connect flow.
     * @returns A promise that resolves to true if a sessionless connection was applied.
     */
    restoreSessionlessConnection(): Promise<boolean>;
    /**
     * Handles the redirect response from the Wallet.
     * This is called automatically on `initialize()` for web environments but can be called manually
     * with a URL in environments like React Native.
     * @param url The full redirect URL from the wallet. If not provided, it will be read from the browser's current location.
     * @returns A promise that resolves when the redirect has been handled.
     */
    handleRedirectResponse(url?: string): Promise<void>;
    /**
     * Initiates a connection with the wallet and creates a new session.
     * @param chainId The primary chain ID for the new session.
     * @param sessionConfig Session configuration {@link ExplicitSessionConfig} to request for an initial session.
     * @param options (Optional) Connection options, such as a preferred login method or email for social or email logins.
     * @throws If the connection process fails. {@link ConnectionError}
     * @throws If a session already exists. {@link InitializationError}
     *
     * @returns A promise that resolves when the connection is established.
     *
     * @example
     * // Connect with an explicit session configuration
     * const explicitSessionConfig: ExplicitSessionConfig = {
     *   valueLimit: 0n,
     *   deadline: BigInt(Date.now() + 1000 * 60 * 60), // 1 hour
     *   permissions: [...],
     *   chainId: 137
     * };
     * await dappClient.connect(137, explicitSessionConfig, {
     *   preferredLoginMethod: 'google',
     * });
     */
    connect(chainId: number, sessionConfig?: ExplicitSessionConfig, options?: {
        preferredLoginMethod?: LoginMethod;
        email?: string;
        includeImplicitSession?: boolean;
    }): Promise<void>;
    /**
     * Upgrades an existing sessionless connection by creating implicit and/or explicit sessions.
     * @param chainId The chain ID to target for the new sessions.
     * @param sessionConfig The explicit session configuration to request. {@link ExplicitSessionConfig}
     * @param options Connection options such as preferred login method or email for social/email logins.
     * @throws If no sessionless connection is available or the session upgrade fails. {@link InitializationError}
     * @throws If neither an implicit nor explicit session is requested. {@link InitializationError}
     *
     * @returns A promise that resolves once the session upgrade completes.
     */
    upgradeSessionlessConnection(chainId: number, sessionConfig?: ExplicitSessionConfig, options?: {
        preferredLoginMethod?: LoginMethod;
        email?: string;
        includeImplicitSession?: boolean;
    }): Promise<void>;
    /**
     * Adds a new explicit session for a given chain to an existing wallet.
     * @remarks
     * An `explicit session` is a session that can interact with any contract, subject to user-approved permissions.
     * @param session The explicit session to add. {@link ExplicitSession}
     *
     * @throws If the session cannot be added. {@link AddExplicitSessionError}
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the session is added.
     *
     * @example
     * ...
     * import { ExplicitSession, Utils } from "@0xsequence/wallet-core";
     * import { DappClient } from "@0xsequence/sessions";
     * ...
     *
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * const amount = 1000000;
     * const USDC_ADDRESS = '0x...';
     *
     * if (dappClient.isInitialized) {
     *   // Allow Dapp (Session Signer) to transfer "amount" of USDC
     *   const explicitSession: ExplicitSession = {
     *    chainId: Number(chainId),
     *    valueLimit: 0n, // Not allowed to transfer native tokens (ETH, etc)
     *    deadline: BigInt(Date.now() + 1000 * 60 * 5000), // 5000 minutes from now
     *    permissions: [Utils.ERC20PermissionBuilder.buildTransfer(USDC_ADDRESS, amount)]
     *   };
     *   await dappClient.addExplicitSession(explicitSession);
     * }
     */
    addExplicitSession(explicitSessionConfig: ExplicitSessionConfig): Promise<void>;
    /**
     * Modifies an explicit session for a given chain
     * @param explicitSession The explicit session to modify. {@link ExplicitSession}
     *
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     * @throws If something goes wrong while modifying the session. {@link ModifyExplicitSessionError}
     *
     * @returns A promise that resolves when the session permissions are updated.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   // Increase the deadline of the current session by 24 hours
     *   const currentExplicitSession = {...}
     *   const newExplicitSession = {...currentExplicitSession, deadline: currentExplicitSession.deadline + 24 * 60 * 60}
     *   await dappClient.modifyExplicitSession(newExplicitSession);
     * }
     */
    modifyExplicitSession(explicitSession: ExplicitSession): Promise<void>;
    /**
     * Gets the gas fee options for an array of transactions.
     * @param chainId The chain ID on which to get the fee options.
     * @param transactions An array of transactions to get fee options for. These transactions will not be sent.
     * @throws If the fee options cannot be fetched. {@link FeeOptionError}
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves with the fee options. {@link FeeOption[]}
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const transactions: Transaction[] = [
     *     {
     *       to: '0x...',
     *       value: 0n,
     *       data: '0x...'
     *     }
     *   ];
     *   const feeOptions = await dappClient.getFeeOptions(1, transactions);
     *   const feeOption = feeOptions[0];
     *   // use the fee option to pay the gas
     *   const txHash = await dappClient.sendTransaction(1, transactions, feeOption);
     * }
     */
    getFeeOptions(chainId: number, transactions: Transaction[]): Promise<FeeOption[]>;
    /**
     * Fetches fee tokens for a chain.
     * @returns A promise that resolves with the fee tokens response. {@link GetFeeTokensResponse}
     * @throws If the fee tokens cannot be fetched. {@link InitializationError}
     */
    getFeeTokens(chainId: number): Promise<GetFeeTokensResponse>;
    /**
     * Checks if the current session has permission to execute a set of transactions on a specific chain.
     * @param chainId The chain ID on which to check the permissions.
     * @param transactions An array of transactions to check permissions for.
     * @returns A promise that resolves to true if the session has permission, otherwise false.
     */
    hasPermission(chainId: number, transactions: Transaction[]): Promise<boolean>;
    /**
     * Signs and sends a transaction using an available session signer.
     * @param chainId The chain ID on which to send the transaction.
     * @param transactions An array of transactions to be executed atomically in a single batch. {@link Transaction}
     * @param feeOption (Optional) The selected fee option to sponsor the transaction. {@link FeeOption}
     * @throws {TransactionError} If the transaction fails to send or confirm.
     * @throws {InitializationError} If the client or relevant chain is not initialized.
     *
     * @returns A promise that resolves with the transaction hash.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const transaction =  {
     *     to: '0x...',
     *     value: 0n,
     *     data: '0x...'
     *   };
     *
     *   const txHash = await dappClient.sendTransaction(1, [transaction]);
     */
    sendTransaction(chainId: number, transactions: Transaction[], feeOption?: FeeOption): Promise<Hex.Hex>;
    /**
     * Signs a standard message (EIP-191) using an available session signer.
     * @param chainId The chain ID on which to sign the message.
     * @param message The message to sign.
     * @throws If the message cannot be signed. {@link SigningError}
     * @throws If the client is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the signing process is initiated. The signature is delivered via the `walletActionResponse` event listener.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const message = 'Hello, world!';
     *   await dappClient.signMessage(1, message);
     * }
     */
    signMessage(chainId: number, message: string): Promise<void>;
    /**
     * Signs a typed data object (EIP-712) using an available session signer.
     * @param chainId The chain ID on which to sign the typed data.
     * @param typedData The typed data object to sign.
     * @throws If the typed data cannot be signed. {@link SigningError}
     * @throws If the client is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the signing process is initiated. The signature is returned in the `walletActionResponse` event listener.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const typedData = {...}
     *   await dappClient.signTypedData(1, typedData);
     * }
     */
    signTypedData(chainId: number, typedData: TypedData): Promise<void>;
    /**
     * Sends transaction data to be signed and submitted by the wallet.
     * @param chainId The chain ID on which to send the transaction.
     * @param transactionRequest The transaction request object.
     * @throws If the transaction cannot be sent. {@link TransactionError}
     * @throws If the client is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the sending process is initiated. The transaction hash is delivered via the `walletActionResponse` event listener.
     */
    sendWalletTransaction(chainId: number, transactionRequest: TransactionRequest): Promise<void>;
    /**
     * Disconnects the client, clearing all session data from browser storage.
     * @remarks This action does not revoke the sessions on-chain. Sessions remain active until they expire or are manually revoked by the user in their wallet.
     * @param options Options to control the disconnection behavior.
     * @param options.keepSessionlessConnection When true, retains the latest wallet metadata so it can be restored later as a sessionless connection. Defaults to true.
     * @returns A promise that resolves when disconnection is complete.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   await dappClient.disconnect({ keepSessionlessConnection: true });
     * }
     */
    disconnect(options?: {
        keepSessionlessConnection?: boolean;
    }): Promise<void>;
    /**
     * @private Emits an event to all registered listeners.
     * @param event The event to emit.
     * @param args The data to emit with the event.
     */
    private emit;
    private ensureTransport;
    private applySessionlessConnectionState;
    private _requestWalletAction;
    /**
     * @private Retrieves or creates and initializes a ChainSessionManager for a given chain ID.
     * @param chainId The chain ID to get the ChainSessionManager for.
     * @returns The initialized ChainSessionManager for the given chain ID.
     */
    private getOrInitializeChainManager;
    /**
     * @private Retrieves or creates a ChainSessionManager for a given chain ID.
     * @param chainId The chain ID to get the ChainSessionManager for.
     * @returns The ChainSessionManager for the given chain ID. {@link ChainSessionManager}
     */
    private getChainSessionManager;
}
export {};
//# sourceMappingURL=DappClient.d.ts.map