import { OpenWalletIntent, ProviderMessage, InitState, EventType, WindowSessionParams } from '../../types'
import { BaseProviderTransport } from '../base-provider-transport'
import { logger, base64EncodeObject } from '@0xsequence/utils'
import { isBrowserExtension, isUnityPlugin } from '../../utils'

// ..
let registeredWindowMessageProvider: WindowMessageProvider | undefined

export class WindowMessageProvider extends BaseProviderTransport {
  private walletURL: URL
  private walletWindow: Window | null

  constructor(walletAppURL: string) {
    super()
    this.walletURL = new URL(walletAppURL)
  }

  register = () => {
    if (registeredWindowMessageProvider) {
      // overriding the registered message provider
      registeredWindowMessageProvider.unregister()
      registeredWindowMessageProvider = this
    }

    // listen for incoming messages from wallet
    window.addEventListener('message', this.onWindowEvent)
    registeredWindowMessageProvider = this

    // open heartbeat
    this.on('open', () => {
      // Heartbeat to track if window closed
      const popup = this.walletWindow
      const interval = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(interval)
          this.close()
        }
      }, 500)
    })

    // close clean up
    this.on('close', () => {
      if (this.walletWindow) {
        this.walletWindow.close()
        this.walletWindow = null
      }
    })

    this._registered = true
  }

  unregister = () => {
    this._registered = false
    this.closeWallet()

    // disable message listener
    if (registeredWindowMessageProvider === this) {
      registeredWindowMessageProvider = undefined
    }
    window.removeEventListener('message', this.onWindowEvent)

    // clear event listeners
    this.events.removeAllListeners()
  }

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    if (this.walletWindow && this.isOpened()) {
      // TODO: update the location of window to path
      this.walletWindow.focus()
      return
    }

    // Instantiate new walletURL for this call
    const walletURL = new URL(this.walletURL.href)
    const windowSessionParams = new WindowSessionParams()

    if (path && path !== '') {
      walletURL.pathname = path.toLowerCase()
    }

    // Set session, intent and network id on walletURL
    this._init = InitState.NIL
    this._sessionId = `${performance.now()}`
    windowSessionParams.set('sid', this._sessionId)

    if (intent) {
      // for the window-transport, we eagerly/optimistically set the origin host
      // when connecting to the wallet, however, this will be verified and enforced
      // on the wallet-side, so if a dapp provides the wrong origin, it will be dropped.
      if (intent.type === 'connect') {
        if (!intent.options) intent.options = {}

        // skip setting origin host if we're in an browser extension execution context
        // allow origin that is passed in
        if (!isBrowserExtension() && !isUnityPlugin()) {
          intent.options.origin = window.location.origin
        }
      }
      // encode intent as base64 url-encoded param
      windowSessionParams.set('intent', base64EncodeObject(intent))
    }
    if (networkId) {
      windowSessionParams.set('net', `${networkId}`)
    }

    // Open popup window on center of the app window
    let windowSize: number[]
    let windowPos: number[]

    if (isBrowserExtension()) {
      windowSize = [450, 750]
      windowPos = [Math.abs(window.screen.width / 2 - windowSize[0] / 2), Math.abs(window.screen.height / 2 - windowSize[1] / 2)]
    } else {
      windowSize = [450, 750]
      windowPos = [
        Math.abs(window.screenX + window.innerWidth / 2 - windowSize[0] / 2),
        Math.abs(window.screenY + window.innerHeight / 2 - windowSize[1] / 2)
      ]
    }

    const windowFeatures =
      `toolbar=0,location=0,menubar=0,scrollbars=yes,status=yes` +
      `,width=${windowSize[0]},height=${windowSize[1]}` +
      `,left=${windowPos[0]},top=${windowPos[1]}`

    // serialize params
    walletURL.search = windowSessionParams.toString()

    this.walletWindow = window.open(walletURL.href, 'sequence.app', windowFeatures)

    // TODO: move this somewhere else
    // TODO: perhaps we trigger a .on('openTimeout') event..? maybe.. could help.

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
  }

  closeWallet() {
    this.close()
    this.walletWindow?.close()
  }

  // onmessage, receives ProviderMessageResponse from the wallet post-message transport
  private onWindowEvent = (event: MessageEvent) => {
    // Security check, ensure message is coming from wallet origin url
    if (event.origin !== this.walletURL.origin) {
      // Safetly can skip events not from the wallet
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

    // handle message with base message provider
    this.handleMessage(message)
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!this.walletWindow) {
      logger.warn('WindowMessageProvider: sendMessage failed as walletWindow is unavailable')
      return
    }
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
  }
}
