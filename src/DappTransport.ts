/* eslint-disable @typescript-eslint/no-explicit-any */

import { jsonReplacers, jsonRevivers } from './utils/index.js'
import {
  MessageType,
  PendingRequest,
  PopupModeOptions,
  SendRequestOptions,
  SequenceSessionStorage,
  TransportMessage,
  TransportMode,
  WalletSize,
} from './types/index.js'

const isBrowserEnvironment = typeof window !== 'undefined' && typeof document !== 'undefined'

const base64Encode = (value: string) => {
  if (typeof btoa !== 'undefined') {
    return btoa(value)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64')
  }
  throw new Error('Base64 encoding is not supported in this environment.')
}

const base64Decode = (value: string) => {
  if (typeof atob !== 'undefined') {
    return atob(value)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('utf-8')
  }
  throw new Error('Base64 decoding is not supported in this environment.')
}

enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
}

const REDIRECT_REQUEST_KEY = 'dapp-redirect-request'

export class DappTransport {
  private walletWindow: Window | undefined = undefined
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED
  private readyPromise: Promise<void> | undefined = undefined
  private readyPromiseResolve: (() => void) | undefined = undefined
  private readyPromiseReject: ((reason?: any) => void) | undefined = undefined
  private initId: string | undefined = undefined
  private handshakeTimeoutId: number | undefined = undefined
  private closeCheckIntervalId: number | undefined = undefined
  private sessionId: string | undefined = undefined
  private pendingRequests = new Map<string, PendingRequest>()
  private messageQueue: TransportMessage[] = []
  private readonly requestTimeoutMs: number
  private readonly handshakeTimeoutMs: number
  private readonly sequenceSessionStorage: SequenceSessionStorage
  private readonly redirectActionHandler?: (url: string) => void
  private readonly isBrowser: boolean

  public readonly walletOrigin: string

  constructor(
    public readonly walletUrl: string,
    readonly mode: TransportMode = TransportMode.POPUP,
    popupModeOptions: PopupModeOptions = {},
    sequenceSessionStorage?: SequenceSessionStorage,
    redirectActionHandler?: (url: string) => void,
  ) {
    this.isBrowser = isBrowserEnvironment
    try {
      this.walletOrigin = new URL(walletUrl).origin
    } catch (e) {
      console.error('[DApp] Invalid walletUrl provided:', walletUrl, e)
      throw new Error(`Invalid walletUrl: ${walletUrl}`)
    }
    if (!this.walletOrigin || this.walletOrigin === 'null' || this.walletOrigin === '*') {
      console.error('[DApp] Could not determine a valid wallet origin from the URL:', walletUrl)
      throw new Error('Invalid wallet origin derived from walletUrl.')
    }

    this.sequenceSessionStorage =
      sequenceSessionStorage ||
      ({
        getItem: (key: string) => (this.isBrowser && window.sessionStorage ? window.sessionStorage.getItem(key) : null),
        setItem: (key: string, value: string) => {
          if (this.isBrowser && window.sessionStorage) {
            window.sessionStorage.setItem(key, value)
          }
        },
        removeItem: (key: string) => {
          if (this.isBrowser && window.sessionStorage) {
            window.sessionStorage.removeItem(key)
          }
        },
      } satisfies SequenceSessionStorage)

    this.requestTimeoutMs = popupModeOptions.requestTimeoutMs ?? 300000
    this.handshakeTimeoutMs = popupModeOptions.handshakeTimeoutMs ?? 15000

    if (this.mode === TransportMode.POPUP && this.isBrowser) {
      window.addEventListener('message', this.handleMessage)
    }

    this.redirectActionHandler = redirectActionHandler
  }

  get isWalletOpen(): boolean {
    if (this.mode === TransportMode.REDIRECT) return false
    return !!this.walletWindow && !this.walletWindow.closed
  }

  get isReady(): boolean {
    if (this.mode === TransportMode.REDIRECT) return false
    return this.connectionState === ConnectionState.CONNECTED
  }

