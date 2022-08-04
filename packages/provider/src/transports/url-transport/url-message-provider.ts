import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'
import {
  ProviderMessage,
  OpenWalletIntent,
  ProviderRpcError,
  ProviderMessageResponse,
  EventType,
  ProviderMessageRequest
} from '../../types'
import { base64EncodeObject } from '@0xsequence/utils'
import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export interface UrlMessageProviderHooks {
  openWallet(walletUrl: string): void

  // TODO: this is not quite right.......
  // listenResponseFromRedirectUrl(callback: (response: ProviderMessage<any>) => void): void
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

    this._registered = true
  }

  unregister = () => {}

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    console.log('url message handler......... openWallet', path, intent)

    this._sessionId = `${performance.now()}`

    const openUrl = this.buildWalletOpenUrl(this._sessionId, path, intent, networkId)

    // const walletRequestUrl = this._walletBaseUrl + '?request=XX&redirectUrl=' + this._redirectUrl
    this._hooks.openWallet(openUrl.toString())
  }

  closeWallet() {
    // this._hooks.closeWallet()
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx) {
      throw new Error('message idx is empty')
    }

    console.log('url message provider......... sendMessage', message)

    const encodedRequest = base64EncodeObject(message)
    const walletUrl = new URL(this._walletBaseUrl)
    walletUrl.searchParams.set('request', encodedRequest)
    walletUrl.searchParams.set('redirectUrl', this._redirectUrl)
    console.log('.... walletURL ..', walletUrl)

    this._hooks.openWallet(walletUrl.toString())
  }

  // sendAsync: (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number | undefined) => Promise<void> {
  //   this.sendMessageRequest({
  //     idx: nextMessageIdx(),
  //     type: EventType.MESSAGE,
  //     data: request,
  //     chainId: chainId
  //   })
  // }

  private buildWalletOpenUrl(sessionId: string, path?: string, intent?: OpenWalletIntent, networkId?: string | number) {
    const walletURL = new URL(this._walletBaseUrl)
    if (path && path !== '') {
      walletURL.pathname = path.toLowerCase()
    }

    // Make sure at least the app name is forced on Mobile SDK and intent is never undefined
    walletURL.searchParams.set('sid', sessionId)
    walletURL.searchParams.set('intent', base64EncodeObject(intent))
    walletURL.searchParams.set('redirectUrl', this._redirectUrl)

    if (networkId) {
      walletURL.searchParams.set('net', `${networkId}`)
    }

    console.log('.... walletURL ..', walletURL.toString())

    return walletURL
  }

  // sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
  //   await this.sendMessageRequest({
  //     idx: nextMessageIdx(),
  //     type: EventType.MESSAGE,
  //     data: request,
  //     chainId: chainId
  //   })
  // }

  // // sendMessageRequest sends a ProviderMessageRequest over the wire to the wallet
  // sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
  //   return new Promise((resolve, reject) => {
  //     if ((!message.idx || message.idx <= 0) && message.type !== 'init') {
  //       reject(new Error('message idx not set'))
  //     }

  //     // const responseCallback: ProviderMessageResponseCallback = (error: ProviderRpcError, response?: ProviderMessageResponse) => {
  //     //   if (error) {
  //     //     reject(error)
  //     //   } else if (response) {
  //     //     resolve(response)
  //     //   } else {
  //     //     throw new Error('no valid response to return')
  //     //   }
  //     // }

  //     // const idx = message.idx
  //     // if (!this.responseCallbacks.get(idx)) {
  //     //   this.responseCallbacks.set(idx, responseCallback)
  //     // } else {
  //     //   reject(new Error('duplicate message idx, should never happen'))
  //     // }

  //     // if (!this.isOpened()) {
  //     //   logger.debug('pushing to pending requests', message)
  //     //   this.pendingMessageRequests.push(message)
  //     // } else {
  //     this.sendMessage(message)
  //     // }
  //   })
  // }
}
