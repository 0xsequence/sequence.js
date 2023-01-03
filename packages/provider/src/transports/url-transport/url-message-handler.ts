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
  private _redirecting: boolean = false
  private _messages: ProviderMessage<any>[] = []

  private _lastMessageAt: number = 0

  constructor(walletRequestHandler: WalletRequestHandler, pathname: string) {
    super(walletRequestHandler)
    this._init = InitState.OK
    this._pathname = pathname
  }

  async register() {
    const { pathname, search: rawParams } = new URL(window.location.href)
    // TODO: do we need this?
    // if (pathname !== this._pathname) {
    //   return
    // }

    console.log('... url message handler register ...')

    const params = new URLSearchParams(rawParams)
    const redirectUrl = params.get('redirectUrl')
    const intent = base64DecodeObject(params.get('intent')) as OpenWalletIntent
    const request = base64DecodeObject(params.get('request')) as ProviderMessage<any>
    this._redirectUrl = redirectUrl!
    console.log('intent', intent)
    console.log('request', request)
    console.log('request data', JSON.stringify(request?.data, null, 2))

    // TODO: ensure we have both of these, otherwise just return and skip,
    // maybe though console.warn

    let session: TransportSession | null = this.getWindowTransportSession(rawParams)

    // provider should always include sid when opening a new window
    const isNewWindowSession = !!session.sessionId

    // attempt to restore previous session in the case of a redirect or window reload
    if (!isNewWindowSession) {
      session = await this.getCachedTransportSession()
    }

    if (!session) {
      logger.error('window session is undefined') //...
      return
    }

    this._registered = true
    this.open(session).catch(e => {
      const err = `failed to open to network ${session?.networkId}, due to: ${e}`
      logger.error(err)
      // this.notifyClose({ message: err } as ProviderRpcError)
      // redirect?sup....??? lalala
      // window.close()
    })

    if (request) {
      console.log('requesting..............', request)
      const response = await this.sendMessageRequest(request)
      this.sendMessage(response)
      console.log('... sendMessageRequest response ...', response)
      console.log('... sendMessageRequest response data ...', JSON.stringify(response, null, 2))
    }
  }

  unregister() {
    this._registered = false
  }

  sendMessage(message: ProviderMessage<any>) {
    if (this._redirecting) {
      return
    }

    console.log('...URL-HANDLER (wallet) sendMessage in url-message-handler ...', message)
    console.log('...URL-HANDLER (wallet) sendMessage data ...', message.data)

    if (message.type === EventType.OPEN) {
      console.log('open message, but well skip it..')
      return
    }

    // TODO: remove this.. we want to keep close..
    if (message.type === EventType.CLOSE) {
      console.log('close message, but well skip it..')
      return
    }

    // NOTE: maybe we check the 'connect' object, and we shorten it..? it will be quite long
    // .. we can just rely on the lib to have all of the networks listed..? if anything
    // we can just return a list like networks: [1, 137, etc..]

    // respond with the first message, no waiting around.. take the first message
    this._redirecting = true
    const redirectUrl = new URL(this._redirectUrl)
    redirectUrl.hash = 'response='+base64EncodeObject(message)
    window.location.href = redirectUrl.href


    // this._messages.push(message)
    // this._lastMessageAt = Date.now()

    // // temporary, just to send back connect so that we don't navigate for INIT etc.
    // //..
    // setTimeout(() => {
    // //   if (this._lastMessageAt == 0 || this._lastMessageAt + 1000 > Date.now()) {
    // //     return
    // //   } else {
    // //     this._lastMessageAt = 0
    //     const connectMessage = this._messages.find(m => m.type === EventType.CONNECT)
    //     if (connectMessage) {
    //       this._redirecting = true
    //       const redirectUrl = new URL(this._redirectUrl)
    //       redirectUrl.hash = 'response='+base64EncodeObject(message)
    //       window.location.href = redirectUrl.href
    //     }
    // //     const lastMessage = this._messages[this._messages.length - 1]
    // //     const redirectUrl = new URL(this._redirectUrl)

    // //     redirectUrl.hash = 'response='+base64EncodeObject(connectMessage ?? lastMessage)

    // //     // redirectUrl.searchParams.set('response', base64EncodeObject(connectMessage ?? lastMessage))

    // //     window.location.href = redirectUrl.href
    // //   }
    // }, 3000)
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
