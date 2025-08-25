import { Envelope, Relayer, Signers, State, Wallet } from '@0xsequence/wallet-core'
import { Attestation, Constants, Extensions, Network, Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import * as Guard from '@0xsequence/guard'
import { AbiFunction, Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'

import { DappTransport } from './DappTransport.js'

import {
  AddExplicitSessionError,
  FeeOptionError,
  InitializationError,
  ModifyExplicitSessionError,
  SessionConfigError,
  SigningError,
  TransactionError,
  WalletRedirectError,
} from './utils/errors.js'
import { SequenceStorage } from './utils/storage.js'
import { getRelayerUrl, getRpcUrl } from './utils/index.js'

import {
  AddExplicitSessionPayload,
  CreateNewSessionPayload,
  ConnectSuccessResponsePayload,
  ExplicitSessionEventListener,
  ModifySessionPayload,
  ModifySessionSuccessResponsePayload,
  LoginMethod,
  RandomPrivateKeyFn,
  RequestActionType,
  Session,
  SignatureEventListener,
  SignatureResponse,
  SignMessagePayload,
  SignTypedDataPayload,
  Transaction,
  TransportMode,
  GuardConfig,
} from './types/index.js'
import { CACHE_DB_NAME, VALUE_FORWARDER_ADDRESS } from './utils/constants.js'
import { TypedData } from 'ox/TypedData'

interface ChainSessionManagerEventMap {
  signatureResponse: SignatureEventListener
  explicitSessionResponse: ExplicitSessionEventListener
}

/**
 * Manages sessions and wallet interactions for a single blockchain.
 * This class is used internally by the DappClient to handle chain-specific logic.
 */
export class ChainSessionManager {
  private readonly instanceId: string

  private stateProvider: State.Provider

  private readonly redirectUrl: string
  private readonly randomPrivateKeyFn: RandomPrivateKeyFn

  private eventListeners: {
    [K in keyof ChainSessionManagerEventMap]?: Set<ChainSessionManagerEventMap[K]>
  } = {}

  private sessions: Session[] = []

  private walletAddress: Address.Address | null = null
  private sessionManager: Signers.SessionManager | null = null
  private wallet: Wallet | null = null
  private provider: Provider.Provider | null = null
  private relayer: Relayer.Standard.Rpc.RpcRelayer
  private readonly chainId: number
  public transport: DappTransport | null = null
  private sequenceStorage: SequenceStorage
  public isInitialized: boolean = false
  private isInitializing: boolean = false
  public loginMethod: LoginMethod | null = null
  public userEmail: string | null = null
  private guard?: GuardConfig

  /**
   * @param chainId The ID of the chain this manager is responsible for.
   * @param keyMachineUrl The URL of the key management service.
   * @param transport The transport mechanism for communicating with the wallet.
   * @param sequenceStorage The storage implementation for persistent session data.
   * @param redirectUrl (Optional) The URL to redirect back to after a redirect-based flow.
   * @param guard (Optional) The guard config to use for the session.
   * @param randomPrivateKeyFn (Optional) A function to generate random private keys.
   * @param canUseIndexedDb (Optional) A flag to enable or disable IndexedDB for caching.
   */
  constructor(
    chainId: number,
    keyMachineUrl: string,
    transport: DappTransport,
    sequenceStorage: SequenceStorage,
    redirectUrl: string,
    guard?: GuardConfig,
    randomPrivateKeyFn?: RandomPrivateKeyFn,
    canUseIndexedDb: boolean = true,
  ) {
    this.instanceId = `manager-${Math.random().toString(36).substring(2, 9)}`
    console.log(`ChainSessionManager instance created: ${this.instanceId} for chain ${chainId}`)

    const rpcUrl = getRpcUrl(chainId)
    this.chainId = chainId

    if (canUseIndexedDb) {
      this.stateProvider = new State.Cached({
        source: new State.Sequence.Provider(keyMachineUrl),
        cache: new State.Local.Provider(new State.Local.IndexedDbStore(CACHE_DB_NAME)),
      })
    } else {
      this.stateProvider = new State.Sequence.Provider(keyMachineUrl)
    }
    this.guard = guard
    this.provider = Provider.from(RpcTransport.fromHttp(rpcUrl))
    this.relayer = new Relayer.Standard.Rpc.RpcRelayer(getRelayerUrl(chainId), Number(this.chainId), getRpcUrl(chainId))

    this.transport = transport
    this.sequenceStorage = sequenceStorage

    this.redirectUrl = redirectUrl
    this.randomPrivateKeyFn = randomPrivateKeyFn ?? Secp256k1.randomPrivateKey
  }

  /**
   * Registers an event listener for a specific event within this chain manager.
   * @param event The event to listen for ChainSessionManagerEvent events.
   * @param listener The function to call when the event occurs.
   * @returns A function to unsubscribe the listener.
   */
  public on<K extends keyof ChainSessionManagerEventMap>(
    event: K,
    listener: ChainSessionManagerEventMap[K],
  ): () => void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = new Set() as any
    }
    ;(this.eventListeners[event] as any).add(listener)
    return () => {
      ;(this.eventListeners[event] as any)?.delete(listener)
    }
  }

  /**
   * @private Emits an event to all registered listeners for this chain manager.
   * @param event The event to emit.
   * @param data The data to pass to the listener.
   */
  private emit<K extends keyof ChainSessionManagerEventMap>(
    event: K,
    data: Parameters<ChainSessionManagerEventMap[K]>[0],
  ): void {
    const listeners = this.eventListeners[event]
    if (listeners) {
      listeners.forEach((listener) => (listener as (d: typeof data) => void)(data))
    }
  }

  /**
   * Initializes the manager by loading sessions from storage for this specific chain.
   * @returns A promise resolving to the login method and email if an implicit session is found, or void.
   * @throws {InitializationError} If initialization fails.
   */
  async initialize(): Promise<{
    loginMethod: string | null
    userEmail: string | null
  } | void> {
    if (this.isInitializing) return
    this.isInitializing = true

    this._resetState()

    try {
      const implicitSession = await this.sequenceStorage.getImplicitSession()
      const explicitSessions = await this.sequenceStorage.getExplicitSessions()
      const walletAddress = implicitSession?.walletAddress || explicitSessions[0]?.walletAddress

      if (walletAddress) {
        this.walletAddress = walletAddress
        this.loginMethod = implicitSession?.loginMethod || explicitSessions[0]?.loginMethod || null
        this.userEmail = implicitSession?.userEmail || explicitSessions[0]?.userEmail || null
        await this._loadSessionFromStorage(walletAddress)
      }
    } catch (err) {
      await this._resetStateAndClearCredentials()
      throw new InitializationError(`Initialization failed: ${err}`)
    } finally {
      this.isInitializing = false
      this.isInitialized = !!this.walletAddress
    }
    return { loginMethod: this.loginMethod, userEmail: this.userEmail }
  }

  /**
   * Initializes the manager with a known wallet address, without loading sessions from storage.
   * This is used when a wallet address is known but the session manager for this chain hasn't been instantiated yet.
   * @param walletAddress The address of the wallet to initialize with.
   */
  public initializeWithWallet(walletAddress: Address.Address) {
    if (this.isInitialized) return

    this.walletAddress = walletAddress
    this.wallet = new Wallet(this.walletAddress, {
      stateProvider: this.stateProvider,
    })
    this.sessionManager = new Signers.SessionManager(this.wallet, {
      sessionManagerAddress: Extensions.Dev1.sessions,
      provider: this.provider!,
    })
    this.isInitialized = true
  }

  /**
   * @private Loads implicit and explicit sessions from storage for the current wallet address.
   * @param walletAddress The walletAddress for all sessions.
   */
  private async _loadSessionFromStorage(walletAddress: Address.Address) {
    this.initializeWithWallet(walletAddress)

    const implicitSession = await this.sequenceStorage.getImplicitSession()

    if (implicitSession && implicitSession.chainId === this.chainId) {
      await this._initializeImplicitSessionInternal(
        implicitSession.pk,
        walletAddress,
        implicitSession.attestation,
        implicitSession.identitySignature,
        false,
        implicitSession.loginMethod,
        implicitSession.userEmail,
      )
    }

    const allExplicitSessions = await this.sequenceStorage.getExplicitSessions()
    const walletExplicitSessions = allExplicitSessions.filter(
      (s) => Address.isEqual(Address.from(s.walletAddress), walletAddress) && s.chainId === this.chainId,
    )

    for (const sessionData of walletExplicitSessions) {
      await this._initializeExplicitSessionInternal(
        sessionData.pk,
        sessionData.loginMethod,
        sessionData.userEmail,
        sessionData.guard,
        true,
      )
    }
  }

  /**
   * Initiates the creation of a new session by sending a request to the wallet.
   * @param permissions (Optional) Permissions for an initial explicit session.
   * @param options (Optional) Additional options like preferred login method.
   * @throws {InitializationError} If a session already exists or the transport fails to initialize.
   */
  async createNewSession(
    origin: string,
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

    const newPk = await this.randomPrivateKeyFn()
    const newSignerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: newPk }))

    try {
      if (!this.transport) throw new InitializationError('Transport failed to initialize.')

      const payload: CreateNewSessionPayload = {
        sessionAddress: newSignerAddress,
        origin,
        permissions,
        includeImplicitSession: options.includeImplicitSession ?? false,
        preferredLoginMethod: options.preferredLoginMethod,
        email: options.preferredLoginMethod === 'email' ? options.email : undefined,
      }

      if (this.transport.mode === TransportMode.REDIRECT) {
        await this.sequenceStorage.saveTempSessionPk(newPk)
        await this.sequenceStorage.savePendingRequest({
          chainId: this.chainId,
          action: RequestActionType.CREATE_NEW_SESSION,
          payload,
        })
        await this.sequenceStorage.setPendingRedirectRequest(true)
      }

      const connectResponse = await this.transport.sendRequest<ConnectSuccessResponsePayload>(
        RequestActionType.CREATE_NEW_SESSION,
        this.redirectUrl,
        payload,
        { path: '/request/connect' },
      )

      const receivedAddress = Address.from(connectResponse.walletAddress)
      const { attestation, signature, userEmail, loginMethod, guard } = connectResponse

      if (attestation && signature) {
        await this._resetStateAndClearCredentials()

        this.initializeWithWallet(receivedAddress)

        await this._initializeImplicitSessionInternal(
          newPk,
          receivedAddress,
          attestation,
          signature,
          true,
          loginMethod,
          userEmail,
          guard,
        )
      }

      if (permissions) {
        this.initializeWithWallet(receivedAddress)
        await this._initializeExplicitSessionInternal(newPk, loginMethod, userEmail, guard, true)
        await this.sequenceStorage.saveExplicitSession({
          pk: newPk,
          walletAddress: receivedAddress,
          chainId: this.chainId,
          guard,
        })
      }

      if (this.transport.mode === TransportMode.POPUP) {
        this.transport.closeWallet()
      }
    } catch (err) {
      this._resetState()
      if (this.transport?.mode === TransportMode.POPUP) this.transport.closeWallet()
      throw new InitializationError(`Session creation failed: ${err}`)
    }
  }

  /**
   * Initiates the addition of a new explicit session by sending a request to the wallet.
   * @param permissions The permissions for the new explicit session.
   * @throws {InitializationError} If the manager is not initialized.
   * @throws {AddExplicitSessionError} If adding the session fails.
   */
  async addExplicitSession(permissions: Signers.Session.ExplicitParams): Promise<void> {
    if (!this.walletAddress) {
      throw new InitializationError(
        'Cannot add an explicit session without a wallet address. Initialize the manager with a wallet address first.',
      )
    }

    const newPk = await this.randomPrivateKeyFn()

    try {
      if (!this.transport) throw new InitializationError('Transport failed to initialize.')

      const newSignerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: newPk }))

      const payload: AddExplicitSessionPayload = {
        sessionAddress: newSignerAddress,
        permissions,
      }

      if (this.transport.mode === TransportMode.REDIRECT) {
        await this.sequenceStorage.saveTempSessionPk(newPk)
        await this.sequenceStorage.savePendingRequest({
          chainId: this.chainId,
          action: RequestActionType.ADD_EXPLICIT_SESSION,
          payload,
        })
        await this.sequenceStorage.setPendingRedirectRequest(true)
      }

      const response = await this.transport.sendRequest<ConnectSuccessResponsePayload>(
        RequestActionType.ADD_EXPLICIT_SESSION,
        this.redirectUrl,
        payload,
        { path: '/request/connect' },
      )

      if (!Address.isEqual(Address.from(response.walletAddress), this.walletAddress)) {
        throw new AddExplicitSessionError('Wallet address mismatch.')
      }

      if (this.transport?.mode === TransportMode.POPUP) {
        this.transport?.closeWallet()
      }

      await this._initializeExplicitSessionInternal(
        newPk,
        response.loginMethod,
        response.userEmail,
        response.guard,
        true,
      )
      await this.sequenceStorage.saveExplicitSession({
        pk: newPk,
        walletAddress: this.walletAddress,
        chainId: this.chainId,
        loginMethod: response.loginMethod,
        userEmail: response.userEmail,
        guard: response.guard,
      })
    } catch (err) {
      if (this.transport?.mode === TransportMode.POPUP) this.transport.closeWallet()
      throw new AddExplicitSessionError(`Adding explicit session failed: ${err}`)
    }
  }

  /**
   * Initiates the modification of an existing explicit session by sending a request to the wallet.
   * @param sessionAddress The address of the explicit session to modify.
   * @param newPermissions The new permissions for the session.
   * @throws {InitializationError} If the manager is not initialized.
   * @throws {ModifyExplicitSessionError} If modifying the session fails.
   */
  async modifyExplicitSession(
    sessionAddress: Address.Address,
    newPermissions: Signers.Session.ExplicitParams,
  ): Promise<void> {
    if (!this.walletAddress) {
      throw new InitializationError(
        'Cannot modify an explicit session without a wallet address. Initialize the manager with a wallet address first.',
      )
    }

    try {
      if (!this.transport) throw new InitializationError('Transport failed to initialize.')

      const session = this.sessions.find((s) => Address.isEqual(s.address, sessionAddress))
      if (!session) {
        throw new ModifyExplicitSessionError('Session not found.')
      }

      const payload: ModifySessionPayload = {
        walletAddress: this.walletAddress,
        sessionAddress: sessionAddress,
        permissions: newPermissions,
      }

      if (this.transport.mode === TransportMode.REDIRECT) {
        await this.sequenceStorage.savePendingRequest({
          chainId: this.chainId,
          action: RequestActionType.MODIFY_EXPLICIT_SESSION,
          payload,
        })
        await this.sequenceStorage.setPendingRedirectRequest(true)
      }

      const response = await this.transport.sendRequest<ModifySessionSuccessResponsePayload>(
        RequestActionType.MODIFY_EXPLICIT_SESSION,
        this.redirectUrl,
        payload,
        { path: '/request/modify' },
      )

      if (
        !Address.isEqual(Address.from(response.walletAddress), this.walletAddress) &&
        !Address.isEqual(Address.from(response.sessionAddress), sessionAddress)
      ) {
        throw new ModifyExplicitSessionError('Wallet or session address mismatch.')
      }

      session.permissions = newPermissions

      if (this.transport?.mode === TransportMode.POPUP) {
        this.transport?.closeWallet()
      }
    } catch (err) {
      if (this.transport?.mode === TransportMode.POPUP) this.transport.closeWallet()
      throw new ModifyExplicitSessionError(`Modifying explicit session failed: ${err}`)
    }
  }

  /**
   * @private Handles the connection-related part of a redirect response, initializing sessions.
   * @param response The response payload from the redirect.
   * @returns A promise resolving to true on success.
   */
  private async _handleRedirectConnectionResponse(response: {
    payload: ConnectSuccessResponsePayload
    action: string
  }): Promise<boolean> {
    const tempPk = await this.sequenceStorage.getAndClearTempSessionPk()
    if (!tempPk) {
      throw new InitializationError('Failed to retrieve temporary session key after redirect.')
    }

    try {
      const connectResponse = response.payload
      const receivedAddress = Address.from(connectResponse.walletAddress)
      const { userEmail, loginMethod, guard } = connectResponse

      if (response.action === RequestActionType.CREATE_NEW_SESSION) {
        const { attestation, signature } = connectResponse

        const savedRequest = await this.sequenceStorage.peekPendingRequest()
        const savedPayload = savedRequest?.payload as CreateNewSessionPayload | undefined
        await this._resetStateAndClearCredentials()

        this.initializeWithWallet(receivedAddress)

        if (attestation && signature) {
          await this._initializeImplicitSessionInternal(
            tempPk,
            receivedAddress,
            attestation,
            signature,
            true,
            loginMethod,
            userEmail,
            guard,
          )
        }

        if (savedRequest && savedPayload && savedPayload.permissions) {
          await this._initializeExplicitSessionInternal(tempPk, loginMethod, userEmail, guard, true)
          await this.sequenceStorage.saveExplicitSession({
            pk: tempPk,
            walletAddress: receivedAddress,
            chainId: this.chainId,
            loginMethod,
            userEmail,
            guard,
          })
        }
      } else if (response.action === RequestActionType.ADD_EXPLICIT_SESSION) {
        if (!this.walletAddress || !Address.isEqual(receivedAddress, this.walletAddress)) {
          throw new InitializationError('Received an explicit session for a wallet that is not active.')
        }

        await this._initializeExplicitSessionInternal(
          tempPk,
          this.loginMethod ?? undefined,
          this.userEmail ?? undefined,
          this.guard ?? undefined,
          true,
        )
        await this.sequenceStorage.saveExplicitSession({
          pk: tempPk,
          walletAddress: receivedAddress,
          chainId: this.chainId,
          loginMethod: this.loginMethod ?? undefined,
          userEmail: this.userEmail ?? undefined,
          guard: this.guard ?? undefined,
        })

        const newSignerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: tempPk }))

        this.emit('explicitSessionResponse', {
          action: RequestActionType.ADD_EXPLICIT_SESSION,
          response: {
            walletAddress: receivedAddress,
            sessionAddress: newSignerAddress,
          },
        })
      }
      this.isInitialized = true
      return true
    } catch (err) {
      throw new InitializationError(`Failed to initialize session from redirect: ${err}`)
    }
  }

  /**
   * Resets the manager state and clears all credentials from storage.
   */
  async disconnect(): Promise<void> {
    await this._resetStateAndClearCredentials()
    if (this.transport) {
      this.transport.destroy()
      this.transport = null
    }
    this.loginMethod = null
    this.userEmail = null
    this.isInitialized = false
  }

  /**
   * @private Initializes an implicit session signer and adds it to the session manager.
   * @param pk The private key of the session.
   * @param address The wallet address.
   * @param attestation The attestation from the wallet.
   * @param identitySignature The identity signature from the wallet.
   * @param saveSession Whether to persist the session in storage.
   * @param loginMethod The login method used.
   * @param userEmail The email associated with the session.
   * @param guard The guard configuration.
   */
  private async _initializeImplicitSessionInternal(
    pk: Hex.Hex,
    address: Address.Address,
    attestation: Attestation.Attestation,
    identitySignature: Hex.Hex,
    saveSession: boolean = false,
    loginMethod?: LoginMethod,
    userEmail?: string,
    guard?: GuardConfig,
  ): Promise<void> {
    if (!this.sessionManager) throw new InitializationError('Manager not instantiated for implicit session.')
    try {
      const implicitSigner = new Signers.Session.Implicit(
        pk,
        attestation,
        identitySignature,
        this.sessionManager.address,
      )
      this.sessionManager = this.sessionManager.withImplicitSigner(implicitSigner)

      this.sessions.push({
        address: implicitSigner.address,
        isImplicit: true,
      })

      this.walletAddress = address
      if (saveSession)
        await this.sequenceStorage.saveImplicitSession({
          pk,
          walletAddress: address,
          attestation,
          identitySignature,
          chainId: this.chainId,
          loginMethod,
          userEmail,
          guard,
        })
      if (loginMethod) this.loginMethod = loginMethod
      if (userEmail) this.userEmail = userEmail
      if (guard) this.guard = guard
    } catch (err) {
      throw new InitializationError(`Implicit session init failed: ${err}`)
    }
  }

  /**
   * @private Initializes an explicit session signer and adds it to the session manager.
   * It retries fetching permissions from the network if allowed.
   * @param pk The private key of the session.
   * @param loginMethod The login method used for the session.
   * @param userEmail The email associated with the session.
   * @param allowRetries Whether to retry fetching permissions on failure.
   */
  private async _initializeExplicitSessionInternal(
    pk: Hex.Hex,
    loginMethod?: LoginMethod,
    userEmail?: string,
    guard?: GuardConfig,
    allowRetries: boolean = false,
  ): Promise<void> {
    if (!this.provider || !this.wallet)
      throw new InitializationError('Manager core components not ready for explicit session.')

    const maxRetries = allowRetries ? 3 : 1
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tempManager = new Signers.SessionManager(this.wallet, {
          sessionManagerAddress: Extensions.Dev1.sessions,
          provider: this.provider,
        })
        const topology = await tempManager.getTopology()

        const signerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pk }))
        const permissions = SessionConfig.getSessionPermissions(topology, signerAddress)

        if (!permissions) {
          throw new InitializationError(`Permissions not found for session key.`)
        }

        if (!this.sessionManager) throw new InitializationError('Main session manager is not initialized.')

        const explicitSigner = new Signers.Session.Explicit(pk, permissions)
        this.sessionManager = this.sessionManager.withExplicitSigner(explicitSigner)

        this.sessions.push({
          address: explicitSigner.address,
          isImplicit: false,
          chainId: this.chainId,
          permissions,
        })

        if (guard && !this.guard) this.guard = guard

        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }
    if (lastError)
      throw new InitializationError(`Explicit session init failed after ${maxRetries} attempts: ${lastError.message}`)
  }

  /**
   * Fetches fee options for a set of transactions.
   * @param calls The transactions to estimate fees for.
   * @returns A promise that resolves with an array of fee options.
   * @throws {FeeOptionError} If fetching fee options fails.
   */
  async getFeeOptions(calls: Transaction[]): Promise<Relayer.FeeOption[]> {
    const callsToSend = calls.map((tx) => ({
      to: tx.to,
      value: tx.value,
      data: tx.data,
      gasLimit: tx.gasLimit ?? BigInt(0),
      delegateCall: tx.delegateCall ?? false,
      onlyFallback: tx.onlyFallback ?? false,
      behaviorOnError: tx.behaviorOnError ?? ('revert' as const),
    }))
    try {
      const signedCall = await this._buildAndSignCalls(callsToSend)
      const feeOptions = await this.relayer.feeOptions(signedCall.to, this.chainId, callsToSend)
      return feeOptions.options
    } catch (err) {
      throw new FeeOptionError(`Failed to get fee options: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Builds, signs, and sends a batch of transactions.
   * @param transactions The transactions to be sent.
   * @param feeOption (Optional) The fee option to use for sponsoring the transaction. If provided, a token transfer call will be prepended.
   * @returns A promise that resolves with the transaction hash.
   * @throws {InitializationError} If the session is not initialized.
   * @throws {TransactionError} If the transaction fails at any stage.
   */
  async buildSignAndSendTransactions(transactions: Transaction[], feeOption?: Relayer.FeeOption): Promise<Hex.Hex> {
    if (!this.wallet || !this.sessionManager || !this.provider || !this.isInitialized)
      throw new InitializationError('Session is not initialized.')
    try {
      const calls: Payload.Call[] = transactions.map((tx) => ({
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gasLimit: tx.gasLimit ?? BigInt(0),
        delegateCall: tx.delegateCall ?? false,
        onlyFallback: tx.onlyFallback ?? false,
        behaviorOnError: tx.behaviorOnError ?? ('revert' as const),
      }))

      const callsToSend = calls
      if (feeOption) {
        if (feeOption.token.contractAddress === Constants.ZeroAddress) {
          const forwardValue = AbiFunction.from(['function forwardValue(address to, uint256 value)'])
          callsToSend.unshift({
            to: VALUE_FORWARDER_ADDRESS,
            value: BigInt(feeOption.value),
            data: AbiFunction.encodeData(forwardValue, [feeOption.to as Address.Address, BigInt(feeOption.value)]),
            gasLimit: BigInt(feeOption.gasLimit),
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert' as const,
          })
        } else {
          const transfer = AbiFunction.from(['function transfer(address to, uint256 value)'])
          const transferCall: Payload.Call = {
            to: feeOption.token.contractAddress as `0x${string}`,
            value: BigInt(0),
            data: AbiFunction.encodeData(transfer, [feeOption.to as Address.Address, BigInt(feeOption.value)]),
            gasLimit: BigInt(feeOption.gasLimit),
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert' as const,
          }
          callsToSend.unshift(transferCall)
        }
      }
      const signedCalls = await this._buildAndSignCalls(callsToSend)
      const hash = await this.relayer.relay(signedCalls.to, signedCalls.data, this.chainId)
      const status = await this._waitForTransactionReceipt(hash.opHash, this.chainId)
      if (status.status === 'confirmed') {
        return status.transactionHash
      } else {
        const failedStatus = status as Relayer.OperationFailedStatus
        const reason = failedStatus.reason || `unexpected status ${status.status}`
        throw new TransactionError(`Transaction failed: ${reason}`)
      }
    } catch (err) {
      throw new TransactionError(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Handles a redirect response from the wallet for this specific chain.
   * @param response The pre-parsed response from the transport.
   * @returns A promise that resolves to true if the response was handled successfully.
   * @throws {WalletRedirectError} If the response is invalid or causes an error.
   * @throws {InitializationError} If the session cannot be initialized from the response.
   */
  public async handleRedirectResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: { payload: any; action: string } | { error: any; action: string },
  ): Promise<boolean> {
    if (!response) return false

    if ('error' in response && response.error) {
      const { action } = response

      if (action === RequestActionType.SIGN_MESSAGE || action === RequestActionType.SIGN_TYPED_DATA) {
        this.emit('signatureResponse', { action, error: response.error })
        return true
      }

      if (action === RequestActionType.ADD_EXPLICIT_SESSION || action === RequestActionType.MODIFY_EXPLICIT_SESSION) {
        this.emit('explicitSessionResponse', { action, error: response.error })
        return true
      }
    }

    if ('payload' in response && response.payload) {
      if (
        response.action === RequestActionType.CREATE_NEW_SESSION ||
        response.action === RequestActionType.ADD_EXPLICIT_SESSION
      ) {
        return this._handleRedirectConnectionResponse(response)
      } else if (
        response.action === RequestActionType.SIGN_MESSAGE ||
        response.action === RequestActionType.SIGN_TYPED_DATA
      ) {
        this.emit('signatureResponse', {
          action: response.action,
          response: response.payload as SignatureResponse,
        })
        return true
      } else if (response.action === RequestActionType.MODIFY_EXPLICIT_SESSION) {
        const modifyResponse = response.payload as ModifySessionSuccessResponsePayload
        if (!Address.isEqual(Address.from(modifyResponse.walletAddress), this.walletAddress!)) {
          throw new ModifyExplicitSessionError('Wallet address mismatch on redirect response.')
        }

        this.emit('explicitSessionResponse', {
          action: RequestActionType.MODIFY_EXPLICIT_SESSION,
          response: modifyResponse,
        })

        return true
      } else {
        throw new WalletRedirectError(`Received unhandled redirect action: ${response.action}`)
      }
    }

    throw new WalletRedirectError('Received an invalid redirect response from the wallet.')
  }

  /**
   * Gets the wallet address associated with this manager.
   * @returns The wallet address, or null if not initialized.
   */
  getWalletAddress(): Address.Address | null {
    return this.walletAddress
  }

  /**
   * Gets the sessions (signers) managed by this instance.
   * @returns An array of session objects.
   */
  getSessions(): Session[] {
    return this.sessions
  }

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
  async signMessage(message: string): Promise<void> {
    const payload: SignMessagePayload = {
      address: this.walletAddress!,
      message,
      chainId: this.chainId,
    }
    try {
      await this._requestSignature(RequestActionType.SIGN_MESSAGE, payload)
    } catch (err) {
      throw new SigningError(`Signing message failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

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
  async signTypedData(typedData: TypedData): Promise<void> {
    const payload: SignTypedDataPayload = {
      address: this.walletAddress!,
      typedData,
      chainId: this.chainId,
    }
    try {
      await this._requestSignature(RequestActionType.SIGN_TYPED_DATA, payload)
    } catch (err) {
      throw new SigningError(`Signing typed data failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * @private A generic helper to handle the logic for requesting any type of signature.
   *
   * @param action The action to request.
   * @param payload The payload to send.
   *
   * @throws {InitializationError} If the session is not initialized or transport is not available.
   * @throws {SigningError} If the signature request fails.
   */
  private async _requestSignature(
    action: (typeof RequestActionType)['SIGN_MESSAGE' | 'SIGN_TYPED_DATA'],
    payload: SignMessagePayload | SignTypedDataPayload,
  ): Promise<void> {
    if (!this.isInitialized || !this.walletAddress) {
      throw new InitializationError('Session not initialized. Cannot request signature.')
    }
    if (!this.transport) {
      throw new InitializationError('Transport is not available.')
    }

    try {
      if (this.transport.mode === TransportMode.REDIRECT) {
        await this.sequenceStorage.savePendingRequest({
          action,
          payload,
          chainId: this.chainId,
        })
        await this.sequenceStorage.setPendingRedirectRequest(true)
        await this.transport.sendRequest(action, this.redirectUrl, payload, {
          path: '/request/sign',
        })
      } else {
        const response = await this.transport.sendRequest<SignatureResponse>(action, this.redirectUrl, payload, {
          path: '/request/sign',
        })
        this.emit('signatureResponse', { action, response })
      }
    } catch (err) {
      const error = new SigningError(err instanceof Error ? err.message : String(err))
      this.emit('signatureResponse', { action, error })
      throw error
    } finally {
      if (this.transport.mode === TransportMode.POPUP) {
        this.transport.closeWallet()
      }
    }
  }

  /**
   * @private Prepares, signs, and builds a transaction envelope.
   * @param calls The payload calls to include in the transaction.
   * @returns The signed transaction data ready for relaying.
   */
  private async _buildAndSignCalls(calls: Payload.Call[]): Promise<{ to: Address.Address; data: Hex.Hex }> {
    if (!this.wallet || !this.sessionManager || !this.provider)
      throw new InitializationError('Session not fully initialized.')

    try {
      const preparedIncrement = await this.sessionManager.prepareIncrement(this.wallet.address, this.chainId, calls)
      if (preparedIncrement) calls.push(preparedIncrement)

      const envelope = await this.wallet.prepareTransaction(this.provider, calls, {
        noConfigUpdate: true,
      })
      const parentedEnvelope: Payload.Parented = {
        ...envelope.payload,
        parentWallets: [this.wallet.address],
      }
      const imageHash = await this.sessionManager.imageHash
      if (imageHash === undefined) throw new SessionConfigError('Session manager image hash is undefined')

      const signature = await this.sessionManager.signSapient(
        this.wallet.address,
        this.chainId,
        parentedEnvelope,
        imageHash,
      )
      const sapientSignature: Envelope.SapientSignature = {
        imageHash,
        signature,
      }
      const signedEnvelope = Envelope.toSigned(envelope, [sapientSignature])

      // TODO: check whether guard signature is even needed for this wallet based on the topology
      if (this.guard && !Envelope.reachedThreshold(signedEnvelope)) {
        // TODO: this might fail if 2FA is required
        const guard = new Signers.Guard(new Guard.Sequence.Guard(this.guard.url, this.guard.address))
        const guardSignature = await guard.signEnvelope(signedEnvelope)
        signedEnvelope.signatures.push(guardSignature)
      }

      return await this.wallet.buildTransaction(this.provider, signedEnvelope)
    } catch (err) {
      throw new TransactionError(`Transaction failed building: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * @private Polls the relayer for the status of a transaction until it is confirmed or fails.
   * @param opHash The operation hash of the relayed transaction.
   * @param chainId The chain ID of the transaction.
   * @returns The final status of the transaction.
   */
  private async _waitForTransactionReceipt(opHash: `0x${string}`, chainId: number): Promise<Relayer.OperationStatus> {
    try {
      while (true) {
        const currentStatus = await this.relayer.status(opHash, chainId)
        if (currentStatus.status === 'confirmed' || currentStatus.status === 'failed') return currentStatus
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    } catch (err) {
      throw new TransactionError(
        `Transaction failed waiting for receipt: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  /**
   * @private Resets the internal state of the manager without clearing stored credentials.
   */
  private _resetState(): void {
    this.sessions = []
    this.walletAddress = null
    this.wallet = null
    this.sessionManager = null
    this.isInitialized = false
  }

  /**
   * @private Resets the internal state and clears all persisted session data from storage.
   */
  private async _resetStateAndClearCredentials(): Promise<void> {
    this._resetState()
    await this.sequenceStorage.clearImplicitSession()
    await this.sequenceStorage.clearExplicitSessions()
  }
}
