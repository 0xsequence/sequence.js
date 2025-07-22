/* eslint-disable @typescript-eslint/no-explicit-any */

import { Envelope, Relayer, Signers, State, Wallet } from '@0xsequence/wallet-core'
import { Attestation, Extensions, Payload, SessionConfig } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'

import { DappTransport } from './DappTransport.js'
import {
  getImplicitSession,
  clearImplicitSession,
  saveExplicitSession,
  getExplicitSessions,
  clearExplicitSessions,
  setPendingRedirectRequest,
  isRedirectRequestPending,
  saveTempSessionPk,
  getAndClearTempSessionPk,
  saveSignatureRequestContext,
  saveImplicitSession,
  savePendingRequestPayload,
  getAndClearPendingRequestPayload,
} from './utils/storage.js'
import { ChainId } from '@0xsequence/network'
import { getRelayerUrl, getRpcUrl } from './utils/index.js'
import {
  AddExplicitSessionError,
  FeeOptionError,
  InitializationError,
  SessionConfigError,
  SigningError,
  TransactionError,
  WalletRedirectError,
} from './utils/errors.js'
import {
  SignatureEventListener,
  Session,
  PreferredLoginMethod,
  AddExplicitSessionPayload,
  AddImplicitSessionPayload,
  ConnectSuccessResponsePayload,
  RequestActionType,
  SignatureResponse,
  Transaction,
  SignTypedDataPayload,
  SignMessagePayload,
  TransportMode,
} from './types/index.js'
import { CACHE_DB_NAME } from './utils/constants.js'

export class ChainSessionManager {
  private readonly instanceId: string

  private stateProvider: State.Provider

  private eventListeners: Map<'signatureResponse', Set<SignatureEventListener>> = new Map()

  private sessions: Session[] = []

  private walletAddress: Address.Address | null = null
  private sessionManager: Signers.SessionManager | null = null
  private wallet: Wallet | null = null
  private provider: Provider.Provider | null = null
  private relayer: Relayer.Standard.Rpc.RpcRelayer
  private readonly chainId: ChainId
  public transport: DappTransport | null = null
  public isInitialized: boolean = false
  private isInitializing: boolean = false
  public loginMethod: PreferredLoginMethod | null = null
  public userEmail: string | null = null

  constructor(chainId: ChainId, keyMachineUrl: string, transport: DappTransport) {
    this.instanceId = `manager-${Math.random().toString(36).substring(2, 9)}`
    console.log(`ChainSessionManager instance created: ${this.instanceId}`)

    const rpcUrl = getRpcUrl(chainId)
    this.chainId = chainId

    this.stateProvider = new State.Cached({
      source: new State.Sequence.Provider(keyMachineUrl),
      cache: new State.Local.Provider(new State.Local.IndexedDbStore(CACHE_DB_NAME)),
    })
    this.provider = Provider.from(RpcTransport.fromHttp(rpcUrl))
    this.relayer = new Relayer.Standard.Rpc.RpcRelayer(getRelayerUrl(chainId), Number(this.chainId), getRpcUrl(chainId))

    this.transport = transport
  }

  public on(event: 'signatureResponse', listener: SignatureEventListener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
    return () => {
      this.eventListeners.get(event)?.delete(listener)
    }
  }

  private emit(event: 'signatureResponse', data: Parameters<SignatureEventListener>[0]): void {
    this.eventListeners.get(event)?.forEach((listener) => listener(data))
  }

  async initialize(): Promise<{
    loginMethod: string | null
    userEmail: string | null
  } | void> {
    if (this.isInitializing) return
    this.isInitializing = true

    this._resetState()

    try {
      const implicitSession = await getImplicitSession()
      if (implicitSession) {
        await this._loadSessionFromStorage(implicitSession)
      }

      if (isRedirectRequestPending()) {
        await this.handleRedirectResponse()
        setPendingRedirectRequest(false)
      }
    } catch (err) {
      this._resetStateAndClearCredentials()
      throw new InitializationError(`Initialization failed: ${err}`)
    } finally {
      this.isInitializing = false
      this.isInitialized = !!this.walletAddress
    }
    return { loginMethod: this.loginMethod, userEmail: this.userEmail }
  }

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

