import {
  ProviderMessageRequest,
  ProviderMessage,
  ProviderMessageType,
  ProviderMessageResponse,
  InitState,
  ConnectDetails
} from '../../types'
import { WalletRequestHandler } from '../wallet-request-handler'
import { BaseWalletTransport } from '../base-wallet-transport'
import { logger, sanitizeNumberString } from '@0xsequence/utils'

export class WindowMessageHandler extends BaseWalletTransport {
  protected parentWindow: Window
  protected parentOrigin?: string

  private _isPopup: boolean = false

  private _initNonce: string
  private _postMessageQueue: Array<any> = []

  constructor(walletRequestHandler: WalletRequestHandler) {
    super(walletRequestHandler)
    this._init = InitState.NIL
  }

  register() {
    const isPopup = parent.window.opener !== null
    this._isPopup = isPopup
    if (isPopup !== true) {
      return
    }

    // record open details (sessionId + default network) from the window url
    const location = new URL(window.location.href)

    // TODO: add typings
    const params = Object.fromEntries(new URLSearchParams(location.search))

    this._sessionId = sanitizeNumberString(params['sid'])

    if (this._sessionId.length === 0) {
      logger.error('invalid sessionId')
      return
    }

    const defaultNetwork = params['net']

    const toBool = (s: string) => s === 'true'

    if (toBool(params['requestAuthorization'])) {
      this.walletRequestHandler
        .promptConnect({
          refresh: toBool(params['refresh']),
          requestEmail: toBool(params['requestEmail']),
          requestAuthorization: toBool(params['requestAuthorization']),
          appName: params['appName'],
          // TODO: use parentOrigin .. but its currently not being set before register()
          // use origin from walletURL param for now.
          // internal
          origin: params['origin']
        })
        .then((connectDetails: ConnectDetails) => {
          this.notifyAuthorized(connectDetails)
        })
        .catch(error => {
          throw error
        })
    } else {
      window.history.replaceState(params['jsonRpcRequest'] ? { jsonRpcRequest: true } : {}, document.title, location.pathname)
    }

    // record parent window instance for communication
    this.parentWindow = parent.window.opener

    // listen for window-transport requests
    window.addEventListener('message', this.onWindowEvent, false)
    this._registered = true

    // send open event to the app which opened us
    this.open(defaultNetwork)
      .then(opened => {
        if (!opened) {
          logger.error(`failed to open to network ${defaultNetwork}`)
          window.close()
        }
      })
      .catch(err => {
        logger.error(`failed to open to network ${defaultNetwork}, due to: ${err}`)
        window.close()
      })
  }

  unregister() {
    window.removeEventListener('message', this.onWindowEvent)
    this._registered = false
  }

  // onmessage is called when (the wallet) receives request messages from the dapp
  // over the window post-messaging transport
  private onWindowEvent = async (event: MessageEvent) => {
    if (!event.origin || event.origin === '') {
      // skip same-origin or when event.origin is empty/undefined
      return
    }
    if (this.parentOrigin && event.origin !== this.parentOrigin) {
      // skip message as not from expected app origin
      return
    }
    if (this._init === InitState.OK && (!this.parentOrigin || this.parentOrigin.length < 8)) {
      // impossible state
      logger.error('impossible state, init.OK and parentOrigin required')
      return
    }

    // Wallet always expects json-rpc request messages from a dapp
    let request: ProviderMessageRequest
    try {
      request = JSON.parse(event.data)
    } catch (err) {
      // event is not a ProviderMessage JSON object, skip
      return
    }

    logger.debug('RECEIVED MESSAGE', request)

    // Record the parent origin url on init
    if (this._init !== InitState.OK) {
      if (request.type === ProviderMessageType.INIT) {
        const { sessionId, nonce } = (request.data as any) as { sessionId: string; nonce: string }
        if (!sessionId || sessionId.length === 0 || !nonce || nonce.length === 0) {
          logger.error('invalid init response')
          return
        }
        if (sessionId !== this._sessionId || nonce !== this._initNonce) {
          logger.error('invalid init match')
          return
        }
        this._init = InitState.OK
        this.parentOrigin = event.origin
        this.flushPostMessageQueue()
      } else {
        // we expect init message first
      }
      return
    }

    // Handle message via the base transport
    this.handleMessage(request)
  }

  // postMessage sends message to the dapp window
  sendMessage(message: ProviderMessage<any>) {
    if (message.type === ProviderMessageType.INIT) {
      // clients should not send init requests directly
      return
    }

    // prepare payload
    const payload = JSON.stringify(message)

    // queue sending messages until we're inited
    if (this._init !== InitState.OK) {
      this._postMessageQueue.push(payload)
    }

    // init stage + check
    if (this._init === InitState.NIL) {
      this._initNonce = `${performance.now()}`
      this.parentWindow.postMessage(
        JSON.stringify({
          idx: -1,
          type: ProviderMessageType.INIT,
          data: { nonce: this._initNonce }
        } as ProviderMessage<any>),
        '*'
      )
      this._init = InitState.SENT_NONCE
      return
    } else if (this._init !== InitState.OK) {
      return
    }

    // post-message to app
    this.postMessage(payload)
  }

  get isPopup(): boolean {
    return this._isPopup
  }

  private flushPostMessageQueue() {
    if (this._postMessageQueue.length === 0) return

    // logger.debug(`flushPostMessageQueue # of messages, ${this._postMessageQueue.length}`)
    for (let i = 0; i < this._postMessageQueue.length; i++) {
      this.postMessage(this._postMessageQueue[i])
    }
    this._postMessageQueue.length = 0
  }

  private postMessage(message: any) {
    if (this._init !== InitState.OK) {
      logger.error('impossible state, should not be calling postMessage until inited')
      return
    }
    if (this.parentOrigin && this.parentOrigin.length > 8) {
      this.parentWindow.postMessage(message, this.parentOrigin)
    } else {
      logger.error('unable to postMessage as parentOrigin is invalid')
    }
  }
}
