import { ProviderMessage } from '../../types'
import { BaseProviderTransport } from '../base-provider-transport'

// ..
let registeredWindowMessageProvider: WindowMessageProvider

export class WindowMessageProvider extends BaseProviderTransport {
  private walletURL: URL
  private walletWindow: Window

  constructor(walletAppURL: string) {
    super()
    this.walletURL = new URL(walletAppURL)
  }

  register = () => {
    if (registeredWindowMessageProvider) {
      throw new Error('A WindowMessageProvider is already registered. There can only be one.')
    }

    // listen for incoming messages from wallet
    window.addEventListener('message', this.onWindowEvent)
    registeredWindowMessageProvider = this

    // disconnect clean up
    this.on('disconnect', () => {
      if (this.walletWindow) {
        this.walletWindow.close()
        this.walletWindow = undefined
      }
    })

    this.registered = true
  }

  unregister = () => {
    this.registered = false
    this.closeWallet()

    // disable message listener
    if (registeredWindowMessageProvider === this) {
      registeredWindowMessageProvider = undefined
    }
    window.removeEventListener('message', this.onWindowEvent)

    // clear event listeners
    this.events.removeAllListeners()
  }

  openWallet = (path?: string, state?: any, defaultNetworkId?: string | number): void => {
    if (this.walletWindow && this.isConnected()) {
      // TODO: update the location of window to path
      this.walletWindow.focus()
      return
    }

    this.sessionId = `${performance.now()}`
    this.walletURL.searchParams.set('sid', this.sessionId)

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
    // let warned = false
    // const warnPopupBlocked = () => {
    //   if (warned) return
    //   warned = true
    //   // alert('popup is blocked! hey yo') // NOTE: for debug purposes only
    //   throw new Error('popup is blocked')
    // }

    // const popupCheck = setTimeout(() => {
    //   if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    //     // popup is definitely blocked if we reach here.
    //     warnPopupBlocked()
    //   }
    // }, 1000)

    // const popupBlocked = popup === null || popup === undefined
    // if (popupBlocked) {
    //   warnPopupBlocked()
    //   return
    // }

    // Popup window is available
    this.walletWindow = popup

    // Heartbeat to track if window closed
    const interval = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(interval)
        this.disconnect()
      }
    }, 1250)

    // connect to the wallet by sending requests
    this.connect(defaultNetworkId)
  }

  closeWallet() {
    this.disconnect()
  }

  // onmessage, receives ProviderMessageResponse from the wallet post-message transport
  private onWindowEvent = (event: MessageEvent) => {
    // Security check, ensure message is coming from wallet origin url
    if (event.origin !== this.walletURL.origin) {
      // Safetly can skip events not intended for us
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
    if (!this.walletWindow) {
      console.warn('WindowMessageProvider: sendMessage failed as walletWindow is unavailable')
      return
    }
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    // TODO: connecting so fast, we're sending a message so quickly, that in certain instances
    // we receive a target origin failure as the window's origin is not set yet but we're sending anyway
    // The error is annoying, but the system should work correctly.
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
  }
}
