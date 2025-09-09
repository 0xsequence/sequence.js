/* eslint-disable @typescript-eslint/no-explicit-any */
import { Relayer, Signers } from '@0xsequence/wallet-core'
import { Address, Hex } from 'ox'

import { ChainSessionManager } from './ChainSessionManager.js'
import { DappTransport } from './DappTransport.js'
import { InitializationError, SigningError, TransactionError } from './utils/errors.js'
import { SequenceStorage, WebStorage } from './utils/storage.js'
import {
  DappClientExplicitSessionEventListener,
  DappClientWalletActionEventListener,
  GuardConfig,
  LoginMethod,
  RandomPrivateKeyFn,
  RequestActionType,
  SendWalletTransactionPayload,
  SequenceSessionStorage,
  Session,
  SignMessagePayload,
  SignTypedDataPayload,
  Transaction,
  TransactionRequest,
  TransportMode,
  WalletActionResponse,
} from './types/index.js'
import { TypedData } from 'ox/TypedData'
import { KEYMACHINE_URL, NODES_URL, RELAYER_URL } from './utils/constants.js'

export type DappClientEventListener = (data?: any) => void

interface DappClientEventMap {
  sessionsUpdated: () => void
  walletActionResponse: DappClientWalletActionEventListener
  explicitSessionResponse: DappClientExplicitSessionEventListener
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
export class DappClient {
  public isInitialized = false

  public loginMethod: string | null = null
  public userEmail: string | null = null
  public guard?: GuardConfig

  public readonly origin: string

  private chainSessionManagers: Map<number, ChainSessionManager> = new Map()

  private walletUrl: string
  private transport: DappTransport
  private projectAccessKey: string
  private nodesUrl: string
  private relayerUrl: string
  private keymachineUrl: string
  private sequenceStorage: SequenceStorage
  private redirectPath?: string
  private sequenceSessionStorage?: SequenceSessionStorage
  private randomPrivateKeyFn?: RandomPrivateKeyFn
  private redirectActionHandler?: (url: string) => void
  private canUseIndexedDb: boolean

  private isInitializing = false

  private walletAddress: Address.Address | null = null
  private eventListeners: {
    [K in keyof DappClientEventMap]?: Set<DappClientEventMap[K]>
  } = {}

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
  constructor(
    walletUrl: string,
    origin: string,
    projectAccessKey: string,
    options?: {
      transportMode?: TransportMode
      redirectPath?: string
      keymachineUrl?: string
      nodesUrl?: string
      relayerUrl?: string
      sequenceStorage?: SequenceStorage
      sequenceSessionStorage?: SequenceSessionStorage
      randomPrivateKeyFn?: RandomPrivateKeyFn
      redirectActionHandler?: (url: string) => void
      canUseIndexedDb?: boolean
    },
  ) {
    const {
      transportMode = TransportMode.POPUP,
      keymachineUrl = KEYMACHINE_URL,
      redirectPath,
      sequenceStorage = new WebStorage(),
      sequenceSessionStorage,
      randomPrivateKeyFn,
      redirectActionHandler,
      canUseIndexedDb = true,
    } = options || {}

    this.transport = new DappTransport(
      walletUrl,
      transportMode,
      undefined,
      sequenceSessionStorage,
      redirectActionHandler,
    )
    this.walletUrl = walletUrl
    this.projectAccessKey = projectAccessKey
    this.nodesUrl = options?.nodesUrl || NODES_URL
    this.relayerUrl = options?.relayerUrl || RELAYER_URL
    this.origin = origin
    this.keymachineUrl = keymachineUrl
    this.sequenceStorage = sequenceStorage
    this.redirectPath = redirectPath
    this.sequenceSessionStorage = sequenceSessionStorage
    this.randomPrivateKeyFn = randomPrivateKeyFn
    this.redirectActionHandler = redirectActionHandler
    this.canUseIndexedDb = canUseIndexedDb
  }

