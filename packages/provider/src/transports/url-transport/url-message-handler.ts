import { BaseWalletTransport } from '../base-wallet-transport'
import { WalletRequestHandler } from '../wallet-request-handler'
import {
  EventType,
  InitState,
  OpenWalletIntent,
  ProviderMessage,
  ProviderRpcError,
  TransportSession,
  WindowSessionParams
} from '../../types'
import { base64DecodeObject, base64EncodeObject, logger } from '@0xsequence/utils'

export class UrlMessageHandler extends BaseWalletTransport {
  private _pathname: string
  private _redirectUrl: string = ''
  private _messages: ProviderMessage<any>[] = []

  private _lastMessageAt: number = 0

  constructor(walletRequestHandler: WalletRequestHandler, pathname: string) {
    super(walletRequestHandler)
    this._init = InitState.OK
    this._pathname = pathname
  }

  async register() {
    const { pathname, search: rawParams } = new URL(window.location.href)
    if (pathname !== this._pathname) {
      return
    }

    console.log('... url message handler register ...')

    const params = new URLSearchParams(rawParams)
    const redirectUrl = params.get('redirectUrl')
    const intent = base64DecodeObject(params.get('intent')) as OpenWalletIntent
    this._redirectUrl = redirectUrl!

    console.log('intent', intent)

    // TODO: ensure we have both of these, otherwise just return and skip,
    // maybe though console.warn

    let session: TransportSession | null = this.getWindowTransportSession(rawParams)

    // // provider should always include sid when opening a new window
    const isNewWindowSession = !!session.sessionId

    // // attempt to restore previous session in the case of a redirect or window reload
    if (!isNewWindowSession) {
      session = await this.getCachedTransportSession()
    }

    if (!session) {
      logger.error('window session is undefined')
      return
    }

    this._registered = true
    this.open(session).catch(e => {
      const err = `failed to open to network ${session?.networkId}, due to: ${e}`
      logger.error(err)
      this.notifyClose({ message: err } as ProviderRpcError)
      // redirect?
      // window.close()
    })
  }

  unregister() {}

  sendMessage(message: ProviderMessage<any>) {
    console.log('... sendMessage in url-message-handler ...', message)

    this._messages.push(message)
    this._lastMessageAt = Date.now()

    // temporary, just to send back connect so that we don't navigate for INIT etc.
    setTimeout(() => {
      if (this._lastMessageAt == 0 || this._lastMessageAt + 1000 > Date.now()) {
        return
      } else {
        this._lastMessageAt = 0
        const connect = this._messages.find(m => m.type === EventType.CONNECT)
        const redirectUrl = new URL(this._redirectUrl)
        redirectUrl.searchParams.set('response', base64EncodeObject(connect))
        window.location.href = redirectUrl.href
      }
    }, 1000)
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
