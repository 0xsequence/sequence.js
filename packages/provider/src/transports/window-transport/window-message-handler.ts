import { ProviderMessageRequest, ProviderMessage, ProviderMessageType, ProviderMessageResponse } from '../../types'
import { WalletRequestHandler } from '../wallet-request-handler'
import { BaseWalletTransport } from '../base-wallet-transport'
import { JsonRpcRequest, JsonRpcResponseCallback } from '../../json-rpc'

export class WindowMessageHandler extends BaseWalletTransport {
  protected parentWindow: Window
  protected parentOrigin: string

  private _isPopup: boolean = false

  constructor(walletRequestHandler: WalletRequestHandler) {
    super(walletRequestHandler)
  }

  register() {
    document.addEventListener('DOMContentLoaded', event => {
      const isPopup = parent.window.opener !== null
      this._isPopup = isPopup
      if (isPopup !== true) {
        return
      }

      // record parent window instance for communication
      this.parentWindow = parent.window.opener

      // listen for window-transport requests
      window.addEventListener('message', this.onWindowEvent, false)

      // init base transport
      this.init()
    })
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

    console.log('RECEIVED EVENT', event)

    // Record the parent origin url on connect
    if (request.type == ProviderMessageType.CONNECT) {
      if (!this.parentOrigin || this.parentOrigin === '') {
        if (!event.origin || event.origin === '') {
          console.warn('event.origin is empty, window transport will fail.')
        } else {
          this.parentOrigin = event.origin
        }
      }
    }

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
