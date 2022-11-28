import { ethers } from 'ethers'
import {
  WalletTransport,
  ProviderMessage,
  ProviderMessageRequest,
  EventType,
  ProviderMessageResponse,
  ProviderMessageTransport,
  ProviderRpcError,
  InitState,
  ConnectDetails,
  OpenWalletIntent,
  WalletSession,
  TransportSession
} from '../types'

import { WalletRequestHandler } from './wallet-request-handler'

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'
import { logger, sanitizeAlphanumeric, sanitizeHost, sanitizeNumberString } from '@0xsequence/utils'
import { AuthorizationOptions } from '@0xsequence/auth'

import { PROVIDER_OPEN_TIMEOUT } from './base-provider-transport'
import { isBrowserExtension, LocalStorage } from '../utils'

const TRANSPORT_SESSION_LS_KEY = '@sequence.transportSession'

export abstract class BaseWalletTransport implements WalletTransport {
  protected walletRequestHandler: WalletRequestHandler
  protected _sessionId: string
  protected _registered: boolean

  protected _init: InitState
  protected _initNonce: string
  protected _initCallback?: (error?: string) => void

  // appOrigin identifies the dapp's origin which opened the app. A transport
  // will auto-detect and set this value if it can. This is determined
  // as the parent app/window which opened the wallet.
  protected appOrigin?: string

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler
    this._init = InitState.NIL

    this.walletRequestHandler.on('connect', (connectDetails: ConnectDetails) => {
      if (!this.registered) return
      // means user has logged in and wallet is connected to the app
      this.notifyConnect(connectDetails)
    })

    this.walletRequestHandler.on('disconnect', (error?: ProviderRpcError) => {
      if (!this.registered) return
      // means user has logged out the app / disconnected wallet from the app
      this.notifyDisconnect(error)
    })

    this.walletRequestHandler.on('accountsChanged', (accounts: string[], origin?: string) => {
      if (!this.registered) return
      this.notifyAccountsChanged(accounts, origin)
    })

    this.walletRequestHandler.on('networks', (networks: NetworkConfig[]) => {
      if (!this.registered) return
      this.notifyNetworks(networks)
      if (!networks || networks.length === 0) {
        this.notifyChainChanged('0x0')
      } else {
        this.notifyChainChanged(ethers.utils.hexlify(networks.find(network => network.isDefaultChain)!.chainId))
      }
    })

    this.walletRequestHandler.on('walletContext', (walletContext: WalletContext) => {
      if (!this.registered || !walletContext) return
      this.notifyWalletContext(walletContext)
    })

