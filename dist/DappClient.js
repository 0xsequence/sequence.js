import { Address } from 'ox';
import { ChainSessionManager } from './ChainSessionManager.js';
import { DappTransport } from './DappTransport.js';
import { ConnectionError, InitializationError, SigningError, TransactionError } from './utils/errors.js';
import { WebStorage } from './utils/storage.js';
import { RequestActionType, TransportMode, } from './types/index.js';
import { KEYMACHINE_URL, NODES_URL, RELAYER_URL } from './utils/constants.js';
import { getRelayerUrl, getRpcUrl } from './utils/index.js';
import { Relayer } from '@0xsequence/relayer';
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
export class DappClient {
    isInitialized = false;
    loginMethod = null;
    userEmail = null;
    guard;
    origin;
    chainSessionManagers = new Map();
    walletUrl;
    transport = null;
    transportModeSetting;
    projectAccessKey;
    nodesUrl;
    relayerUrl;
    keymachineUrl;
    sequenceStorage;
    redirectPath;
    sequenceSessionStorage;
    randomPrivateKeyFn;
    redirectActionHandler;
    canUseIndexedDb;
    isInitializing = false;
    walletAddress = null;
    hasSessionlessConnection = false;
    cachedSessionlessConnection = null;
    eventListeners = {};
    get isBrowser() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }
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
    constructor(walletUrl, origin, projectAccessKey, options) {
        const { transportMode = TransportMode.POPUP, keymachineUrl = KEYMACHINE_URL, redirectPath, sequenceStorage = new WebStorage(), sequenceSessionStorage, randomPrivateKeyFn, redirectActionHandler, canUseIndexedDb = true, } = options || {};
        this.walletUrl = walletUrl;
        this.transportModeSetting = transportMode;
        this.projectAccessKey = projectAccessKey;
        this.nodesUrl = options?.nodesUrl || NODES_URL;
        this.relayerUrl = options?.relayerUrl || RELAYER_URL;
        this.origin = origin;
        this.keymachineUrl = keymachineUrl;
        this.sequenceStorage = sequenceStorage;
        this.redirectPath = redirectPath;
        this.sequenceSessionStorage = sequenceSessionStorage;
        this.randomPrivateKeyFn = randomPrivateKeyFn;
        this.redirectActionHandler = redirectActionHandler;
        this.canUseIndexedDb = canUseIndexedDb;
    }
    /**
     * @returns The transport mode of the client. {@link TransportMode}
     */
    get transportMode() {
        return this.transport?.mode ?? this.transportModeSetting;
    }
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
    on(event, listener) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = new Set();
        }
        ;
        this.eventListeners[event].add(listener);
        return () => {
            ;
            this.eventListeners[event]?.delete(listener);
        };
    }
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
    getWalletAddress() {
        return this.walletAddress;
    }
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
    getAllExplicitSessions() {
        const allExplicitSessions = new Map();
        Array.from(this.chainSessionManagers.values()).forEach((chainSessionManager) => {
            chainSessionManager.getExplicitSessions().forEach((session) => {
                const uniqueKey = session.sessionAddress?.toLowerCase();
                if (!allExplicitSessions.has(uniqueKey)) {
                    allExplicitSessions.set(uniqueKey, session);
                }
            });
        });
        return Array.from(allExplicitSessions.values());
    }
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
    getAllImplicitSessions() {
        const allImplicitSessions = new Map();
        Array.from(this.chainSessionManagers.values()).forEach((chainSessionManager) => {
            const session = chainSessionManager.getImplicitSession();
            if (!session)
                return;
            const uniqueKey = session?.sessionAddress?.toLowerCase();
            if (uniqueKey && !allImplicitSessions.has(uniqueKey)) {
                allImplicitSessions.set(uniqueKey, session);
            }
        });
        return Array.from(allImplicitSessions.values());
    }
    /**
     * Gets all the sessions (explicit and implicit) managed by the client.
     * @returns An array of session objects. {@link Session[]}
     */
    getAllSessions() {
        return [...this.getAllImplicitSessions(), ...this.getAllExplicitSessions()];
    }
    /**
     * @private Loads the client's state from storage, initializing all chain managers
     * for previously established sessions.
     */
    async _loadStateFromStorage() {
        const implicitSession = await this.sequenceStorage.getImplicitSession();
        const [explicitSessions, sessionlessConnection, sessionlessSnapshot] = await Promise.all([
            this.sequenceStorage.getExplicitSessions(),
            this.sequenceStorage.getSessionlessConnection(),
            this.sequenceStorage.getSessionlessConnectionSnapshot
                ? this.sequenceStorage.getSessionlessConnectionSnapshot()
                : Promise.resolve(null),
        ]);
        this.cachedSessionlessConnection = sessionlessSnapshot ?? null;
        const chainIdsToInitialize = new Set([
            ...(implicitSession?.chainId !== undefined ? [implicitSession.chainId] : []),
            ...explicitSessions.map((s) => s.chainId),
        ]);
        if (chainIdsToInitialize.size === 0) {
            if (sessionlessConnection) {
                await this.applySessionlessConnectionState(sessionlessConnection.walletAddress, sessionlessConnection.loginMethod, sessionlessConnection.userEmail, sessionlessConnection.guard, false);
            }
            else {
                this.isInitialized = false;
                this.hasSessionlessConnection = false;
                this.walletAddress = null;
                this.loginMethod = null;
                this.userEmail = null;
                this.guard = undefined;
                this.emit('sessionsUpdated');
            }
            return;
        }
        this.hasSessionlessConnection = false;
        const initPromises = Array.from(chainIdsToInitialize).map((chainId) => this.getChainSessionManager(chainId).initialize());
        const result = await Promise.all(initPromises);
        this.walletAddress = implicitSession?.walletAddress || explicitSessions[0]?.walletAddress || null;
        this.loginMethod = result[0]?.loginMethod || null;
        this.userEmail = result[0]?.userEmail || null;
        this.guard = implicitSession?.guard || explicitSessions.find((s) => !!s.guard)?.guard;
        await this.sequenceStorage.clearSessionlessConnection();
        if (this.sequenceStorage.clearSessionlessConnectionSnapshot) {
            await this.sequenceStorage.clearSessionlessConnectionSnapshot();
        }
        this.cachedSessionlessConnection = null;
        this.isInitialized = true;
        this.emit('sessionsUpdated');
    }
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
    async initialize() {
        if (this.isInitializing)
            return;
        this.isInitializing = true;
        try {
            // First, load any existing session from storage. This is crucial so that
            // when we process a redirect for an explicit session, we know the wallet address.
            await this._loadStateFromStorage();
            // Now, check if there's a response from a redirect flow.
            if (await this.sequenceStorage.isRedirectRequestPending()) {
                try {
                    // Attempt to handle any response from the wallet redirect.
                    await this.handleRedirectResponse();
                }
                finally {
                    // We have to clear pending redirect data here as well in case we received an error from the wallet.
                    await this.sequenceStorage.setPendingRedirectRequest(false);
                    await this.sequenceStorage.getAndClearTempSessionPk();
                }
                // After handling the redirect, the session state will have changed,
                // so we must load it again.
                await this._loadStateFromStorage();
            }
        }
        catch (e) {
            await this.disconnect();
            throw e;
        }
        finally {
            this.isInitializing = false;
        }
    }
    /**
     * Indicates if there is cached sessionless connection data that can be restored.
     */
    async hasRestorableSessionlessConnection() {
        if (this.cachedSessionlessConnection)
            return true;
        this.cachedSessionlessConnection = this.sequenceStorage.getSessionlessConnectionSnapshot
            ? await this.sequenceStorage.getSessionlessConnectionSnapshot()
            : null;
        return this.cachedSessionlessConnection !== null;
    }
    /**
     * Returns the cached sessionless connection metadata without altering client state.
     * @returns The cached sessionless connection or null if none is available.
     */
    async getSessionlessConnectionInfo() {
        if (!this.cachedSessionlessConnection) {
            this.cachedSessionlessConnection = this.sequenceStorage.getSessionlessConnectionSnapshot
                ? await this.sequenceStorage.getSessionlessConnectionSnapshot()
                : null;
        }
        if (!this.cachedSessionlessConnection)
            return null;
        return {
            walletAddress: this.cachedSessionlessConnection.walletAddress,
            loginMethod: this.cachedSessionlessConnection.loginMethod,
            userEmail: this.cachedSessionlessConnection.userEmail,
            guard: this.cachedSessionlessConnection.guard,
        };
    }
    /**
     * Restores a sessionless connection that was previously persisted via {@link disconnect} or a connect flow.
     * @returns A promise that resolves to true if a sessionless connection was applied.
     */
    async restoreSessionlessConnection() {
        const sessionlessConnection = this.cachedSessionlessConnection ??
            (this.sequenceStorage.getSessionlessConnectionSnapshot
                ? await this.sequenceStorage.getSessionlessConnectionSnapshot()
                : null);
        if (!sessionlessConnection) {
            return false;
        }
        await this.applySessionlessConnectionState(sessionlessConnection.walletAddress, sessionlessConnection.loginMethod, sessionlessConnection.userEmail, sessionlessConnection.guard);
        if (this.sequenceStorage.clearSessionlessConnectionSnapshot) {
            await this.sequenceStorage.clearSessionlessConnectionSnapshot();
        }
        this.cachedSessionlessConnection = null;
        return true;
    }
    /**
     * Handles the redirect response from the Wallet.
     * This is called automatically on `initialize()` for web environments but can be called manually
     * with a URL in environments like React Native.
     * @param url The full redirect URL from the wallet. If not provided, it will be read from the browser's current location.
     * @returns A promise that resolves when the redirect has been handled.
     */
    async handleRedirectResponse(url) {
        const pendingRequest = await this.sequenceStorage.peekPendingRequest();
        if (!this.transport && this.transportMode === TransportMode.POPUP && !this.isBrowser) {
            return;
        }
        const response = await this.ensureTransport().getRedirectResponse(true, url);
        if (!response) {
            return;
        }
        const { action } = response;
        const chainId = pendingRequest?.chainId;
        if (action === RequestActionType.SIGN_MESSAGE ||
            action === RequestActionType.SIGN_TYPED_DATA ||
            action === RequestActionType.SEND_WALLET_TRANSACTION) {
            if (chainId === undefined) {
                throw new InitializationError('Could not find a chainId for the pending signature request.');
            }
            const eventPayload = {
                action,
                response: 'payload' in response ? response.payload : undefined,
                error: 'error' in response ? response.error : undefined,
                chainId,
            };
            this.emit('walletActionResponse', eventPayload);
        }
        else if (chainId !== undefined) {
            if ('error' in response && response.error && action === RequestActionType.CREATE_NEW_SESSION) {
                await this.sequenceStorage.setPendingRedirectRequest(false);
                await this.sequenceStorage.getAndClearTempSessionPk();
                await this.sequenceStorage.getAndClearPendingRequest();
                if (this.hasSessionlessConnection) {
                    const sessionlessConnection = await this.sequenceStorage.getSessionlessConnection();
                    if (sessionlessConnection) {
                        await this.applySessionlessConnectionState(sessionlessConnection.walletAddress, sessionlessConnection.loginMethod, sessionlessConnection.userEmail, sessionlessConnection.guard, false);
                    }
                    else if (this.walletAddress) {
                        await this.applySessionlessConnectionState(this.walletAddress, this.loginMethod, this.userEmail, this.guard, false);
                    }
                }
                return;
            }
            const chainSessionManager = this.getChainSessionManager(chainId);
            if (!chainSessionManager.isInitialized && this.walletAddress) {
                chainSessionManager.initializeWithWallet(this.walletAddress);
            }
            const handled = await chainSessionManager.handleRedirectResponse(response);
            if (handled && action === RequestActionType.CREATE_NEW_SESSION) {
                const hasImplicit = !!chainSessionManager.getImplicitSession();
                const hasExplicit = chainSessionManager.getExplicitSessions().length > 0;
                if (hasImplicit || hasExplicit) {
                    this.hasSessionlessConnection = false;
                    await this._loadStateFromStorage();
                }
                else if ('payload' in response && response.payload) {
                    const payload = response.payload;
                    const walletAddress = chainSessionManager.getWalletAddress() ?? Address.from(payload.walletAddress);
                    await this.applySessionlessConnectionState(walletAddress, chainSessionManager.loginMethod, chainSessionManager.userEmail, chainSessionManager.getGuard());
                }
            }
            else if (handled && action === RequestActionType.ADD_EXPLICIT_SESSION) {
                this.hasSessionlessConnection = false;
                await this._loadStateFromStorage();
            }
        }
        else {
            throw new InitializationError(`Could not find a pending request context for the redirect action: ${action}`);
        }
    }
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
    async connect(chainId, sessionConfig, options = {}) {
        if (this.isInitialized) {
            throw new InitializationError('A session already exists. Disconnect first.');
        }
        try {
            const chainSessionManager = this.getChainSessionManager(chainId);
            const shouldCreateSession = !!sessionConfig || (options.includeImplicitSession ?? false);
            this.hasSessionlessConnection = false;
            await chainSessionManager.createNewSession(this.origin, sessionConfig, options);
            // For popup mode, we need to manually update the state and emit an event.
            // For redirect mode, this code won't be reached; the page will navigate away.
            if (this.transportMode === TransportMode.POPUP) {
                const hasImplicitSession = !!chainSessionManager.getImplicitSession();
                const hasExplicitSessions = chainSessionManager.getExplicitSessions().length > 0;
                if (shouldCreateSession && (hasImplicitSession || hasExplicitSessions)) {
                    await this._loadStateFromStorage();
                }
                else {
                    const walletAddress = chainSessionManager.getWalletAddress();
                    if (!walletAddress) {
                        throw new InitializationError('Wallet address missing after connect.');
                    }
                    await this.applySessionlessConnectionState(walletAddress, chainSessionManager.loginMethod, chainSessionManager.userEmail, chainSessionManager.getGuard());
                }
            }
        }
        catch (err) {
            await this.disconnect();
            throw new ConnectionError(`Connection failed: ${err}`);
        }
    }
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
    async upgradeSessionlessConnection(chainId, sessionConfig, options = {}) {
        if (!this.isInitialized || !this.hasSessionlessConnection || !this.walletAddress) {
            throw new InitializationError('A sessionless connection is required before requesting new sessions.');
        }
        const shouldCreateSession = !!sessionConfig || (options.includeImplicitSession ?? false);
        if (!shouldCreateSession) {
            throw new InitializationError('Cannot upgrade a sessionless connection without requesting an implicit or explicit session.');
        }
        const sessionlessSnapshot = {
            walletAddress: this.walletAddress,
            loginMethod: this.loginMethod,
            userEmail: this.userEmail,
            guard: this.guard,
        };
        try {
            let chainSessionManager = this.chainSessionManagers.get(chainId);
            if (chainSessionManager &&
                chainSessionManager.isInitialized &&
                !chainSessionManager.getImplicitSession() &&
                chainSessionManager.getExplicitSessions().length === 0) {
                this.chainSessionManagers.delete(chainId);
                chainSessionManager = undefined;
            }
            chainSessionManager = chainSessionManager ?? this.getChainSessionManager(chainId);
            await chainSessionManager.createNewSession(this.origin, sessionConfig, options);
            if (this.transportMode === TransportMode.POPUP) {
                const hasImplicitSession = !!chainSessionManager.getImplicitSession();
                const hasExplicitSessions = chainSessionManager.getExplicitSessions().length > 0;
                if (shouldCreateSession && (hasImplicitSession || hasExplicitSessions)) {
                    await this._loadStateFromStorage();
                }
                else {
                    const walletAddress = chainSessionManager.getWalletAddress();
                    if (!walletAddress) {
                        throw new InitializationError('Wallet address missing after connect.');
                    }
                    await this.applySessionlessConnectionState(walletAddress, chainSessionManager.loginMethod, chainSessionManager.userEmail, chainSessionManager.getGuard());
                }
            }
        }
        catch (err) {
            await this.applySessionlessConnectionState(sessionlessSnapshot.walletAddress, sessionlessSnapshot.loginMethod, sessionlessSnapshot.userEmail, sessionlessSnapshot.guard);
            throw new ConnectionError(`Connection failed: ${err}`);
        }
    }
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
    async addExplicitSession(explicitSessionConfig) {
        if (!this.isInitialized || !this.walletAddress)
            throw new InitializationError('Cannot add an explicit session without an existing wallet.');
        const chainSessionManager = this.getChainSessionManager(explicitSessionConfig.chainId);
        if (!chainSessionManager.isInitialized) {
            chainSessionManager.initializeWithWallet(this.walletAddress);
        }
        await chainSessionManager.addExplicitSession(explicitSessionConfig);
        if (this.transportMode === TransportMode.POPUP) {
            await this._loadStateFromStorage();
        }
    }
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
    async modifyExplicitSession(explicitSession) {
        if (!this.isInitialized || !this.walletAddress)
            throw new InitializationError('Cannot modify an explicit session without an existing wallet.');
        const chainSessionManager = this.getChainSessionManager(explicitSession.chainId);
        if (!chainSessionManager.isInitialized) {
            chainSessionManager.initializeWithWallet(this.walletAddress);
        }
        await chainSessionManager.modifyExplicitSession(explicitSession);
        if (this.transportMode === TransportMode.POPUP) {
            await this._loadStateFromStorage();
        }
    }
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
    async getFeeOptions(chainId, transactions) {
        const chainSessionManager = await this.getOrInitializeChainManager(chainId);
        return await chainSessionManager.getFeeOptions(transactions);
    }
    /**
     * Fetches fee tokens for a chain.
     * @returns A promise that resolves with the fee tokens response. {@link GetFeeTokensResponse}
     * @throws If the fee tokens cannot be fetched. {@link InitializationError}
     */
    async getFeeTokens(chainId) {
        const relayer = new Relayer.RpcRelayer(getRelayerUrl(chainId, this.relayerUrl), chainId, getRpcUrl(chainId, this.nodesUrl, this.projectAccessKey));
        return await relayer.feeTokens();
    }
    /**
     * Checks if the current session has permission to execute a set of transactions on a specific chain.
     * @param chainId The chain ID on which to check the permissions.
     * @param transactions An array of transactions to check permissions for.
     * @returns A promise that resolves to true if the session has permission, otherwise false.
     */
    async hasPermission(chainId, transactions) {
        if (!this.isInitialized) {
            return false;
        }
        try {
            const chainSessionManager = await this.getOrInitializeChainManager(chainId);
            return await chainSessionManager.hasPermission(transactions);
        }
        catch (error) {
            console.warn(`hasPermission check failed for chain ${chainId}:`, error instanceof Error ? error.message : String(error));
            return false;
        }
    }
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
    async sendTransaction(chainId, transactions, feeOption) {
        const chainSessionManager = await this.getOrInitializeChainManager(chainId);
        return await chainSessionManager.buildSignAndSendTransactions(transactions, feeOption);
    }
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
    async signMessage(chainId, message) {
        if (!this.isInitialized || !this.walletAddress)
            throw new InitializationError('Not initialized');
        const payload = {
            address: this.walletAddress,
            message,
            chainId: chainId,
        };
        try {
            await this._requestWalletAction(RequestActionType.SIGN_MESSAGE, payload, chainId);
        }
        catch (err) {
            throw new SigningError(`Signing message failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
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
    async signTypedData(chainId, typedData) {
        if (!this.isInitialized || !this.walletAddress)
            throw new InitializationError('Not initialized');
        const payload = {
            address: this.walletAddress,
            typedData,
            chainId: chainId,
        };
        try {
            await this._requestWalletAction(RequestActionType.SIGN_TYPED_DATA, payload, chainId);
        }
        catch (err) {
            throw new SigningError(`Signing typed data failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    /**
     * Sends transaction data to be signed and submitted by the wallet.
     * @param chainId The chain ID on which to send the transaction.
     * @param transactionRequest The transaction request object.
     * @throws If the transaction cannot be sent. {@link TransactionError}
     * @throws If the client is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the sending process is initiated. The transaction hash is delivered via the `walletActionResponse` event listener.
     */
    async sendWalletTransaction(chainId, transactionRequest) {
        if (!this.isInitialized || !this.walletAddress)
            throw new InitializationError('Not initialized');
        const payload = {
            address: this.walletAddress,
            transactionRequest,
            chainId: chainId,
        };
        try {
            await this._requestWalletAction(RequestActionType.SEND_WALLET_TRANSACTION, payload, chainId);
        }
        catch (err) {
            throw new TransactionError(`Sending transaction data to wallet failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
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
    async disconnect(options) {
        const keepSessionlessConnection = options?.keepSessionlessConnection ?? true;
        const transportMode = this.transportMode;
        if (this.transport) {
            this.transport.destroy();
        }
        this.transport = null;
        this.chainSessionManagers.clear();
        const sessionlessSnapshot = keepSessionlessConnection && this.walletAddress
            ? {
                walletAddress: this.walletAddress,
                loginMethod: this.loginMethod ?? undefined,
                userEmail: this.userEmail ?? undefined,
                guard: this.guard,
            }
            : undefined;
        await this.sequenceStorage.clearAllData();
        if (sessionlessSnapshot) {
            if (this.sequenceStorage.saveSessionlessConnectionSnapshot) {
                await this.sequenceStorage.saveSessionlessConnectionSnapshot(sessionlessSnapshot);
            }
            this.cachedSessionlessConnection = sessionlessSnapshot;
        }
        else {
            if (this.sequenceStorage.clearSessionlessConnectionSnapshot) {
                await this.sequenceStorage.clearSessionlessConnectionSnapshot();
            }
            this.cachedSessionlessConnection = null;
        }
        this.isInitialized = false;
        this.walletAddress = null;
        this.loginMethod = null;
        this.userEmail = null;
        this.guard = undefined;
        this.hasSessionlessConnection = false;
        this.emit('sessionsUpdated');
    }
    /**
     * @private Emits an event to all registered listeners.
     * @param event The event to emit.
     * @param args The data to emit with the event.
     */
    emit(event, ...args) {
        const listeners = this.eventListeners[event];
        if (listeners) {
            listeners.forEach((listener) => listener(...args));
        }
    }
    ensureTransport() {
        if (!this.transport) {
            if (this.transportModeSetting === TransportMode.POPUP && !this.isBrowser) {
                throw new InitializationError('Popup transport requires a browser environment.');
            }
            this.transport = new DappTransport(this.walletUrl, this.transportModeSetting, undefined, this.sequenceSessionStorage, this.redirectActionHandler);
        }
        return this.transport;
    }
    async applySessionlessConnectionState(walletAddress, loginMethod, userEmail, guard, persist = true) {
        this.walletAddress = walletAddress;
        this.loginMethod = loginMethod ?? null;
        this.userEmail = userEmail ?? null;
        this.guard = guard;
        this.hasSessionlessConnection = true;
        this.isInitialized = true;
        this.cachedSessionlessConnection = null;
        this.emit('sessionsUpdated');
        if (persist) {
            await this.sequenceStorage.saveSessionlessConnection({
                walletAddress,
                loginMethod: this.loginMethod ?? undefined,
                userEmail: this.userEmail ?? undefined,
                guard: this.guard,
            });
        }
    }
    async _requestWalletAction(action, payload, chainId) {
        if (!this.isInitialized || !this.walletAddress) {
            throw new InitializationError('Session not initialized. Cannot request wallet action.');
        }
        try {
            const redirectUrl = this.origin + (this.redirectPath ? this.redirectPath : '');
            const path = action === RequestActionType.SEND_WALLET_TRANSACTION ? '/request/transaction' : '/request/sign';
            const transport = this.ensureTransport();
            if (transport.mode === TransportMode.REDIRECT) {
                await this.sequenceStorage.savePendingRequest({
                    action,
                    payload,
                    chainId: chainId,
                });
                await this.sequenceStorage.setPendingRedirectRequest(true);
                await transport.sendRequest(action, redirectUrl, payload, { path });
            }
            else {
                const response = await transport.sendRequest(action, redirectUrl, payload, {
                    path,
                });
                this.emit('walletActionResponse', { action, response, chainId });
            }
        }
        catch (err) {
            const error = new SigningError(err instanceof Error ? err.message : String(err));
            this.emit('walletActionResponse', { action, error, chainId });
            throw error;
        }
        finally {
            if (this.transportMode === TransportMode.POPUP && this.transport) {
                this.transport.closeWallet();
            }
        }
    }
    /**
     * @private Retrieves or creates and initializes a ChainSessionManager for a given chain ID.
     * @param chainId The chain ID to get the ChainSessionManager for.
     * @returns The initialized ChainSessionManager for the given chain ID.
     */
    async getOrInitializeChainManager(chainId) {
        if (!this.isInitialized || !this.walletAddress) {
            throw new InitializationError('DappClient is not initialized.');
        }
        const manager = this.getChainSessionManager(chainId);
        if (!manager.isInitialized) {
            await manager.initialize();
        }
        if (!manager.isInitialized) {
            throw new InitializationError(`ChainSessionManager for chain ${chainId} could not be initialized.`);
        }
        if (!manager.getImplicitSession() && manager.getExplicitSessions().length === 0) {
            throw new InitializationError('No sessions are available for the requested action.');
        }
        return manager;
    }
    /**
     * @private Retrieves or creates a ChainSessionManager for a given chain ID.
     * @param chainId The chain ID to get the ChainSessionManager for.
     * @returns The ChainSessionManager for the given chain ID. {@link ChainSessionManager}
     */
    getChainSessionManager(chainId) {
        let chainSessionManager = this.chainSessionManagers.get(chainId);
        if (!chainSessionManager) {
            const transport = this.ensureTransport();
            chainSessionManager = new ChainSessionManager(chainId, transport, this.projectAccessKey, this.keymachineUrl, this.nodesUrl, this.relayerUrl, this.sequenceStorage, this.origin + (this.redirectPath ? this.redirectPath : ''), this.guard, this.randomPrivateKeyFn, this.canUseIndexedDb);
            this.chainSessionManagers.set(chainId, chainSessionManager);
            chainSessionManager.on('explicitSessionResponse', (data) => {
                this.emit('explicitSessionResponse', { ...data, chainId });
            });
        }
        return chainSessionManager;
    }
}
