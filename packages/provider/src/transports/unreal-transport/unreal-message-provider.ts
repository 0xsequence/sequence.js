import { OpenWalletIntent, ProviderMessage, InitState, WindowSessionParams } from '../../types'
import { BaseProviderTransport } from '../base-provider-transport'
import { base64EncodeObject } from '@0xsequence/utils'
import { overrideLogs } from './overridelogs'

let registeredUnrealMessageProvider: UnrealMessageProvider | undefined

// all lowercase is an annoying limitation of Unreal CEF BindUObject
interface UnrealInjectedSequenceJSWindow {
  ue?: {
    sequencewallettransport?: {
      onmessagefromwallet?: (message: ProviderMessage<any>) => void
      sendmessagetowallet: (message: string) => void
    }
  }
}

declare const window: Window & typeof globalThis & UnrealInjectedSequenceJSWindow

/**
 * Initialized on dApp side
 */
export class UnrealMessageProvider extends BaseProviderTransport {
  private walletURL: URL

  constructor(walletAppURL: string) {
    super()
    this.walletURL = new URL(walletAppURL)
  }

  register = () => {
    overrideLogs('dapp')
    if (registeredUnrealMessageProvider) {
      // overriding the registered message provider
      registeredUnrealMessageProvider.unregister()
      registeredUnrealMessageProvider = this
    }

    // listen for incoming messages from wallet
    if (window.ue?.sequencewallettransport) {
      window.ue.sequencewallettransport.onmessagefromwallet = this.onUnrealCallback
    }
    registeredUnrealMessageProvider = this

    this._registered = true
    console.log('registering transport!')
  }

  unregister = () => {
    this._registered = false
    this.closeWallet()

    // disable message listener
    if (registeredUnrealMessageProvider === this) {
      registeredUnrealMessageProvider = undefined
    }
    if (window.ue?.sequencewallettransport?.onmessagefromwallet === this.onUnrealCallback) {
      delete window.ue.sequencewallettransport.onmessagefromwallet
    }

    // clear event listeners
    this.events.removeAllListeners()
  }

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    if (this.isOpened()) {
      // TODO focus wallet
      console.log('wallet already open!')
      return
    }

    console.log('opening wallet!')
    // Instantiate new walletURL for this call
    const walletURL = new URL(this.walletURL.href)
    const windowSessionParams = new WindowSessionParams()

    if (path) {
      walletURL.pathname = path.toLowerCase()
    }

    // Set session, intent and network id on walletURL
    this._init = InitState.NIL
    this._sessionId = `${performance.now()}`
    windowSessionParams.set('sid', this._sessionId)

    if (intent) {
      // encode intent as base64 url-encoded param
      windowSessionParams.set('intent', base64EncodeObject(intent))
    }
    if (networkId) {
      windowSessionParams.set('net', `${networkId}`)
    }
    // serialize params
    walletURL.search = windowSessionParams.toString()

    console.log('opening wallet to', walletURL.href)

    window.open(walletURL.href)
  }

  closeWallet() {
    this.close()
  }

  // onmessage, receives ProviderMessageResponse from the wallet unreal transport
  private onUnrealCallback = (message: ProviderMessage<any>) => {
    if (!message) {
      throw new Error('ProviderMessage object is empty')
    }

    // handle message with base message provider
    this.handleMessage(message)
  }

  // all lowercase is an annoying limitation of Unreal CEF BindUObject
  sendMessage(message: ProviderMessage<unknown>) {
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    console.log('Sending message to wallet:', postedMessage)
    window.ue?.sequencewallettransport?.sendmessagetowallet(postedMessage)
  }
}
