import {
  ProviderMessageResponse,
  ProviderMessage, ProviderMessageResponseCallback, ProviderMessageType,
  ProviderMessageRequest
} from '../../types'
import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'

import { JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'

export class WindowMessageProvider extends BaseProviderTransport {
  private walletURL: URL
  private walletWindow: Window
  private walletOpened: boolean

  constructor(walletAppURL: string) {
    super()
    this.walletURL = new URL(walletAppURL)
    this.init()
  }

  private init = () => {
    // init postMessage handler between dapp and wallet
    window.addEventListener('message', this.onWindowEvent)
  }

  openWallet = (path?: string, state?: object): void => {
    console.log('window-message', this.walletURL)
    if (this.walletOpened === true) {
      console.log('wallet is opened..')
      if (!path) {
        this.walletWindow.focus()
        return
      } else {
        // URL was changed, closing wallet to open at proper URL
        // TODO: Should be able to just push to new URL without having to re-open
        this.walletWindow.close()
        this.walletWindow = null
      }
    }

    this.connectId = `${performance.now()}`
    this.walletURL.searchParams.set('cid', this.connectId)

    const walletURL = new URL(this.walletURL.href)
    if (path && path !== '') {
      walletURL.pathname = path.toLowerCase()
    }

    // Open popup window on center of the app window
    const windowSize = [450, 700]
    const windowPos = [
      Math.abs(window.screenX+(window.innerWidth/2)-(windowSize[0]/2)),
      Math.abs(window.screenY+(window.innerHeight/2)-(windowSize[1]/2))
    ]

    const windowFeatures =
      `toolbar=0,location=0,menubar=0,scrollbars=yes,status=yes`+
      `,width=${windowSize[0]},height=${windowSize[1]}`+
      `,left=${windowPos[0]},top=${windowPos[1]}`

    const popup = window.open(walletURL.href, 'sequenceWalletApp', windowFeatures)

    // Popup blocking detection and notice
    let warned = false
    const warnPopupBlocked = () => {
      if (warned) return
      warned = true
      // alert('popup is blocked! hey yo') // NOTE: for debug purposes only
      throw new Error('popup is blocked')
    }

    const popupCheck = setTimeout(() => {
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // popup is definitely blocked if we reach here.
        warnPopupBlocked()
      }
    }, 1000)

    const popupBlocked = popup === null || popup === undefined
    if (popupBlocked) {
      warnPopupBlocked()
      return
    }

    // Popup window is available
    this.walletWindow = popup
    this.walletOpened = true

    // Send connection request and wait for confirmation
    if (!this.connected) {
      const initRequest: ProviderMessageRequest = {
        idx: nextMessageIdx(),
        type: ProviderMessageType.CONNECT, // TODO: maybe just use message? and pass { method: '_connect' } ?
        data: null
      }

      const connectCheck = setTimeout(() => {
        if (!this.connected && !warned) {
          warned = true
          // unable to connect after sometime, lets return error notice
          // alert('unable to connect to the wallet') // NOTE: for debug purposes only
          throw new Error('unable to connect to the wallet')
        }
      }, 4000)

      const postMessageUntilConnected = () => {
        if (this.connected || warned) {
          clearTimeout(popupCheck)
          clearTimeout(connectCheck)
          return
        }
        this.sendMessage(initRequest)
        setTimeout(postMessageUntilConnected, 250)
      }
      postMessageUntilConnected()
    }

    // Heartbeat to track if wallet is closed / disconnected
    const interval = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(interval)
        this.walletOpened = false
        this.connected = false
        // TODO/XXX
        // this.loginPayload = undefined
        this.events.emit('disconnect')
      }
    }, 1000)
  }

  closeWallet() {
    this.confirmationOnly = false
    if (this.walletWindow) {
      this.walletWindow.close()
      this.walletWindow = null
    }
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // here, we receive the message from the dapp provider call

    // automatically open the wallet when a provider request makes it here
    if (!this.walletOpened) {
      // toggle the wallet to auto-close once user submits input. ie.
      // prompting to sign a message or transaction
      this.confirmationOnly = true

      // open the wallet
      await this.openWallet()
    } else {
      // TODO: we could add focusWallet() method I guess..?
      // and then we could move this to the base provider ..
      await this.walletWindow.focus()
    }

    // double check, in case wallet failed to open
    if (!this.walletOpened) {
      throw new Error('wallet is not opened.')
    }

    // TODO/XXX
    // TODO: try/catch for errors..? what kind of errors could come up...?
    const response = await this.sendMessageRequest({ idx: nextMessageIdx(), type: ProviderMessageType.MESSAGE, data: request })
    callback(null, response.data)
  }

  // onmessage, receives ProviderMessageResponse from the wallet post-message transport
  private onWindowEvent = (event: MessageEvent) => {
    // Security check, ensure message is coming from wallet origin url
    if (event.origin !== this.walletURL.origin) {
      console.warn(`event.origin '${event.origin}' does not match walletURL.origin '${this.walletURL.origin}'`)
      return
    }
  
    let message: ProviderMessage<any>    
    try {
      message = JSON.parse(event.data)
    } catch (err) {
      // event is not a ProviderMessage JSON object, skip
      return
    }

    if (!message) {
      throw new Error('ProviderMessage object is empty')
    }

    this.handleMessage(message)
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx || message.idx <= 0) {
      throw new Error('message idx is empty')
    }
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
  }
}
