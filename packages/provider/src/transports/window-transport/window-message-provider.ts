import { OpenWalletIntent, ProviderMessage, InitState, EventType } from '../../types'
import { BaseProviderTransport } from '../base-provider-transport'
import { logger, base64EncodeObject } from '@0xsequence/utils'

// ..
let registeredWindowMessageProvider: WindowMessageProvider | undefined

export class WindowMessageProvider extends BaseProviderTransport {
  private walletURL: URL
  private walletWindow: Window | null
  private _init: InitState

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
    if (path && path !== '') {
      walletURL.pathname = path.toLowerCase()
    }

    // Set session, intent and network id on walletURL
    this._init = InitState.NIL
    this._sessionId = `${performance.now()}`
    walletURL.searchParams.set('sid', this._sessionId)
    if (intent) {
      walletURL.searchParams.set('intent', base64EncodeObject(intent))
    }
    if (networkId) {
      walletURL.searchParams.set('net', `${networkId}`)
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

    // TODO: review init, and maybe move it out..?
    // we could also have class-specific if this._inited = true, and we can skip on .open()
    // or on certain transports, we will do the handshake, ie. liek this one..

    // window init
    if (this._init !== InitState.OK) {
      if (message.type === EventType.INIT) {
        logger.debug('WindowMessageProvider, received INIT message', message)
        const { nonce } = message.data as { nonce: string }
        if (!nonce || nonce.length === 0) {
          logger.error('invalid init nonce')
          return
        }
        this._init = InitState.OK
        this.sendMessage({
          idx: -1,
          type: EventType.INIT,
          data: {
            sessionId: this._sessionId,
            nonce: nonce
          }
        }, true)
      }
      return
    }

    // handle message with base message provider
    this.handleMessage(message)
  }

  sendMessage(message: ProviderMessage<any>, skipIdx = false) {
    if (!skipIdx && (!message.idx || message.idx <= 0)) {
      throw new Error('message idx is empty')
    }
    if (!this.walletWindow) {
      logger.warn('WindowMessageProvider: sendMessage failed as walletWindow is unavailable')
      return
    }
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
  }
}
