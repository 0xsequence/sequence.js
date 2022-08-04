import { BaseWalletTransport } from '../base-wallet-transport'
import { WalletRequestHandler } from '../wallet-request-handler'
import { InitState, ProviderMessage } from '../../types'
import { base64DecodeObject } from '@0xsequence/utils'

export class UrlMessageHandler extends BaseWalletTransport {
  
  private _pathname: string

  constructor(walletRequestHandler: WalletRequestHandler, pathname: string) {
    super(walletRequestHandler)
    this._init = InitState.NIL
    this._pathname = pathname
  }

  register() {
    const { pathname, search: rawParams } = new URL(window.location.href)
    if (pathname !== this._pathname) {
      return
    }

    console.log('weeeeeeeeeee')

    const params = new URLSearchParams(rawParams)
    // const request = base64DecodeObject(params.get('request'))
    const redirectUrl = params.get('redirectUrl')

    // TODO: ensure we have both of these, otherwise just return and skip,
    // maybe though console.warn

    console.log('=====> redirecting to.....', redirectUrl)
    {
      (window.location as any).href = redirectUrl
    }

    // this.walletRequestHandler.sendMessageRequest(request).then(response => {
    //   console.log('got the response.......', response)
    // })

  }

  unregister() {
  }

  sendMessage(message: ProviderMessage<any>) {
    // TODO... encode the response and then, call the redirect url..

    console.log('urlMessageHandler sendMessage', message)

    const redirectUrl = 'etc.etc.'

    // TODO: check that window.location exists..

    window.location.href = redirectUrl
  }
}