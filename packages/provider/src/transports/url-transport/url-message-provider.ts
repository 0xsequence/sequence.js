import { BaseProviderTransport } from '../base-provider-transport'
import { ProviderMessage, OpenWalletIntent, ProviderRpcError, ProviderMessageResponse } from '../../types'
import { base64EncodeObject } from '@0xsequence/utils'

export interface UrlMessageProviderHooks {
  openWallet(walletBaseUrl: string, path?: string, intent?: OpenWalletIntent, networkId?: string | number): void
  // ...

  openWallet2(walletUrl: string): void

  // TODO: this is not quite right.......
  fetchResponseFromRedirectUrl(): Promise<{error?: ProviderRpcError, response?: ProviderMessageResponse}>
}

export class UrlMessageProvider extends BaseProviderTransport {
  private _walletBaseUrl: string
  private _redirectUrl: string
  private _hooks: UrlMessageProviderHooks
  
  constructor(walletBaseUrl: string, redirectUrl: string, hooks: UrlMessageProviderHooks) {
    super()
    this._walletBaseUrl = walletBaseUrl
    this._redirectUrl = redirectUrl
    this._hooks = hooks
  }

  register = async () => {
    // TODO: setup listener on the redirect url... so we can handle the response back....
    // ......... handleRedirectResponse()
    // on the deep-link which matches 

    // TODO ..... not quite right.. but here for brainstorming / prototyping ......
    const { error, response } =  await this._hooks.fetchResponseFromRedirectUrl()
    console.log('...', error, response)
  }

  unregister = () => {
  }

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    console.log('url message handler......... openWallet', path, intent)

    const walletRequestUrl = this._walletBaseUrl + '?request=XX&redirectUrl=' + this._redirectUrl
    this._hooks.openWallet(walletRequestUrl, path, intent, networkId)
  }

  closeWallet() {
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx) {
      throw new Error('message idx is empty')
    }

    const encodedRequest = base64EncodeObject(message)
    const walletUrl = new URL(this._walletBaseUrl)
    walletUrl.searchParams.set('request', encodedRequest)
    walletUrl.searchParams.set('redirectUrl', this._redirectUrl)
    console.log('.... walletURL ..', walletUrl)

    this._hooks.openWallet2(`${walletUrl}`)
  }

  private buildWalletRequestUrl() {

  }
}
