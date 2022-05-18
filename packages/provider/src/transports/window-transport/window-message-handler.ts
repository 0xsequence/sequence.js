import {
  ProviderMessageRequest,
  ProviderMessage,
  EventType,
  InitState,
  WindowSessionParams,
  OpenWalletIntent,
  ProviderRpcError,
  TransportSession
} from '../../types'
import { WalletRequestHandler } from '../wallet-request-handler'
import { BaseWalletTransport } from '../base-wallet-transport'
import { logger, sanitizeNumberString, base64DecodeObject } from '@0xsequence/utils'

export class WindowMessageHandler extends BaseWalletTransport {
  protected parentWindow: Window

  private _isPopup: boolean = false

  constructor(walletRequestHandler: WalletRequestHandler) {
    super(walletRequestHandler)
    this._init = InitState.NIL
  }

  async register(windowHref?: any) {
    const isPopup = parent.window.opener !== null
    this._isPopup = isPopup
    if (isPopup !== true) {
      return
    }

    // record open details (sessionId + default network) from the window url
    const { pathname, search: rawParams } = new URL(windowHref || window.location.href)

    let session: TransportSession | null = this.getWindowTransportSession(rawParams)

    // provider should always include sid when opening a new window
    const isNewWindowSession = !!session.sessionId

    // attempt to restore previous session in the case of a redirect or window reload
    if (!isNewWindowSession) {
      session = await this.getCachedTransportSession()
    }

    if (!session) {
      logger.error('window session is undefined')
      return
    }

    // record parent window instance for communication
    this.parentWindow = parent.window.opener

    // listen for window-transport requests
    window.addEventListener('message', this.onWindowEvent, false)
    this._registered = true

    // send open event to the app which opened us
    this.open(session)
      .then(opened => {
        if (!opened) {
          const err = `failed to open to network ${session?.networkId}`
          logger.error(err)
          this.notifyClose({ message: err } as ProviderRpcError)
          window.close()
        }
      })
      .catch(e => {
        const err = `failed to open to network ${session?.networkId}, due to: ${e}`
        logger.error(err)
        this.notifyClose({ message: err } as ProviderRpcError)
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
    if (this.appOrigin && event.origin !== this.appOrigin) {
      // skip message as not from expected app origin
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

    // Record event origin for valid init ack
    if (this._init !== InitState.OK && this.isValidInitAck(request)) {
      this.appOrigin = event.origin
    }
    if (this._init === InitState.OK && (!this.appOrigin || this.appOrigin.length < 8)) {
      // impossible state
      logger.error('impossible state, init.OK and appOrigin required')
      return
    }

    // Handle message via the base transport
    this.handleMessage(request)
  }

  // postMessage sends message to the dapp window
  sendMessage(message: ProviderMessage<any>) {
    // prepare payload
    const payload = JSON.stringify(message)

    // post-message to app.
    // only for init requests, we send to '*' origin
    if (message.type === EventType.INIT) {
      this.postMessage(payload, true)
    } else {
      this.postMessage(payload)
    }
  }

  get isPopup(): boolean {
    return this._isPopup
  }

  private postMessage(message: any, init = false) {
    if (init !== true && this._init !== InitState.OK) {
      logger.error('impossible state, should not be calling postMessage until inited')
      return
    }

    if (init) {
      // init message transmission to global target -- for 'init' payloads only
      this.parentWindow.postMessage(message, '*')
    } else {
      // open message transmission
      if (this.appOrigin && this.appOrigin.length > 4) {
        // just above '.com'
        this.parentWindow.postMessage(message, this.appOrigin)
      } else {
        logger.error('unable to postMessage as parentOrigin is invalid')
      }
    }
  }

  private getWindowTransportSession = (windowParams: string | undefined): TransportSession => {
    const params = new WindowSessionParams(windowParams)
    return {
      sessionId: params.get('sid'),
      networkId: params.get('net'),
      intent: base64DecodeObject<OpenWalletIntent>(params.get('intent'))
    }
  }
}
