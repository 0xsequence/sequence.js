import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'
import { Wallet } from '../../wallet'
import { ProviderMessage, OpenWalletIntent, EventType, WalletSession, InitState, ConnectDetails, ProviderEventTypes } from '../../types'
import { base64DecodeObject, base64EncodeObject } from '@0xsequence/utils'
import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export interface UrlMessageProviderHooks {
  openWallet(walletUrl: string): void

  // responseFromRedirectUrl(callback: (response: string) => void): void
  responseFromRedirectUrl(response: string): void
}

export class UrlMessageProvider extends BaseProviderTransport {
  private _wallet: Wallet
  private _walletBaseUrl: string
  private _redirectUrl: string
  private _hooks: UrlMessageProviderHooks
  private _connectDetails: ConnectDetails | undefined

  constructor(wallet: Wallet, walletBaseUrl: string, redirectUrl: string, hooks: UrlMessageProviderHooks) {
    super()
    console.log('UrlMessageProvider walletBaseUrl:', walletBaseUrl)
    this._init = InitState.OK
    this._wallet = wallet
    this._walletBaseUrl = walletBaseUrl
    this._redirectUrl = redirectUrl
    this._hooks = hooks
  }

  on<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.on(event, fn as any)
    if (event === 'connect' && this._connectDetails) {
        this.events.emit('connect', this._connectDetails)
    }
  }

  once<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.once(event, fn as any)
    if (event === 'connect' && this._connectDetails) {
        this.events.emit('connect', this._connectDetails)
    }
  }

  register = async () => {
    console.log('... URL MESSAGE PROVIDER ... register...????')

    this.events.on('connect', connectDetails => {
      console.log('url messagep provider got connect, connectDetails..', connectDetails)
      this._connectDetails = connectDetails

      if (connectDetails.connected) {
        if (!!connectDetails.session) {
          this._wallet.useSession(connectDetails.session, true)  
          // this.addConnectedSite(options?.origin)
        } else {
          throw new Error('impossible state, connect response is missing session')
        }
      }
    })

    this._hooks.responseFromRedirectUrl = (response: string) => {
      const decodedResponse = base64DecodeObject(response) as ProviderMessage<any>
      console.log('... we have a response...zzzzzz', decodedResponse)
      this.handleMessage(decodedResponse)
    }

    this._registered = true

    // const windowURL = new URL(window.location.href)
    const prefix = '#response='
    console.log('sup....??? lalala', window.location.hash)
    if (window.location.hash.startsWith(prefix)) {
      const response = window.location.hash.substring(prefix.length)
      console.log('=> response', response)
      window.location.hash = ''
      this._hooks.responseFromRedirectUrl(response)
    }
  }

  unregister = () => {
    this._registered = false
    // this._hooks ..?
  }

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
    // noop
    return undefined
  }

}
