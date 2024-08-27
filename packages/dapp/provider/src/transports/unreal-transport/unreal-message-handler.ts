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
import { logger, base64DecodeObject } from '@0xsequence/utils'
import { overrideLogs } from './overridelogs'

// all lowercase is an annoying limitation of Unreal CEF BindUObject
interface UnrealInjectedWalletWindow {
  ue?: {
    sequencewallettransport?: {
      onmessagefromsequencejs?: (message: ProviderMessageRequest) => void
      sendmessagetosequencejs: (message: string) => void
    }
  }
}
declare const window: Window & typeof globalThis & UnrealInjectedWalletWindow

/**
 * Initialized on Wallet side
 */
export class UnrealMessageHandler extends BaseWalletTransport {
  constructor(walletRequestHandler: WalletRequestHandler) {
    super(walletRequestHandler)
    this._init = InitState.NIL
  }

  async register(windowHref?: string | URL) {
    if (window.ue?.sequencewallettransport === undefined) {
      return
    }
    overrideLogs('wallet')

    // record open details (sessionId + default network) from the window url
    const { search: rawParams } = new URL(windowHref || window.location.href)

    let session: TransportSession | null = this.getUnrealTransportSession(rawParams)

    // provider should always include sid when opening a new window
    const isNewWindowSession = !!session.sessionId

    // attempt to restore previous session in the case of a redirect or window reload
    if (!isNewWindowSession) {
      session = await this.getCachedTransportSession()
    }

    if (!session) {
      logger.error('unreal session is undefined')
      return
    }

    // listen for window-transport requests
    window.ue.sequencewallettransport.onmessagefromsequencejs = this.onMessageFromUnreal
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
    if (window.ue?.sequencewallettransport?.onmessagefromsequencejs === this.onMessageFromUnreal) {
      delete window.ue.sequencewallettransport.onmessagefromsequencejs
    }
    this._registered = false
  }

  // onmessage is called when (the wallet) receives request messages from the dapp
  // over the unreal json-messaging transport
  private onMessageFromUnreal = (request: ProviderMessageRequest) => {
    // Wallet always expects json-rpc request messages from a dapp

    logger.debug('RECEIVED MESSAGE', request)

    // Handle message via the base transport
    this.handleMessage(request)
  }

  // sendMessage sends message to the dapp window
  sendMessage(message: ProviderMessage<any>) {
    if (message.type !== EventType.INIT && this._init !== InitState.OK) {
      logger.error('impossible state, should not be calling postMessage until inited')
      return
    }
    // prepare payload
    const payload = JSON.stringify(message)

    // post-message to app.
    window.ue?.sequencewallettransport?.sendmessagetosequencejs(payload)
  }

  private getUnrealTransportSession = (windowParams: string | undefined): TransportSession => {
    const params = new WindowSessionParams(windowParams)
    return {
      sessionId: params.get('sid'),
      networkId: params.get('net'),
      intent: base64DecodeObject<OpenWalletIntent>(params.get('intent'))
    }
  }
}