  /**
   * @returns The transport mode of the client. {@link TransportMode}
   */
  public get transportMode(): TransportMode {
    return this.transport.mode
  }

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
   *   const handleWalletAction = (response) => {
   *     console.log('Received wallet action response:', response);
   *   };
   *
   *   const unsubscribe = dappClient.on("walletActionResponse", handleWalletAction);
   *
   *   return () => unsubscribe();
   * }, [dappClient]);
   */
  public on<K extends keyof DappClientEventMap>(event: K, listener: DappClientEventMap[K]): () => void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = new Set() as any
    }
    ;(this.eventListeners[event] as any).add(listener)
    return () => {
      ;(this.eventListeners[event] as any)?.delete(listener)
    }
  }

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
  public getWalletAddress(): Address.Address | null {
    return this.walletAddress
  }

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
  public getAllSessions(): Session[] {
    const allSessions = new Map<string, Session>()
    Array.from(this.chainSessionManagers.values()).forEach((chainSessionManager) => {
      chainSessionManager.getSessions().forEach((session) => {
        const uniqueKey = `${session.address.toLowerCase()}-${session.isImplicit}`
        if (!allSessions.has(uniqueKey)) {
          allSessions.set(uniqueKey, session)
        }
      })
    })
    return Array.from(allSessions.values())
  }

  /**
   * @private Loads the client's state from storage, initializing all chain managers
   * for previously established sessions.
   */
  private async _loadStateFromStorage(): Promise<void> {
    const implicitSession = await this.sequenceStorage.getImplicitSession()

    const explicitSessions = await this.sequenceStorage.getExplicitSessions()
    const chainIdsToInitialize = new Set([
      ...(implicitSession?.chainId !== undefined ? [implicitSession.chainId] : []),
      ...explicitSessions.map((s) => s.chainId),
    ])

    if (chainIdsToInitialize.size === 0) {
      this.isInitialized = false
      this.emit('sessionsUpdated')
      return
    }

    const initPromises = Array.from(chainIdsToInitialize).map((chainId) =>
      this.getChainSessionManager(chainId).initialize(),
    )

    const result = await Promise.all(initPromises)

    this.walletAddress = implicitSession?.walletAddress || explicitSessions[0]?.walletAddress || null
    this.loginMethod = result[0]?.loginMethod || null
    this.userEmail = result[0]?.userEmail || null
    this.guard = implicitSession?.guard || explicitSessions.find((s) => !!s.guard)?.guard

    this.isInitialized = true
    this.emit('sessionsUpdated')
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
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client/initialize} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('http://localhost:5173');
   * await dappClient.initialize();
   */
  async initialize(): Promise<void> {
    if (this.isInitializing) return
    this.isInitializing = true

    try {
      // First, load any existing session from storage. This is crucial so that
      // when we process a redirect for an explicit session, we know the wallet address.
      await this._loadStateFromStorage()

      // Now, check if there's a response from a redirect flow.
      if (await this.sequenceStorage.isRedirectRequestPending()) {
        try {
          // Attempt to handle any response from the wallet redirect.
          await this.handleRedirectResponse()
        } finally {
          // We have to clear pending redirect data here as well in case we received an error from the wallet.
          await this.sequenceStorage.setPendingRedirectRequest(false)
          await this.sequenceStorage.getAndClearTempSessionPk()
        }

        // After handling the redirect, the session state will have changed,
        // so we must load it again.
        await this._loadStateFromStorage()
      }
    } catch (e) {
      await this.disconnect()
      throw e
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Handles the redirect response from the Wallet.
   * This is called automatically on `initialize()` for web environments but can be called manually
   * with a URL in environments like React Native.
   * @param url The full redirect URL from the wallet. If not provided, it will be read from the browser's current location.
   * @returns A promise that resolves when the redirect has been handled.
   */
  public async handleRedirectResponse(url?: string): Promise<void> {
    const pendingRequest = await this.sequenceStorage.peekPendingRequest()

    const response = await this.transport.getRedirectResponse(true, url)
    if (!response) {
      return
    }

    const { action } = response
    const chainId = pendingRequest?.chainId

    if (
      action === RequestActionType.SIGN_MESSAGE ||
      action === RequestActionType.SIGN_TYPED_DATA ||
      action === RequestActionType.SEND_WALLET_TRANSACTION
    ) {
      if (chainId === undefined) {
        throw new InitializationError('Could not find a chainId for the pending signature request.')
      }
      const eventPayload = {
        action,
        response: 'payload' in response ? response.payload : undefined,
        error: 'error' in response ? response.error : undefined,
        chainId,
      }
      this.emit('walletActionResponse', eventPayload)
    } else if (chainId !== undefined) {
      const chainSessionManager = this.getChainSessionManager(chainId)
      await chainSessionManager.handleRedirectResponse(response)
    } else {
      throw new InitializationError(`Could not find a pending request context for the redirect action: ${action}`)
    }
  }

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
  async connect(
    chainId: number,
    permissions?: Signers.Session.ExplicitParams,
    options: {
      preferredLoginMethod?: LoginMethod
      email?: string
      includeImplicitSession?: boolean
    } = {},
  ): Promise<void> {
    if (this.isInitialized) {
      throw new InitializationError('A session already exists. Disconnect first.')
    }

    try {
      const chainSessionManager = this.getChainSessionManager(chainId)
      await chainSessionManager.createNewSession(this.origin, permissions, options)

      // For popup mode, we need to manually update the state and emit an event.
      // For redirect mode, this code won't be reached; the page will navigate away.
      if (this.transport.mode === TransportMode.POPUP) {
        await this._loadStateFromStorage()
      }
    } catch (err) {
      await this.disconnect()
      throw err
    }
  }

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
  async addExplicitSession(chainId: number, permissions: Signers.Session.ExplicitParams): Promise<void> {
    if (!this.isInitialized || !this.walletAddress)
      throw new InitializationError('Cannot add an explicit session without an existing wallet.')

    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized) {
      chainSessionManager.initializeWithWallet(this.walletAddress)
    }
    await chainSessionManager.addExplicitSession(permissions)

    if (this.transport.mode === TransportMode.POPUP) {
      await this._loadStateFromStorage()
    }
  }

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
  async modifyExplicitSession(
    chainId: number,
    sessionAddress: Address.Address,
    permissions: Signers.Session.ExplicitParams,
  ): Promise<void> {
    if (!this.isInitialized || !this.walletAddress)
      throw new InitializationError('Cannot modify an explicit session without an existing wallet.')

    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized) {
      chainSessionManager.initializeWithWallet(this.walletAddress)
    }
    await chainSessionManager.modifyExplicitSession(sessionAddress, permissions)

    if (this.transport.mode === TransportMode.POPUP) {
      await this._loadStateFromStorage()
    }
  }

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
  async getFeeOptions(chainId: number, transactions: Transaction[]): Promise<Relayer.FeeOption[]> {
    if (!this.isInitialized) throw new InitializationError('Not initialized')
    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized)
      throw new InitializationError(`ChainSessionManager for chain ${chainId} is not initialized.`)
    return await chainSessionManager.getFeeOptions(transactions)
  }

  /**
   * Checks if the current session has permission to execute a set of transactions on a specific chain.
   * @param chainId The chain ID on which to check the permissions.
   * @param transactions An array of transactions to check permissions for.
   * @returns A promise that resolves to true if the session has permission, otherwise false.
   */
  async hasPermission(chainId: number, transactions: Transaction[]): Promise<boolean> {
    const chainSessionManager = this.chainSessionManagers.get(chainId)
    if (!chainSessionManager || !chainSessionManager.isInitialized) {
      return false
    }
    return await chainSessionManager.hasPermission(transactions)
  }

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
  async sendTransaction(chainId: number, transactions: Transaction[], feeOption?: Relayer.FeeOption): Promise<Hex.Hex> {
    if (!this.isInitialized) throw new InitializationError('Not initialized')
    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized)
      throw new InitializationError(`ChainSessionManager for chain ${chainId} is not initialized.`)
    return await chainSessionManager.buildSignAndSendTransactions(transactions, feeOption)
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
  async signMessage(chainId: number, message: string): Promise<void> {
    if (!this.isInitialized || !this.walletAddress) throw new InitializationError('Not initialized')
    const payload: SignMessagePayload = {
      address: this.walletAddress,
      message,
      chainId: chainId,
    }
    try {
      await this._requestWalletAction(RequestActionType.SIGN_MESSAGE, payload, chainId)
    } catch (err) {
      throw new SigningError(`Signing message failed: ${err instanceof Error ? err.message : String(err)}`)
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
  async signTypedData(chainId: number, typedData: TypedData): Promise<void> {
    if (!this.isInitialized || !this.walletAddress) throw new InitializationError('Not initialized')
    const payload: SignTypedDataPayload = {
      address: this.walletAddress,
      typedData,
      chainId: chainId,
    }
    try {
      await this._requestWalletAction(RequestActionType.SIGN_TYPED_DATA, payload, chainId)
    } catch (err) {
      throw new SigningError(`Signing typed data failed: ${err instanceof Error ? err.message : String(err)}`)
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
  async sendWalletTransaction(chainId: number, transactionRequest: TransactionRequest): Promise<void> {
    if (!this.isInitialized || !this.walletAddress) throw new InitializationError('Not initialized')
    const payload: SendWalletTransactionPayload = {
      address: this.walletAddress,
      transactionRequest,
      chainId: chainId,
    }
    try {
      await this._requestWalletAction(RequestActionType.SEND_WALLET_TRANSACTION, payload, chainId)
    } catch (err) {
      throw new TransactionError(
        `Sending transaction data to wallet failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

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
  async disconnect(): Promise<void> {
    const transportMode = this.transport.mode

    this.transport.destroy()
    this.transport = new DappTransport(
      this.walletUrl,
      transportMode,
      undefined,
      this.sequenceSessionStorage,
      this.redirectActionHandler,
    )

    this.chainSessionManagers.clear()
    await this.sequenceStorage.clearAllData()
    this.isInitialized = false
    this.walletAddress = null
    this.loginMethod = null
    this.userEmail = null
    this.emit('sessionsUpdated')
  }

  /**
   * @private Emits an event to all registered listeners.
   * @param event The event to emit.
   * @param args The data to emit with the event.
   */
  private emit<K extends keyof DappClientEventMap>(event: K, ...args: Parameters<DappClientEventMap[K]>): void {
    const listeners = this.eventListeners[event]
    if (listeners) {
      listeners.forEach((listener) => (listener as (...a: typeof args) => void)(...args))
    }
  }

  private async _requestWalletAction(
    action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA' | 'SEND_WALLET_TRANSACTION'],
    payload: SignMessagePayload | SignTypedDataPayload | SendWalletTransactionPayload,
    chainId: number,
  ): Promise<void> {
    if (!this.isInitialized || !this.walletAddress) {
      throw new InitializationError('Session not initialized. Cannot request wallet action.')
    }

    try {
      const redirectUrl = this.origin + (this.redirectPath ? this.redirectPath : '')
      const path = action === RequestActionType.SEND_WALLET_TRANSACTION ? '/request/transaction' : '/request/sign'

      if (this.transport.mode === TransportMode.REDIRECT) {
        await this.sequenceStorage.savePendingRequest({
          action,
          payload,
          chainId: chainId,
        })
        await this.sequenceStorage.setPendingRedirectRequest(true)
        await this.transport.sendRequest(action, redirectUrl, payload, { path })
      } else {
        const response = await this.transport.sendRequest<WalletActionResponse>(action, redirectUrl, payload, {
          path,
        })
        this.emit('walletActionResponse', { action, response, chainId })
      }
    } catch (err) {
      const error = new SigningError(err instanceof Error ? err.message : String(err))
      this.emit('walletActionResponse', { action, error, chainId })
      throw error
    } finally {
      if (this.transport.mode === TransportMode.POPUP) {
        this.transport.closeWallet()
      }
    }
  }

  /**
   * @private Retrieves or creates a ChainSessionManager for a given chain ID.
   * @param chainId The chain ID to get the ChainSessionManager for.
   * @returns The ChainSessionManager for the given chain ID. {@link ChainSessionManager}
   */
  private getChainSessionManager(chainId: number): ChainSessionManager {
    let chainSessionManager = this.chainSessionManagers.get(chainId)
    if (!chainSessionManager) {
      chainSessionManager = new ChainSessionManager(
        chainId,
        this.transport,
        this.projectAccessKey,
        this.keymachineUrl,
        this.nodesUrl,
        this.relayerUrl,
        this.sequenceStorage,
        this.origin + (this.redirectPath ? this.redirectPath : ''),
        this.guard,
        this.randomPrivateKeyFn,
        this.canUseIndexedDb,
      )
      this.chainSessionManagers.set(chainId, chainSessionManager)

      chainSessionManager.on('explicitSessionResponse', (data) => {
        this.emit('explicitSessionResponse', { ...data, chainId })
      })
    }
    return chainSessionManager
  }
}