  async sendRequest<TResponse = any, TRequest = any>(
    action: string,
    redirectUrl: string,
    payload?: TRequest,
    options: SendRequestOptions = {},
  ): Promise<TResponse> {
    if (!this.isBrowser && this.mode === TransportMode.POPUP) {
      throw new Error(
        'Popup transport requires a browser environment. Use redirect mode or provide a redirect handler.',
      )
    }

    if (this.mode === TransportMode.REDIRECT) {
      const url = await this.getRequestRedirectUrl(action, payload, redirectUrl, options.path)
      if (this.redirectActionHandler) {
        this.redirectActionHandler(url)
      } else if (this.isBrowser) {
        console.info('[DappTransport] No redirectActionHandler provided. Using window.location.href to navigate.')
        window.location.href = url
      } else {
        throw new Error(
          'Redirect navigation is not possible outside the browser without a redirectActionHandler. Provide a handler to perform navigation.',
        )
      }
      return new Promise<TResponse>(() => {})
    }

    if (this.connectionState !== ConnectionState.CONNECTED) {
      await this.openWallet(options.path)
    }

    if (!this.isWalletOpen || this.connectionState !== ConnectionState.CONNECTED) {
      throw new Error('Wallet connection is not available or failed to establish.')
    }

    const id = this.generateId()
    const message: TransportMessage<TRequest> = {
      id,
      type: MessageType.REQUEST,
      action,
      payload,
    }

    return new Promise((resolve, reject) => {
      const timeout = options.timeout ?? this.requestTimeoutMs
      const timer = window.setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request '${action}' (ID: ${id}) timed out after ${timeout}ms.`))
        }
      }, timeout)

      this.pendingRequests.set(id, { resolve, reject, timer, action })
      this.postMessageToWallet(message)
    })
  }

  public async getRequestRedirectUrl(
    action: string,
    payload: any,
    redirectUrl: string,
    path?: string,
  ): Promise<string> {
    const id = this.generateId()
    const request = { id, action, timestamp: Date.now() }

    try {
      await this.sequenceSessionStorage.setItem(REDIRECT_REQUEST_KEY, JSON.stringify(request, jsonReplacers))
    } catch (e) {
      console.error('Failed to set redirect request in storage', e)
      throw new Error('Could not save redirect state to storage. Redirect flow is unavailable.')
    }

    const serializedPayload = base64Encode(JSON.stringify(payload || {}, jsonReplacers))
    const fullWalletUrl = path ? `${this.walletUrl}${path}` : this.walletUrl
    const url = new URL(fullWalletUrl)
    url.searchParams.set('action', action)
    url.searchParams.set('payload', serializedPayload)
    url.searchParams.set('id', id)
    url.searchParams.set('redirectUrl', redirectUrl)
    url.searchParams.set('mode', 'redirect')

    return url.toString()
  }

  public async getRedirectResponse<TResponse = any>(
    cleanState: boolean = true,
    url?: string,
  ): Promise<{ payload: TResponse; action: string } | { error: any; action: string } | null> {
    if (!url && !this.isBrowser) {
      throw new Error('A URL must be provided when handling redirect responses outside of a browser environment.')
    }

    const search = url ? new URL(url).search : this.isBrowser ? window.location.search : ''
    const params = new URLSearchParams(search)
    const responseId = params.get('id')
    if (!responseId) return null

    let originalRequest: { id: string; action: string; timestamp: number }
    try {
      const storedRequest = await this.sequenceSessionStorage.getItem(REDIRECT_REQUEST_KEY)
      if (!storedRequest) {
        return null
      }
      originalRequest = JSON.parse(storedRequest, jsonRevivers)
    } catch (e) {
      console.error('Failed to parse redirect request from storage', e)
      return null
    }

    if (originalRequest.id !== responseId) {
      console.error(`Mismatched ID in redirect response. Expected ${originalRequest.id}, got ${responseId}.`)
      if (cleanState) {
        await this.sequenceSessionStorage.removeItem(REDIRECT_REQUEST_KEY)
      }
      return null
    }

    const responsePayloadB64 = params.get('payload')
    const responseErrorB64 = params.get('error')

    if (cleanState) {
      await this.sequenceSessionStorage.removeItem(REDIRECT_REQUEST_KEY)
      if (this.isBrowser && !url && window.history) {
        const cleanUrl = new URL(window.location.href)
        ;['id', 'payload', 'error', 'mode'].forEach((p) => cleanUrl.searchParams.delete(p))
        history.replaceState({}, document.title, cleanUrl.toString())
      }
    }

    if (responseErrorB64) {
      try {
        return {
          error: JSON.parse(base64Decode(responseErrorB64), jsonRevivers),
          action: originalRequest.action,
        }
      } catch (e) {
        console.error('Failed to parse error from redirect response', e)
        return {
          error: 'Failed to parse error from redirect',
          action: originalRequest.action,
        }
      }
    }
    if (responsePayloadB64) {
      try {
        return {
          payload: JSON.parse(base64Decode(responsePayloadB64), jsonRevivers),
          action: originalRequest.action,
        }
      } catch (e) {
        console.error('Failed to parse payload from redirect response', e)
        return {
          error: 'Failed to parse payload from redirect',
          action: originalRequest.action,
        }
      }
    }
    return {
      error: "Redirect response missing 'payload' or 'error'",
      action: originalRequest.action,
    }
  }

  public openWallet(path?: string): Promise<void> {
    if (this.mode === TransportMode.REDIRECT) {
      throw new Error("`openWallet` is not available in 'redirect' mode.")
    }
    if (!this.isBrowser) {
      throw new Error('Popup transport requires a browser environment.')
    }
    if (this.connectionState !== ConnectionState.DISCONNECTED) {
      if (this.isWalletOpen) this.walletWindow?.focus()
      return this.readyPromise || Promise.resolve()
    }
    this.connectionState = ConnectionState.CONNECTING
    this.clearPendingRequests(new Error('Wallet connection reset during open.'))
    this.messageQueue = []
    this.clearTimeouts()
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyPromiseResolve = resolve
      this.readyPromiseReject = reject
    })
    this.readyPromise.catch(() => {})
    this.initId = this.generateId()
    const fullWalletUrl = path ? `${this.walletUrl}${path}` : this.walletUrl
    this.sessionId = this.generateId()
    const urlWithParams = new URL(fullWalletUrl)
    urlWithParams.searchParams.set('dappOrigin', window.location.origin)
    urlWithParams.searchParams.set('sessionId', this.sessionId)

    try {
      const openedWindow = window.open(
        urlWithParams.toString(),
        'Wallet',
        `width=${WalletSize.width},height=${WalletSize.height},scrollbars=yes,resizable=yes`,
      )
      this.walletWindow = openedWindow || undefined
    } catch (error) {
      const openError = new Error(
        `Failed to open wallet window: ${error instanceof Error ? error.message : String(error)}`,
      )
      this._handlePreConnectionFailure(openError)
      return Promise.reject(openError)
    }
    if (!this.walletWindow) {
      const error = new Error('Failed to open wallet window. Please check your pop-up blocker settings.')
      this._handlePreConnectionFailure(error)
      return Promise.reject(error)
    }

    this.handshakeTimeoutId = window.setTimeout(() => {
      if (this.connectionState === ConnectionState.CONNECTING) {
        const timeoutError = new Error(`Wallet handshake timed out after ${this.handshakeTimeoutMs}ms.`)
        this._handlePreConnectionFailure(timeoutError)
      }
    }, this.handshakeTimeoutMs)

    this.closeCheckIntervalId = window.setInterval(() => {
      if (!this.isWalletOpen) {
        if (this.connectionState === ConnectionState.CONNECTING)
          this._handlePreConnectionFailure(new Error('Wallet window was closed before becoming ready.'))
        else if (this.connectionState === ConnectionState.CONNECTED) this._handleDetectedClosure()
      }
    }, 500)
    return this.readyPromise
  }

  public closeWallet(): void {
    if (this.mode === TransportMode.REDIRECT) {
      console.warn(
        "[DApp] `closeWallet` is not available in 'redirect' mode. Use window.location.href to navigate away.",
      )
      return
    }
    if (this.connectionState === ConnectionState.DISCONNECTED) return
    if (this.isWalletOpen) this.walletWindow?.close()
    this.connectionState = ConnectionState.DISCONNECTED
    this.readyPromise = undefined
    this.readyPromiseResolve = undefined
    this.readyPromiseReject = undefined
    this._resetConnection(new Error('Wallet closed intentionally by DApp.'), 'Wallet closed intentionally by DApp.')
  }

  destroy(): void {
    if (this.mode === TransportMode.POPUP && this.isBrowser) {
      window.removeEventListener('message', this.handleMessage)
      if (this.isWalletOpen) {
        this.walletWindow?.close()
      }
      this._resetConnection(new Error('Transport destroyed.'), 'Destroying transport...')
    } else {
      this._resetConnection(new Error('Transport destroyed.'), 'Destroying transport...')
    }
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.origin !== this.walletOrigin) {
      return
    }

    const isPotentiallyValidSource =
      this.walletWindow && (event.source === this.walletWindow || !this.walletWindow.closed)

    if (!isPotentiallyValidSource && event.data?.type !== MessageType.WALLET_OPENED) {
      return
    }

    const message = event.data as TransportMessage
    if (
      !message ||
      typeof message !== 'object' ||
      !message.id ||
      !message.type ||
      (message.type === MessageType.WALLET_OPENED && !message.sessionId)
    ) {
      return
    }

    try {
      switch (message.type) {
        case MessageType.WALLET_OPENED:
          this.handleWalletReadyMessage(message)
          break
        case MessageType.RESPONSE:
          this.handleResponseMessage(message)
          break
        case MessageType.REQUEST:
        case MessageType.INIT:
        default:
          break
      }
    } catch (error) {
      console.error(`[DApp] Error processing received message (Type: ${message.type}, ID: ${message.id}):`, error)
    }
  }

  private handleWalletReadyMessage(message: TransportMessage): void {
    if (this.connectionState !== ConnectionState.CONNECTING) {
      return
    }

    if (message.sessionId !== this.sessionId) {
      return
    }

    if (this.handshakeTimeoutId !== undefined) {
      window.clearTimeout(this.handshakeTimeoutId)
      this.handshakeTimeoutId = undefined
    }

    const initMessage: TransportMessage = {
      id: this.initId!,
      type: MessageType.INIT,
      sessionId: this.sessionId,
    }
    this.postMessageToWallet(initMessage)

    this.connectionState = ConnectionState.CONNECTED

    if (this.readyPromiseResolve) {
      this.readyPromiseResolve()
    }

    this.messageQueue.forEach((queuedMsg) => {
      this.postMessageToWallet(queuedMsg)
    })
    this.messageQueue = []
  }

  private handleResponseMessage(message: TransportMessage): void {
    const pending = this.pendingRequests.get(message.id)
    if (pending) {
      window.clearTimeout(pending.timer)
      this.pendingRequests.delete(message.id)
      if (message.error) {
        const error = new Error(`Wallet responded with error: ${JSON.stringify(message.error)}`)
        pending.reject(error)
      } else {
        pending.resolve(message.payload)
      }
    }
  }

  private postMessageToWallet(message: TransportMessage): void {
    if (!this.isWalletOpen) {
      if (
        message.type === MessageType.INIT &&
        this.connectionState === ConnectionState.CONNECTING &&
        message.id === this.initId
      ) {
        this._handlePreConnectionFailure(new Error('Failed to send INIT: Wallet window closed unexpectedly.'))
      } else if (message.type === MessageType.REQUEST) {
        const pendingReq = this.pendingRequests.get(message.id)
        if (pendingReq) {
          window.clearTimeout(pendingReq.timer)
          this.pendingRequests.delete(message.id)
          pendingReq.reject(new Error(`Failed to send request '${pendingReq.action}': Wallet window closed.`))
        }
      }
      return
    }

    if (this.connectionState !== ConnectionState.CONNECTED && message.type !== MessageType.INIT) {
      this.messageQueue.push(message)
      return
    }

    try {
      this.walletWindow?.postMessage(message, this.walletOrigin)
    } catch (error) {
      const rejectionError =
        error instanceof Error ? error : new Error('Failed to send message to wallet due to unknown error')

      if (
        message.type === MessageType.INIT &&
        this.connectionState === ConnectionState.CONNECTING &&
        message.id === this.initId
      ) {
        this._handlePreConnectionFailure(rejectionError)
      } else if (message.type === MessageType.REQUEST) {
        const pendingReq = this.pendingRequests.get(message.id)
        if (pendingReq) {
          window.clearTimeout(pendingReq.timer)
          this.pendingRequests.delete(message.id)
          pendingReq.reject(rejectionError)
        }
        this._handleDetectedClosure()
      } else {
        this._handleDetectedClosure()
      }
    }
  }

  private _resetConnection(reason: Error, logMessage: string): void {
    console.log(`[DApp] ${logMessage}`)
    if (this.readyPromiseReject) {
      this.readyPromiseReject(reason)
    }
    this.clearTimeouts()
    this.clearPendingRequests(reason)
    this.connectionState = ConnectionState.DISCONNECTED
    this.walletWindow = undefined
    this.readyPromise = undefined
    this.readyPromiseResolve = undefined
    this.readyPromiseReject = undefined
    this.initId = undefined
    this.sessionId = undefined
    this.messageQueue = []
  }

  private _handlePreConnectionFailure(error: Error): void {
    this._resetConnection(error, `Connection failure: ${error.message}`)
  }

  private _handleDetectedClosure(): void {
    if (this.connectionState === ConnectionState.CONNECTED) {
      const reason = new Error('Wallet connection terminated unexpectedly.')
      this._resetConnection(reason, 'Wallet connection terminated unexpectedly after ready.')
    }
  }

  private clearPendingRequests(reason: Error): void {
    if (this.pendingRequests.size > 0) {
      const requestsToClear = new Map(this.pendingRequests)
      this.pendingRequests.clear()
      requestsToClear.forEach((pending) => {
        clearTimeout(pending.timer)
        const errorToSend = reason instanceof Error ? reason : new Error(`Operation failed: ${reason}`)
        pending.reject(errorToSend)
      })
    }
  }

  private clearTimeouts(): void {
    if (this.handshakeTimeoutId !== undefined) {
      clearTimeout(this.handshakeTimeoutId)
      this.handshakeTimeoutId = undefined
    }
    if (this.closeCheckIntervalId !== undefined) {
      clearInterval(this.closeCheckIntervalId)
      this.closeCheckIntervalId = undefined
    }
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`
  }
}
