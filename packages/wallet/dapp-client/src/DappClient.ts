/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChainId } from '@0xsequence/network'
import { ChainSessionManager } from './ChainSessionManager.js'
import {
  ChainSessionManagerEvent,
  Transaction,
  Session,
  TransportMode,
  DappClientEventListener,
} from './types/index.js'
import { DappTransport } from './DappTransport.js'
import {
  clearExplicitSessions,
  clearImplicitSession,
  getAndClearTempSessionPk,
  getExplicitSessions,
  getImplicitSession,
  isRedirectRequestPending,
  setPendingRedirectRequest,
  peekSignatureRequestContext,
  peekPendingRequestPayload,
} from './utils/storage.js'
import { Relayer, Signers } from '@0xsequence/wallet-core'
import { Address } from 'ox'
import { InitializationError } from './utils/errors.js'
import { DEFAULT_KEYMACHINE_URL } from './utils/constants.js'

/**
 * The main entry point for interacting with the Wallet.
 * This client manages user sessions across multiple chains, handles connection
 * and disconnection, and provides methods for signing and sending transactions.
 *
 * @param transportMode The communication mode to use with the wallet. {@link TransportMode}
 * @param walletUrl The URL of the Wallet Webapp.
 * @param keymachineUrl (Optional) The URL of the key management service. {@link DEFAULT_KEYMACHINE_URL}
 *
 * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-client} for more detailed documentation.
 *
 * @example
 * // It is recommended to manage a singleton instance of this client.
 * const dappClient = new DappClient('popup', 'https://my-wallet-url.com');
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

  private chainSessionManagers: Map<ChainId, ChainSessionManager> = new Map()
  private transport: DappTransport
  private keymachineUrl: string
  private walletUrl: string

  private isInitializing = false

  private walletAddress: Address.Address | null = null
  private eventListeners: Map<ChainSessionManagerEvent, Set<DappClientEventListener>> = new Map()

  /**
   * @param transportMode The communication mode to use with the wallet. {@link TransportMode}
   * @param walletUrl The URL of the Wallet Webapp.
   * @param keymachineUrl (Optional) The URL of the key management service. {@link DEFAULT_KEYMACHINE_URL}
   */
  constructor(transportMode: TransportMode, walletUrl: string, keymachineUrl: string = DEFAULT_KEYMACHINE_URL) {
    this.transport = new DappTransport(walletUrl, transportMode)
    this.keymachineUrl = keymachineUrl
    this.walletUrl = walletUrl
  }

  /**
   * @returns The transport mode of the client. {@link TransportMode}
   */
  public get transportMode(): TransportMode {
    return this.transport.mode
  }

  /**
   * @param event The event to listen for. {@link ChainSessionManagerEvent}
   * @param listener The listener to call when the event occurs. {@link DappClientEventListener}
   * @returns A function to remove the listener.
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/on} for more detailed documentation.
   *
   * @example
   * useEffect(() => {
   *   const handleSessionUpdate = () => {
   *     setSession({
   *       isInitialized: dappClient.isInitialized,
   *       walletAddress: dappClient.getWalletAddress(),
   *       signerAddresses: dappClient.getAllSessionSigners(),
   *       loginMethod: dappClient.loginMethod,
   *       userEmail: dappClient.userEmail,
   *     });
   *   };
   *   const eventName = "sessionsUpdated" as ChainSessionManagerEvent;
   *   const unsubscribe = dappClient.on(eventName, handleSessionUpdate);
   *
   *   // Perform an initial sync
   *   handleSessionUpdate();
   *
   *   return () => {
   *     unsubscribe();
   *   };
   * }, [dappClient]);
   */
  public on(event: ChainSessionManagerEvent, listener: DappClientEventListener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
    return () => {
      this.eventListeners.get(event)?.delete(listener)
    }
  }

  /**
   * @returns The wallet address of the current session. {@link Address.Address}
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/get-wallet-address} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://my-wallet-url.com');
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
   * @returns An array of all the active sessions. {@link { address: Address.Address, isImplicit: boolean }[]}
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/get-all-sessions} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://my-wallet-url.com');
   * await dappClient.initialize();
   *
   * if (dappClient.isInitialized) {
   *   const sessions = dappClient.getAllSessions();
   *   console.log('Sessions:', sessions);
   * }
   */
  public getAllSessions(): Session[] {
    const allSessions = new Map<string, Session>()
    for (const chainSessionManager of this.chainSessionManagers.values()) {
      chainSessionManager.getSessions().forEach((session) => {
        const uniqueKey = `${session.address.toLowerCase()}-${session.isImplicit}`
        if (!allSessions.has(uniqueKey)) {
          allSessions.set(uniqueKey, session)
        }
      })
    }
    return Array.from(allSessions.values())
  }

  /**
   * Initializes the client by loading any existing `Implicit` or `Explicit` session from storage.
   * This should be called once when your application loads.
   *
   * @remarks
   * An `Implicit` session is a session that can interact only with the Dapp contracts, it is a special Session that needs to be integrated by the Dapp.
   * @remarks
   * An `explicit session` is a session that can interact with any contract as long as the user has granted the necessary permissions.
   *
   * @throws If the initialization process fails. {@link InitializationError}
   *
   * @returns An empty promise
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/initialize} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://my-wallet-url.com');
   * await dappClient.initialize();
   */
  async initialize(): Promise<void> {
    if (this.isInitializing) return
    this.isInitializing = true

    try {
      if (isRedirectRequestPending()) {
        await this.handleRedirectResponse()
        setPendingRedirectRequest(false)
      }

      const implicitSession = await getImplicitSession()
      if (!implicitSession) {
        this.isInitialized = false
        this.isInitializing = false
        this.emit('sessionsUpdated')
        return
      }

      this.walletAddress = implicitSession.walletAddress
      this.loginMethod = implicitSession.loginMethod ?? null
      this.userEmail = implicitSession.userEmail ?? null

      const explicitSessions = await getExplicitSessions()
      const chainIdsToInitialize = new Set<ChainId>([
        implicitSession.chainId,
        ...explicitSessions.filter((s) => Address.isEqual(s.walletAddress, this.walletAddress!)).map((s) => s.chainId),
      ])

      const initPromises = Array.from(chainIdsToInitialize).map((chainId) =>
        this.getChainSessionManager(chainId).initialize(),
      )

      await Promise.all(initPromises)

      this.isInitialized = true
      this.emit('sessionsUpdated')
    } catch (e) {
      await this.disconnect()
      throw e
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Creates and initializes a new session for the given chain.
   * @param chainId The primary chain ID for the new session. {@link ChainId}
   * @param implicitSessionRedirectUrl The URL to redirect back to after login.
   * @param permissions (Optional) The permissions to request for the new session. {@link Signers.Session.ExplicitParams}
   * @param options (Optional) The options for the new session. {@link Signers.Session.ExplicitParams}
   * @throws If the connection process fails. {@link ConnectionError}
   * @throws If a session already exists. {@link InitializationError}
   *
   * @returns An empty promise.
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/connect} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://my-wallet-url.com');
   * await dappClient.connect(137, window.location.origin, {
   *   preferredLoginMethod: 'google',
   * });
   */
  async connect(
    chainId: ChainId,
    implicitSessionRedirectUrl: string,
    permissions?: Signers.Session.ExplicitParams,
    options: {
      preferredLoginMethod?: 'google' | 'apple' | 'email' | 'passkey' | 'mnemonic'
      email?: string
    } = {},
  ): Promise<void> {
    if (this.isInitialized) {
      throw new InitializationError('A session already exists. Disconnect first.')
    }

    try {
      const chainSessionManager = this.getChainSessionManager(chainId)
      await chainSessionManager.createNewSession(implicitSessionRedirectUrl, permissions, options)
      await this.initialize()
    } catch (err) {
      await this.disconnect()
      throw err
    }
  }

  /**
   * Creates and initializes an explicit session for a given chain.
   * @remarks
   * An `explicit session` is a session that can interact with any contract as long as the user has granted the necessary permissions.
   * @param chainId The chain ID on which to add the explicit session. {@link ChainId}
   * @param permissions The permissions to request for the new session. {@link Signers.Session.ExplicitParams}
   *
   * @throws If the session cannot be added. {@link AddExplicitSessionError}
   * @throws If the client or relevant chain is not initialized. {@link InitializationError}
   *
   * @returns An empty promise.
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/add-explicit-session} for more detailed documentation.
   *
   * @example
   * ...
   * import { Signers, Utils } from "@0xsequence/wallet-core";
   * import { DappClient } from "@0xsequence/sessions";
   * ...
   *
   * const dappClient = new DappClient('popup', 'https://my-wallet-url.com');
   * await dappClient.initialize();
   *
   * const amount = 1000000;
   * const USDC_ADDRESS = '0x...';
   *
   * if (dappClient.isInitialized) {
   *   // Allow Dapp (Session Signer) to transfer "amount" of USDC
   *   const permissions: Signers.Session.ExplicitParams = {
   *    chainId: BigInt(chainId),
   *    valueLimit: 0n, // Not allowed to transfer native tokens (ETH, etc)
   *    deadline: BigInt(Date.now() + 1000 * 60 * 5000), // 5000 minutes from now
   *    permissions: [Utils.ERC20PermissionBuilder.buildTransfer(USDC_ADDRESS, amount)]
   *   };
   *   await dappClient.addExplicitSession(1, permissions);
   * }
   */
  async addExplicitSession(chainId: ChainId, permissions: Signers.Session.ExplicitParams): Promise<void> {
    if (!this.isInitialized || !this.walletAddress)
      throw new InitializationError('Cannot add an explicit session without an existing wallet.')

    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized) {
      chainSessionManager.initializeWithWallet(this.walletAddress)
    }
    await chainSessionManager.addExplicitSession(permissions)
    await this.initialize()
  }

  /**
   * Gets the gas fee options for an array of transactions.
   * @param chainId The chain ID on which to get the fee options. {@link ChainId}
   * @param transactions An array of transactions to get the fee options for. {@link Transaction}
   * @throws If the fee options cannot be fetched. {@link FeeOptionError}
   * @throws If the client or relevant chain is not initialized. {@link InitializationError}
   *
   * @returns A promise that resolves with the fee options. {@link Relayer.FeeOption[]}
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/get-fee-options} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://v3.sequence-dev.app');
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
  async getFeeOptions(chainId: ChainId, transactions: Transaction[]): Promise<Relayer.FeeOption[]> {
    if (!this.isInitialized) throw new InitializationError('Not initialized')
    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized)
      throw new InitializationError(`ChainSessionManager for chain ${chainId} is not initialized.`)
    return await chainSessionManager.getFeeOptions(transactions)
  }

  /**
   * Sends a transaction using the session signer.
   * @param chainId The chain ID on which to send the transaction. {@link ChainId}
   * @param transactions An array of transactions to be executed atomically. {@link Transaction}
   * @param feeOption (Optional) The selected fee option to sponsor the transaction. {@link Relayer.FeeOption}
   * @throws {TransactionError} If the transaction fails to send or confirm. {@link TransactionError}
   * @throws {InitializationError} If the client or relevant chain is not initialized. {@link InitializationError}
   *
   * @returns A promise that resolves with the transaction hash. {@link Promise<string>}
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/send-transaction} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://v3.sequence-dev.app');
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
  async sendTransaction(chainId: ChainId, transactions: Transaction[], feeOption?: Relayer.FeeOption): Promise<string> {
    if (!this.isInitialized) throw new InitializationError('Not initialized')
    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized)
      throw new InitializationError(`ChainSessionManager for chain ${chainId} is not initialized.`)
    return await chainSessionManager.buildSignAndSendTransactions(transactions, feeOption)
  }

  /**
   * Signs a message using the session signer.
   * @param chainId The chain ID on which to sign the message. {@link ChainId}
   * @param message The message to sign. {@link string}
   * @throws If the message cannot be signed. {@link SigningError}
   * @throws If the client or relevant chain is not initialized. {@link InitializationError}
   *
   * @returns An empty promise. (The signature is returned in the `signatureResponse` event listener.) {@link Promise<void>}
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/sign-message} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://v3.sequence-dev.app');
   * await dappClient.initialize();
   *
   * if (dappClient.isInitialized) {
   *   const message = 'Hello, world!';
   *   await dappClient.signMessage(1, message  );
   * }
   */
  async signMessage(chainId: ChainId, message: string): Promise<void> {
    if (!this.isInitialized) throw new InitializationError('Not initialized')
    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized)
      throw new InitializationError(`ChainSessionManager for chain ${chainId} is not initialized.`)
    return await chainSessionManager.signMessage(message)
  }

  /**
   * Signs a typed data object using the session signer.
   * @param chainId The chain ID on which to sign the typed data. {@link ChainId}
   * @param typedData The typed data object to sign. {@link unknown}
   * @throws If the typed data cannot be signed. {@link SigningError}
   * @throws If the client or relevant chain is not initialized. {@link InitializationError}
   *
   * @returns An empty promise. (The signature is returned in the `signatureResponse` event listener.) {@link Promise<void>}
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/sign-typed-data} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://v3.sequence-dev.app');
   * await dappClient.initialize();
   *
   * if (dappClient.isInitialized) {
   *   const typedData = {...}
   *   await dappClient.signTypedData(1, typedData);
   * }
   */
  async signTypedData(chainId: ChainId, typedData: unknown): Promise<void> {
    if (!this.isInitialized) throw new InitializationError('Not initialized')
    const chainSessionManager = this.getChainSessionManager(chainId)
    if (!chainSessionManager.isInitialized)
      throw new InitializationError(`ChainSessionManager for chain ${chainId} is not initialized.`)
    return await chainSessionManager.signTypedData(typedData)
  }

  /**
   * Disconnects the session client from the wallet, clearing all session from browser storage but not revoking them.
   * Sessions will still be active untill the user revokes them from the Wallet.
   * @returns An empty promise.
   *
   * @see {@link https://docs.sequence.xyz/sdk/typescript/v3/dapp-clientt/disconnect} for more detailed documentation.
   *
   * @example
   * const dappClient = new DappClient('popup', 'https://v3.sequence-dev.app');
   * await dappClient.initialize();
   *
   * if (dappClient.isInitialized) {
   *   await dappClient.disconnect();
   * }
   */
  async disconnect(): Promise<void> {
    const transportMode = this.transport.mode

    this.transport.destroy()
    this.transport = new DappTransport(this.walletUrl, transportMode)

    this.chainSessionManagers.clear()
    await clearImplicitSession()
    await clearExplicitSessions()
    this.isInitialized = false
    this.walletAddress = null
    this.loginMethod = null
    this.userEmail = null
    this.emit('sessionsUpdated')
  }

  /**
   * Handles the redirect response from the Wallet.
   * @returns An empty promise.
   */
  private async handleRedirectResponse() {
    const response = this.transport.getRedirectResponse(false)
    if (!response) return

    let chainId: ChainId | undefined
    const signatureContext = peekSignatureRequestContext()
    if (signatureContext) {
      chainId = (signatureContext.payload as any).chainId
    } else {
      const connectContext = peekPendingRequestPayload()
      if (connectContext) chainId = connectContext.chainId
    }

    if (chainId) {
      const chainSessionManager = this.getChainSessionManager(chainId)
      await chainSessionManager.initialize()
    } else {
      this.transport.getRedirectResponse(true)
      getAndClearTempSessionPk()
      throw new InitializationError('Chain id is missing from the redirect response signature context payload')
    }
  }

  /**
   * @param event The event to emit. {@link ChainSessionEvent}
   * @param data The data to emit. {@link any}
   */
  private emit(event: ChainSessionManagerEvent, data?: any): void {
    this.eventListeners.get(event)?.forEach((listener) => listener(data))
  }

  /**
   * @param chainId The chain ID to get the ChainSessionManager for. {@link ChainId}
   * @returns The ChainSessionManager for the given chain ID. {@link ChainSessionManager}
   */
  private getChainSessionManager(chainId: ChainId): ChainSessionManager {
    let chainSessionManager = this.chainSessionManagers.get(chainId)
    if (!chainSessionManager) {
      chainSessionManager = new ChainSessionManager(chainId, this.keymachineUrl, this.transport)
      this.chainSessionManagers.set(chainId, chainSessionManager)

      chainSessionManager.on('signatureResponse', (data) => {
        this.emit('signatureResponse', { ...data, chainId })
      })
    }
    return chainSessionManager
  }
}