  private async _loadSessionFromStorage(implicitSession: any) {
    const walletAddr = Address.from(implicitSession.walletAddress)
    this.initializeWithWallet(walletAddr)

    await this._initializeImplicitSessionInternal(
      implicitSession.pk,
      walletAddr,
      implicitSession.attestation,
      implicitSession.identitySignature,
      false,
      implicitSession.loginMethod,
      implicitSession.userEmail,
    )

    const allExplicitSessions = await getExplicitSessions()
    const walletExplicitSessions = allExplicitSessions.filter((s) =>
      Address.isEqual(Address.from(s.walletAddress), walletAddr),
    )

    for (const sessionData of walletExplicitSessions) {
      await this._initializeExplicitSessionInternal(sessionData.pk, true)
    }
  }

  async createNewSession(
    implicitSessionRedirectUrl: string,
    permissions?: Signers.Session.ExplicitParams,
    options: {
      preferredLoginMethod?: PreferredLoginMethod
      email?: string
    } = {},
  ): Promise<void> {
    if (this.isInitialized) {
      throw new InitializationError('A session already exists. Disconnect first.')
    }

    const newPk = Secp256k1.randomPrivateKey()
    const newSignerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: newPk }))

    try {
      if (!this.transport) throw new InitializationError('Transport failed to initialize.')

      const payload: AddImplicitSessionPayload = {
        sessionAddress: newSignerAddress,
        implicitSessionRedirectUrl,
        permissions,
        preferredLoginMethod: options.preferredLoginMethod,
        email: options.preferredLoginMethod === 'email' ? options.email : undefined,
      }

      if (this.transport.mode === TransportMode.REDIRECT) {
        saveTempSessionPk(newPk)
        savePendingRequestPayload(this.chainId, payload)
        setPendingRedirectRequest(true)
      }

      const connectResponse = await this.transport.sendRequest<ConnectSuccessResponsePayload>(
        RequestActionType.ADD_IMPLICIT_SESSION,
        payload,
        { path: '/request/connect' },
      )

      const receivedAddress = Address.from(connectResponse.walletAddress)
      const { attestation, signature, email, loginMethod } = connectResponse
      if (!attestation || !signature)
        throw new InitializationError('Attestation or signature missing for implicit session.')

      this._resetStateAndClearCredentials()

      this.initializeWithWallet(receivedAddress)

      await this._initializeImplicitSessionInternal(
        newPk,
        receivedAddress,
        attestation,
        signature,
        true,
        loginMethod,
        email,
      )

      if (permissions) {
        await this._initializeExplicitSessionInternal(newPk, true)
        await saveExplicitSession({
          pk: newPk,
          walletAddress: receivedAddress,
          chainId: this.chainId,
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

  async addExplicitSession(permissions: Signers.Session.ExplicitParams): Promise<void> {
    if (!this.walletAddress) {
      throw new InitializationError(
        'Cannot add an explicit session without a wallet address. Initialize the manager with a wallet address first.',
      )
    }

    const newPk = Secp256k1.randomPrivateKey()

    try {
      if (!this.transport) throw new InitializationError('Transport failed to initialize.')

      const newSignerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: newPk }))

      const payload: AddExplicitSessionPayload = {
        sessionAddress: newSignerAddress,
        permissions,
      }

      if (this.transport.mode === TransportMode.REDIRECT) {
        saveTempSessionPk(newPk)
        setPendingRedirectRequest(true)
        savePendingRequestPayload(this.chainId, payload)
      }

      const response = await this.transport.sendRequest<ConnectSuccessResponsePayload>(
        RequestActionType.ADD_EXPLICIT_SESSION,
        payload,
        { path: '/request/connect' },
      )

      if (!Address.isEqual(Address.from(response.walletAddress), this.walletAddress)) {
        throw new AddExplicitSessionError('Wallet address mismatch.')
      }

      if (this.transport?.mode === TransportMode.POPUP) {
        this.transport?.closeWallet()
      }

      await this._initializeExplicitSessionInternal(newPk, true)
      await saveExplicitSession({
        pk: newPk,
        walletAddress: this.walletAddress,
        chainId: this.chainId,
      })
    } catch (err) {
      if (this.transport?.mode === TransportMode.POPUP) this.transport.closeWallet()
      throw new AddExplicitSessionError(`Adding explicit session failed: ${err}`)
    }
  }

  private async _handleRedirectConnectionResponse(response: { payload: any; action: string }): Promise<boolean> {
    const savedRequest = getAndClearPendingRequestPayload()
    const tempPk = getAndClearTempSessionPk()
    if (!tempPk) {
      throw new InitializationError('Failed to retrieve temporary session key after redirect.')
    }

    try {
      const connectResponse = response.payload as ConnectSuccessResponsePayload
      const receivedAddress = Address.from(connectResponse.walletAddress)
      const { email, loginMethod } = connectResponse

      if (response.action === RequestActionType.ADD_IMPLICIT_SESSION) {
        const { attestation, signature } = connectResponse
        if (!attestation || !signature) throw new WalletRedirectError('Attestation or signature missing.')

        const savedPayload = savedRequest?.payload as AddImplicitSessionPayload | undefined
        this._resetStateAndClearCredentials()

        this.initializeWithWallet(receivedAddress)

        await this._initializeImplicitSessionInternal(
          tempPk,
          receivedAddress,
          attestation,
          signature,
          true,
          loginMethod,
          email,
        )

        if (savedPayload && savedPayload.permissions) {
          await this._initializeExplicitSessionInternal(tempPk, true)
          await saveExplicitSession({
            pk: tempPk,
            walletAddress: receivedAddress,
            chainId: this.chainId,
          })
        }
      } else if (response.action === RequestActionType.ADD_EXPLICIT_SESSION) {
        if (!this.walletAddress || !Address.isEqual(receivedAddress, this.walletAddress)) {
          throw new InitializationError('Received an explicit session for a wallet that is not active.')
        }

        await this._initializeExplicitSessionInternal(tempPk, true)
        await saveExplicitSession({
          pk: tempPk,
          walletAddress: receivedAddress,
          chainId: this.chainId,
        })
      }
      this.isInitialized = true
      return true
    } catch (err) {
      throw new InitializationError(`Failed to initialize session from redirect: ${err}`)
    }
  }

  async disconnect(): Promise<void> {
    this._resetStateAndClearCredentials()
    if (this.transport) {
      this.transport.destroy()
      this.transport = null
    }
    this.loginMethod = null
    this.userEmail = null
    this.isInitialized = false
  }

  private async _initializeImplicitSessionInternal(
    pk: Hex.Hex,
    address: Address.Address,
    attestation: Attestation.Attestation,
    identitySignature: Hex.Hex,
    saveSession: boolean = false,
    loginMethod?: PreferredLoginMethod,
    userEmail?: string,
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
        await saveImplicitSession({
          pk,
          walletAddress: address,
          attestation,
          identitySignature,
          chainId: this.chainId,
          loginMethod,
          userEmail,
        })
      if (loginMethod) this.loginMethod = loginMethod
      if (userEmail) this.userEmail = userEmail
    } catch (err) {
      throw new InitializationError(`Implicit session init failed: ${err}`)
    }
  }

  private async _initializeExplicitSessionInternal(pk: Hex.Hex, allowRetries: boolean = false): Promise<void> {
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
        })
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

  async getFeeOptions(calls: Transaction[]): Promise<Relayer.FeeOption[]> {
    const callsToSend = calls.map((tx) => ({
      to: tx.to,
      value: tx.value,
      data: tx.data,
      gasLimit: tx.gasLimit ?? 0n,
      delegateCall: tx.delegateCall ?? false,
      onlyFallback: tx.onlyFallback ?? false,
      behaviorOnError: tx.behaviorOnError ?? ('revert' as const),
    }))
    try {
      const signedCall = await this._buildAndSignCalls(callsToSend)
      const feeOptions = await this.relayer.feeOptions(signedCall.to, BigInt(this.chainId), callsToSend)
      return feeOptions.options
    } catch (err) {
      throw new FeeOptionError(`Failed to get fee options: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async buildSignAndSendTransactions(transactions: Transaction[], feeOption?: Relayer.FeeOption): Promise<string> {
    if (!this.wallet || !this.sessionManager || !this.provider || !this.isInitialized)
      throw new InitializationError('Session is not initialized.')
    try {
      const calls: Payload.Call[] = transactions.map((tx) => ({
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gasLimit: tx.gasLimit ?? 0n,
        delegateCall: tx.delegateCall ?? false,
        onlyFallback: tx.onlyFallback ?? false,
        behaviorOnError: tx.behaviorOnError ?? ('revert' as const),
      }))

      const callsToSend = calls
      if (feeOption) {
        const transfer = AbiFunction.from(['function transfer(address to, uint256 value)'])
        const transferCall: Payload.Call = {
          to: feeOption.token.contractAddress as `0x${string}`,
          value: 0n,
          data: AbiFunction.encodeData(transfer, [feeOption.to as Address.Address, BigInt(feeOption.value)]),
          gasLimit: BigInt(feeOption.gasLimit),
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert' as const,
        }
        callsToSend.unshift(transferCall)
      }
      const signedCalls = await this._buildAndSignCalls(callsToSend)
      const hash = await this.relayer.relay(signedCalls.to, signedCalls.data, BigInt(this.chainId))
      const status = await this._waitForTransactionReceipt(hash.opHash, BigInt(this.chainId))
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

  private async handleRedirectResponse(): Promise<boolean> {
    if (!this.transport) return false
    const response = this.transport.getRedirectResponse()
    if (!response) return false

    if ('error' in response && response.error) {
      this.emit('signatureResponse', {
        action: response.action as any,
        error: response.error,
      })
      throw new WalletRedirectError(`Wallet responded with an error: ${JSON.stringify(response.error)}`)
    }
    if ('payload' in response && response.payload) {
      if (
        response.action === RequestActionType.ADD_IMPLICIT_SESSION ||
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
      } else {
        throw new WalletRedirectError(`Received unhandled redirect action: ${response.action}`)
      }
    }
    throw new WalletRedirectError('Received an invalid redirect response from the wallet.')
  }

  getWalletAddress(): Address.Address | null {
    return this.walletAddress
  }

  getSessions(): Session[] {
    return this.sessions
  }

  /**
   * Requests a signature for a standard message (EIP-191).
   * The signature is delivered via the `signatureResponse` event.
   * @param message The message to sign.
   *
   * @throws If the session is not initialized. {@link InitializationError}
   * @throws If the signature request fails. {@link SigningError}
   *
   * @returns An empty promise.
   */
  async signMessage(message: string): Promise<void> {
    const payload: SignMessagePayload = { address: this.walletAddress!, message, chainId: this.chainId }
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
   * @throws If the session is not initialized. {@link InitializationError}
   * @throws If the signature request fails. {@link SigningError}
   *
   * @returns An empty promise.
   */
  async signTypedData(typedData: unknown): Promise<void> {
    const payload: SignTypedDataPayload = { address: this.walletAddress!, typedData, chainId: this.chainId }
    try {
      await this._requestSignature(RequestActionType.SIGN_TYPED_DATA, payload)
    } catch (err) {
      throw new SigningError(`Signing typed data failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * @private A generic helper to handle the logic for requesting any type of signature.
   *
   * @param action The action to request. {@link RequestActionType}
   * @param payload The payload to send. {@link any}
   *
   * @throws If the session is not initialized or transport is not available. {@link InitializationError}
   * @throws If the signature request fails. {@link SigningError}
   */
  private async _requestSignature(action: any, payload: any): Promise<void> {
    if (!this.isInitialized || !this.walletAddress) {
      throw new InitializationError('Session not initialized. Cannot request signature.')
    }
    if (!this.transport) {
      throw new InitializationError('Transport is not available.')
    }

    try {
      if (this.transport.mode === TransportMode.REDIRECT) {
        saveSignatureRequestContext({ action, payload })
        setPendingRedirectRequest(true)
        await this.transport.sendRequest(action, payload, { path: '/request/sign' })
      } else {
        const response = await this.transport.sendRequest<SignatureResponse>(action, payload, { path: '/request/sign' })
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

  private async _buildAndSignCalls(calls: Payload.Call[]): Promise<{ to: Address.Address; data: Hex.Hex }> {
    if (!this.wallet || !this.sessionManager || !this.provider)
      throw new InitializationError('Session not fully initialized.')

    try {
      const preparedIncrement = await this.sessionManager.prepareIncrement(
        this.wallet.address,
        BigInt(this.chainId),
        calls,
      )
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
        BigInt(this.chainId),
        parentedEnvelope,
        imageHash,
      )
      const sapientSignature: Envelope.SapientSignature = {
        imageHash,
        signature,
      }
      const signedEnvelope = Envelope.toSigned(envelope, [sapientSignature])

      return await this.wallet.buildTransaction(this.provider, signedEnvelope)
    } catch (err) {
      throw new TransactionError(`Transaction failed building: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async _waitForTransactionReceipt(opHash: `0x${string}`, chainId: bigint): Promise<Relayer.OperationStatus> {
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

  private _resetState(): void {
    this.sessions = []
    this.walletAddress = null
    this.wallet = null
    this.sessionManager = null
    this.isInitialized = false
  }

  private _resetStateAndClearCredentials(): void {
    this._resetState()
    clearImplicitSession()
    clearExplicitSessions()
  }
}
