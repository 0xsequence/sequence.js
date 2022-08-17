import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'
import { ProviderMessage, OpenWalletIntent, EventType, WalletSession, InitState } from '../../types'
import { base64DecodeObject, base64EncodeObject } from '@0xsequence/utils'
import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export interface UrlMessageProviderHooks {
  openWallet(walletUrl: string): void

  responseFromRedirectUrl(callback: (response: string) => void): void
}

export class UrlMessageProvider extends BaseProviderTransport {
  private _walletBaseUrl: string
  private _redirectUrl: string
  private _hooks: UrlMessageProviderHooks

  constructor(walletBaseUrl: string, redirectUrl: string, hooks: UrlMessageProviderHooks) {
    super()
    this._init = InitState.OK
    this._walletBaseUrl = walletBaseUrl
    this._redirectUrl = redirectUrl
    this._hooks = hooks
  }

  register = async () => {
    this._hooks.responseFromRedirectUrl((response: string) => {
      const decodedResponse = base64DecodeObject(response) as ProviderMessage<any>
      console.log('... we have a response...', decodedResponse)
      this.handleMessage(decodedResponse)
    })

    this._registered = true
  }

  unregister = () => {}

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    console.log('url message provider......... openWallet', path, intent)

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

  private buildWalletOpenUrl(
    sessionId: string,
    path?: string,
    intent?: OpenWalletIntent,
    networkId?: string | number,
    request?: string
  ): URL {
    const walletURL = new URL(this._walletBaseUrl)
    if (path && path !== '') {
      walletURL.pathname = path.toLowerCase()
    }

    // Make sure at least the app name is forced on Mobile SDK and intent is never undefined
    walletURL.searchParams.set('sid', sessionId)
    if (intent) {
      walletURL.searchParams.set('intent', base64EncodeObject(intent))
    }
    walletURL.searchParams.set('redirectUrl', this._redirectUrl)
    if (request) {
      walletURL.searchParams.set('request', request)
    }

    if (networkId) {
      walletURL.searchParams.set('net', `${networkId}`)
    }

    console.log('.... walletURL ..', walletURL.toString())

    return walletURL
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    console.log('... url message provider......... sendAsync', request)
    const encodedRequest = base64EncodeObject({
      idx: nextMessageIdx(),
      type: EventType.MESSAGE,
      data: request,
      chainId: chainId
    })

    const openUrl = this.buildWalletOpenUrl(this._sessionId!, undefined, undefined, chainId, encodedRequest)
    this._hooks.openWallet(openUrl.href)
  }

  waitUntilOpened = async (openTimeout = 0): Promise<WalletSession | undefined> => {
    return undefined
  }

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