    this.walletRequestHandler.on('close', (error?: ProviderRpcError) => {
      if (!this.registered) return
      this.notifyClose(error)
    })
  }

  get registered(): boolean {
    return this._registered
  }

  register() {
    throw new Error('abstract method')
  }

  unregister() {
    throw new Error('abstract method')
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    throw new Error('abstract method')
  }

  handleMessage = async (message: ProviderMessage<any>) => {
    const request = message

    // ensure initial handshake is complete before accepting
    // other kinds of messages.
    if (this._init !== InitState.OK) {
      if (request.type === EventType.INIT) {
        if (this.isValidInitAck(message)) {
          // successful init
          if (this._initCallback) this._initCallback()
        } else {
          // failed init
          if (this._initCallback) this._initCallback('invalid init')
          return
        }
      } else {
        // we expect init message first. do nothing here.
      }
      return
    }

    // ensure signer is ready to handle requests
    // if (this.walletRequestHandler.getSigner() === undefined) {
    //   await this.walletRequestHandler.signerReady()
    // }

    // handle request
    switch (request.type) {
      case EventType.OPEN: {
        if (this._init !== InitState.OK) return
        const session: TransportSession = {
          sessionId: request.data.sessionId,
          intent: request.data.intent,
          networkId: request.data.networkId
        }
        await this.open(session)
        return
      }

      case EventType.CLOSE: {
        if (this._init !== InitState.OK) return
        // noop. just here to capture the message so event emitters may be notified
        return
      }

      case EventType.MESSAGE: {
        const response = await this.walletRequestHandler.sendMessageRequest(request)
        this.sendMessage(response)

        if (response.data.error) {
          // TODO: for certain errors, whenever we want to render something to the UI
          // we should throw
        }
        return
      }

      default: {
        logger.error(`unexpected payload type ${request.type}`)
      }
    }
  }

  // sendMessageRequest sends a ProviderMessageRequest to the wallet post-message transport
  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    return this.walletRequestHandler.sendMessageRequest(message)
  }

  sendMessage(message: ProviderMessage<any>) {
    throw new Error('abstract method')
  }

  notifyOpen(openInfo: { chainId?: string; sessionId?: string; session?: WalletSession; error?: string }) {
    const { chainId, sessionId, session, error } = openInfo
    this.sendMessage({
      idx: -1,
      type: EventType.OPEN,
      data: {
        chainId,
        sessionId,
        session,
        error
      }
    })
  }

  notifyClose(error?: ProviderRpcError) {
    this.sendMessage({
      idx: -1,
      type: EventType.CLOSE,
      data: error ? { error } : null
    })
  }

  notifyConnect(connectDetails: ConnectDetails) {
    this.sendMessage({
      idx: -1,
      type: EventType.CONNECT,
      data: connectDetails
    })
  }

  notifyDisconnect(error?: ProviderRpcError) {
    this.sendMessage({
      idx: -1,
      type: EventType.DISCONNECT,
      data: error ? { error } : null
    })
  }

  notifyAccountsChanged(accounts: string[], origin?: string) {
    this.sendMessage({
      idx: -1,
      type: EventType.ACCOUNTS_CHANGED,
      data: accounts,
      origin: origin
    })
  }

  notifyChainChanged(chainIdHex: string) {
    this.sendMessage({
      idx: -1,
      type: EventType.CHAIN_CHANGED,
      data: chainIdHex
    })
  }

  notifyNetworks(networks: NetworkConfig[]) {
    this.sendMessage({
      idx: -1,
      type: EventType.NETWORKS,
      data: networks
    })
  }

  notifyWalletContext(walletContext: WalletContext) {
    this.sendMessage({
      idx: -1,
      type: EventType.WALLET_CONTEXT,
      data: walletContext
    })
  }

  protected isValidInitAck(message: ProviderMessage<any>): boolean {
    if (this._init === InitState.OK) {
      // we're already in init state, we shouldn't handle this message
      logger.warn("isValidInitAck, already in init'd state, so inquiry is invalid.")
      return false
    }
    if (message.type !== EventType.INIT) {
      logger.warn('isValidInitAck, invalid message type, expecting init')
      return false
    }

    const { sessionId, nonce } = message.data as any as { sessionId: string; nonce: string }
    if (!sessionId || sessionId.length === 0 || !nonce || nonce.length === 0) {
      logger.error('invalid init ack')
      return false
    }
    if (sessionId !== this._sessionId || nonce !== this._initNonce) {
      logger.error('invalid init ack match')
      return false
    }

    // all checks pass, its true
    return true
  }

  private init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // avoid re-init`ing, or if there is a transport which doesn't require
      // it, then it may set this._init to OK in its constructor.
      if (this._init === InitState.OK) {
        resolve()
        return
      }
      if (this._init !== InitState.NIL || this._initCallback) {
        reject('transport init is in progress')
        return
      }

      // start init timeout, if we don't receive confirmation
      // from provider within this amount of time, then we timeout
      const initTimeout = setTimeout(() => {
        logger.warn('transport init timed out')
        if (this._initCallback) {
          this._initCallback('transport init timed out')
        }
      }, PROVIDER_OPEN_TIMEOUT / 2)

      // setup callback as we receive the init message async in the handleMessage function
      this._initCallback = (error?: string) => {
        this._initCallback = undefined // reset
        clearTimeout(initTimeout)
        if (error) {
          reject(error)
        } else {
          this._init = InitState.OK
          resolve()
        }
      }

      // send init request with random nonce to the provider, where we expect
      // for the provider to echo it back to us as complete handshake
      this._initNonce = `${performance.now()}`
      this.sendMessage({
        idx: -1,
        type: EventType.INIT,
        data: { nonce: this._initNonce }
      })
      this._init = InitState.SENT_NONCE

      // NOTE: the promise will resolve in the _initCallback method
      // which will be called from either handleMessage or the initTimeout
    })
  }

  protected open = async ({ sessionId, intent, networkId }: TransportSession): Promise<boolean> => {
    if (sessionId) {
      this._sessionId = sanitizeNumberString(sessionId)
      // persist transport session in localstorage for restoring after redirect/reload
      this.saveTransportSession({ sessionId, intent, networkId })
    }

    this.walletRequestHandler.setOpenIntent(intent)

    // init handshake for certain transports, before we can open the communication.
    //
    // for example, with the window-transport, we have to exchange messages to determine the
    // origin host of the dapp.
    await this.init()

    // Prepare connect options from intent
    if (intent && intent.type === 'connect' && intent.options) {
      const connectOptions = intent.options
      const authorizeOptions: AuthorizationOptions = connectOptions // overlapping types

      // Sanity/integrity check the intent payload, and set authorization origin
      // if its been determined as part of the init handshake from earlier.
      if (this.appOrigin && authorizeOptions?.origin) {
        if (!isBrowserExtension()) {
          if (authorizeOptions.origin !== this.appOrigin) {
            throw new Error('origin is invalid')
          } else {
            // request origin and derived origins match, lets carry on
          }
        }
      } else if (!this.appOrigin && authorizeOptions?.origin) {
        // ie. when we can't determine the origin in our transport, but dapp provides it to us.
        // we just sanitize the origin host.
        connectOptions.origin = sanitizeHost(authorizeOptions.origin)
      } else if (this.appOrigin) {
        // ie. when we auto-determine the origin such as in window-transport
        connectOptions.origin = this.appOrigin
      }
      if (connectOptions.app) {
        connectOptions.app = sanitizeAlphanumeric(connectOptions.app)
      }

      // Set connect options on the walletRequestHandler as our primary
      // wallet controller, and fall back to networkId if necessary
      this.walletRequestHandler.setConnectOptions(connectOptions)
      if (connectOptions.networkId) {
        networkId = connectOptions.networkId
      } else if (networkId) {
        connectOptions.networkId = networkId
      }
    } else {
      this.walletRequestHandler.setConnectOptions(undefined)
    }

    // ensure signer is ready
    await this.walletRequestHandler.getSigner()

    // Notify open and proceed to prompt for connection if intended
    if (!(await this.walletRequestHandler.isSignedIn())) {
      // open wallet without a specific connected chainId, as the user is not signed in
      this.notifyOpen({
        sessionId: this._sessionId
      })
      return true
    } else {
      // prompt user with a connect request. the options will be used as previously set above.
      // upon success, the walletRequestHandler will notify the dapp with the ConnectDetails.
      // upon cancellation by user, the walletRequestHandler will throw an error

      if (intent && intent.type === 'connect') {
        let chainId: number | undefined = undefined
        try {
          if (networkId) {
            chainId = await this.walletRequestHandler.setDefaultNetwork(networkId, false)
          } else {
            chainId = await this.walletRequestHandler.getChainId()
          }
        } catch (err) {
          console.error(err)
        }
        // Failed to set default network on open
        // Fail silently here so we can continue with connect flow and ask
        // user to connect on a different network if necessary
        if (!chainId || chainId <= 0) {
          console.log('Failed to set default network on open')
        }

        // notify wallet is opened, without session details
        this.notifyOpen({
          sessionId: this._sessionId
        })

        try {
          const connectDetails = await this.walletRequestHandler.promptConnect(intent.options)
          if (connectDetails.connected) {
            this.walletRequestHandler.notifyConnect(connectDetails)
          }
        } catch (err) {
          logger.warn('promptConnect not connected:', err)
        } finally {
          // auto-close by default, unless intent is to keep open
          if (!intent.options || intent.options.keepWalletOpened !== true) {
            this.notifyClose()
          }
        }
      } else {
        // Set default network, in case of error chainId will be undefined or 0
        let chainId: number | undefined = undefined
        try {
          if (networkId) {
            chainId = await this.walletRequestHandler.setDefaultNetwork(networkId, false)
          } else {
            chainId = await this.walletRequestHandler.getChainId()
          }
        } catch (err) {
          console.error(err)
        }

        // Failed to set default network on open -- quit + close
        if (!chainId || chainId <= 0) {
          this.notifyOpen({
            sessionId: this._sessionId,
            error: `failed to open wallet on network ${networkId}`
          })
          return false
        }

        // user is already connected, notify session details.
        // TODO: in future, keep list if 'connected' dapps / sessions in the session
        // controller, and only sync with allowed apps
        this.notifyOpen({
          sessionId: this._sessionId,
          chainId: `${chainId}`,
          session: await this.walletRequestHandler.walletSession()
        })
      }
    }

    return true
  }

  private saveTransportSession = (session: TransportSession) => {
    LocalStorage.getInstance().setItem(TRANSPORT_SESSION_LS_KEY, JSON.stringify(session))
  }

  protected getCachedTransportSession = async (): Promise<TransportSession | null> => {
    const session = await LocalStorage.getInstance().getItem(TRANSPORT_SESSION_LS_KEY)

    try {
      return session ? (JSON.parse(session) as TransportSession) : null
    } catch (err) {
      console.error(`unable to parse transport session: ${session}`)
      return null
    }
  }
}
