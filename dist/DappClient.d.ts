import { Relayer, Signers } from '@0xsequence/wallet-core';
import { Address, Hex } from 'ox';
import { SequenceStorage } from './utils/storage.js';
import { DappClientExplicitSessionEventListener, DappClientSignatureEventListener, LoginMethod, RandomPrivateKeyFn, SequenceSessionStorage, Session, Transaction, TransportMode } from './types/index.js';
import { TypedData } from 'ox/TypedData';
export type DappClientEventListener = (data?: any) => void;
interface DappClientEventMap {
    sessionsUpdated: () => void;
    signatureResponse: DappClientSignatureEventListener;
    explicitSessionResponse: DappClientExplicitSessionEventListener;
}
/**
 * The main entry point for interacting with the Wallet.
 * This client manages user sessions across multiple chains, handles connection
 * and disconnection, and provides methods for signing and sending transactions.
 *
 * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client} for more detailed documentation.
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
    loginMethod: string | null;
    userEmail: string | null;
    readonly origin: string;
    private chainSessionManagers;
    private walletUrl;
    private transport;
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
    private eventListeners;
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
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/on} for more detailed documentation.
     *
     * @example
     * useEffect(() => {
     *   const handleSessionUpdate = () => {
     *     setSession({
     *       isInitialized: dappClient.isInitialized,
     *       walletAddress: dappClient.getWalletAddress(),
     *       // ... other properties
     *     });
     *   };
     *
     *   const unsubscribe = dappClient.on("sessionsUpdated", handleSessionUpdate);
     *
     *   return () => unsubscribe();
     * }, [dappClient]);
     */
    on<K extends keyof DappClientEventMap>(event: K, listener: DappClientEventMap[K]): () => void;
    /**
     * Retrieves the wallet address of the current session.
     * @returns The wallet address of the current session, or null if not initialized. {@link Address.Address}
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/get-wallet-address} for more detailed documentation.
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
     * Retrieves a list of all active sessions (signers) associated with the current wallet.
     * @returns An array of all the active sessions. {@link { address: Address.Address, isImplicit: boolean }[]}
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/get-all-sessions} for more detailed documentation.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   const sessions = dappClient.getAllSessions();
     *   console.log('Sessions:', sessions);
     * }
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
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/initialize} for more detailed documentation.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     */
    initialize(): Promise<void>;
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
     * @param permissions (Optional) Permissions to request for an initial explicit session. {@link Signers.Session.ExplicitParams}
     * @param options (Optional) Connection options, such as a preferred login method or email for social or email logins.
     * @throws If the connection process fails. {@link ConnectionError}
     * @throws If a session already exists. {@link InitializationError}
     *
     * @returns A promise that resolves when the connection is established.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/connect} for more detailed documentation.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.connect(137, window.location.origin, undefined, {
     *   preferredLoginMethod: 'google',
     * });
     */
    connect(chainId: number, permissions?: Signers.Session.ExplicitParams, options?: {
        preferredLoginMethod?: LoginMethod;
        email?: string;
        includeImplicitSession?: boolean;
    }): Promise<void>;
    /**
     * Adds a new explicit session for a given chain to an existing wallet.
     * @remarks
     * An `explicit session` is a session that can interact with any contract, subject to user-approved permissions.
     * @param chainId The chain ID on which to add the explicit session.
     * @param permissions The permissions to request for the new session. {@link Signers.Session.ExplicitParams}
     *
     * @throws If the session cannot be added. {@link AddExplicitSessionError}
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the session is added.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/add-explicit-session} for more detailed documentation.
     *
     * @example
     * ...
     * import { Signers, Utils } from "@0xsequence/wallet-core";
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
     *   const permissions: Signers.Session.ExplicitParams = {
     *    chainId: Number(chainId),
     *    valueLimit: 0n, // Not allowed to transfer native tokens (ETH, etc)
     *    deadline: BigInt(Date.now() + 1000 * 60 * 5000), // 5000 minutes from now
     *    permissions: [Utils.ERC20PermissionBuilder.buildTransfer(USDC_ADDRESS, amount)]
     *   };
     *   await dappClient.addExplicitSession(1, permissions);
     * }
     */
    addExplicitSession(chainId: number, permissions: Signers.Session.ExplicitParams): Promise<void>;
    /**
     * Modifies the permissions of an existing explicit session for a given chain and session address.
     * @param chainId The chain ID on which the explicit session exists.
     * @param sessionAddress The address of the explicit session to modify. {@link Address.Address}
     * @param permissions The new permissions to set for the session. {@link Signers.Session.ExplicitParams}
     *
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     * @throws If something goes wrong while modifying the session. {@link ModifyExplicitSessionError}
     *
     * @returns A promise that resolves when the session permissions are updated.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/modify-explicit-session} for more detailed documentation.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   // The address of an existing explicit session (Grants the Dapp permission to transfer 100 USDC for the user)
     *   const sessionAddress = '0x...';
     *   // We create a new permission object where we can increase the granted transfer amount limit
     *   const permissions: Signers.Session.ExplicitParams = {
     *     chainId: Number(chainId),
     *     valueLimit: 0n,
     *     deadline: BigInt(Date.now() + 1000 * 60 * 5000),
     *     permissions: [Utils.ERC20PermissionBuilder.buildTransfer(USDC_ADDRESS, amount)]
     *   };
     *   await dappClient.modifyExplicitSession(1, sessionAddress, permissions);
     * }
     */
    modifyExplicitSession(chainId: number, sessionAddress: Address.Address, permissions: Signers.Session.ExplicitParams): Promise<void>;
    /**
     * Gets the gas fee options for an array of transactions.
     * @param chainId The chain ID on which to get the fee options.
     * @param transactions An array of transactions to get fee options for. These transactions will not be sent.
     * @throws If the fee options cannot be fetched. {@link FeeOptionError}
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves with the fee options. {@link Relayer.FeeOption[]}
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/get-fee-options} for more detailed documentation.
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
    getFeeOptions(chainId: number, transactions: Transaction[]): Promise<Relayer.FeeOption[]>;
    /**
     * Signs and sends a transaction using an available session signer.
     * @param chainId The chain ID on which to send the transaction.
     * @param transactions An array of transactions to be executed atomically in a single batch. {@link Transaction}
     * @param feeOption (Optional) The selected fee option to sponsor the transaction. {@link Relayer.FeeOption}
     * @throws {TransactionError} If the transaction fails to send or confirm.
     * @throws {InitializationError} If the client or relevant chain is not initialized.
     *
     * @returns A promise that resolves with the transaction hash.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/send-transaction} for more detailed documentation.
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
    sendTransaction(chainId: number, transactions: Transaction[], feeOption?: Relayer.FeeOption): Promise<Hex.Hex>;
    /**
     * Signs a standard message (EIP-191) using an available session signer.
     * @param chainId The chain ID on which to sign the message.
     * @param message The message to sign.
     * @throws If the message cannot be signed. {@link SigningError}
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the signing process is initiated. The signature is delivered via the `signatureResponse` event listener.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/sign-message} for more detailed documentation.
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
     * @throws If the client or relevant chain is not initialized. {@link InitializationError}
     *
     * @returns A promise that resolves when the signing process is initiated. The signature is returned in the `signatureResponse` event listener.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/sign-typed-data} for more detailed documentation.
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
     * Disconnects the client, clearing all session data from browser storage.
     * @remarks This action does not revoke the sessions on-chain. Sessions remain active until they expire or are manually revoked by the user in their wallet.
     * @returns A promise that resolves when disconnection is complete.
     *
     * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/disconnect} for more detailed documentation.
     *
     * @example
     * const dappClient = new DappClient('http://localhost:5173');
     * await dappClient.initialize();
     *
     * if (dappClient.isInitialized) {
     *   await dappClient.disconnect();
     * }
     */
    disconnect(): Promise<void>;
    /**
     * @private Emits an event to all registered listeners.
     * @param event The event to emit.
     * @param args The data to emit with the event.
     */
    private emit;
    /**
     * @private Retrieves or creates a ChainSessionManager for a given chain ID.
     * @param chainId The chain ID to get the ChainSessionManager for.
     * @returns The ChainSessionManager for the given chain ID. {@link ChainSessionManager}
     */
    private getChainSessionManager;
}
export {};
//# sourceMappingURL=DappClient.d.ts.map