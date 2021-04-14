import { ProviderMessageRequest, ProviderMessage, ProviderMessageType, ProviderMessageResponse } from '../../types'
import { WalletRequestHandler } from '../wallet-request-handler'
import { BaseWalletTransport } from '../base-wallet-transport'
import { sanitizeNumberString } from '@0xsequence/utils'

export interface RegisterOptions {
  loadingPath: string
}

export class WindowMessageHandler extends BaseWalletTransport {
  protected parentWindow: Window
  protected parentOrigin: string

  private _isPopup: boolean = false

  constructor(walletRequestHandler: WalletRequestHandler) {
    super(walletRequestHandler)
  }

  register(options?: RegisterOptions) {
    const isPopup = parent.window.opener !== null
    this._isPopup = isPopup
    if (isPopup !== true) {
      return
    }
    this.parentOrigin = parent.window.origin

    // record open details (sessionId + default network) from the window url
    const location = new URL(window.location.href)
    this._sessionId = sanitizeNumberString(location.searchParams.get('sid')!)
    location.searchParams.delete('sid')

    const defaultNetwork = location.searchParams.get('net')!
    location.searchParams.delete('net')

    const jsonRpcRequest = location.searchParams.get('jsonRpcRequest')

    if (options?.loadingPath && !!jsonRpcRequest) {
      window.history.replaceState({}, document.title, options.loadingPath)
    } else {
      window.history.replaceState({}, document.title, location.pathname)
    }

    // record parent window instance for communication
    this.parentWindow = parent.window.opener

    // listen for window-transport requests
    window.addEventListener('message', this.onWindowEvent, false)
    this._registered = true

    // send open event to the app which opened us
    this.open(defaultNetwork).then(opened => {
      if (!opened) {
        console.error(`failed to open to network ${defaultNetwork}`)
        window.close()
      }
    }).catch(err => {
      console.error(`failed to open to network ${defaultNetwork}, due to: ${err}`)
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
      console.error('origin cannot be empty')
      return
    }

    // Wallet always expects json-rpc request messages from a dapp
    let request: ProviderMessageRequest
    try {
      request = JSON.parse(event.data)
    } catch (err) {
      console.log('unable to parse event, skipping.. event:', event)
      return
    }

    console.log('RECEIVED MESSAGE', request)

    // Handle message via the base transport
    this.handleMessage(request)
  }

  // postMessage sends message to the dapp window
  sendMessage(message: ProviderMessage<any>) {
    const payload = JSON.stringify(message)
    this.parentWindow.postMessage(payload, this.parentOrigin)
  }

  get isPopup(): boolean {
    return this._isPopup
  }
}
