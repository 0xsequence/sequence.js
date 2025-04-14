import {
  ProviderMessage,
  ProviderTransport,
  ProviderEventTypes,
  ProviderMessageRequest,
  ProviderMessageResponse,
  WalletSession,
  OpenWalletIntent,
  ConnectDetails
} from '../../types'

import { ProxyMessageChannelPort, ProxyMessageProvider } from '../proxy-transport'
import { Runtime } from 'webextension-polyfill'
import { UnrealMessageProvider } from '../unreal-transport'
import { ExtensionMessageProvider } from '../extension-transport'
import { WindowMessageProvider } from '../window-transport'
import { JsonRpcResponse } from '@0xsequence/network'

export type MuxTransportTemplate = {
  walletAppURL?: string

  // WindowMessage transport (optional)
  windowTransport?: {
    enabled: boolean
  }

  // ProxyMessage transport (optional)
  proxyTransport?: {
    enabled: boolean
    appPort?: ProxyMessageChannelPort
  }

  // Extension transport (optional)
  extensionTransport?: {
    enabled: boolean
    runtime: Runtime.Static
  }

  // Unreal Engine transport (optional)
  unrealTransport?: {
    enabled: boolean
  }
}

export function isMuxTransportTemplate(obj: any): obj is MuxTransportTemplate {
  return (
    obj &&
    typeof obj === 'object' &&
    ((obj.windowTransport && typeof obj.windowTransport === 'object') ||
      (obj.proxyTransport && typeof obj.proxyTransport === 'object') ||
      (obj.extensionTransport && typeof obj.extensionTransport === 'object') ||
      (obj.unrealTransport && typeof obj.unrealTransport === 'object')) &&
    // One of the transports must be enabled
    ((obj.windowTransport && obj.windowTransport.enabled) ||
      (obj.proxyTransport && obj.proxyTransport.enabled) ||
      (obj.extensionTransport && obj.extensionTransport.enabled) ||
      (obj.unrealTransport && obj.unrealTransport.enabled))
  )
}

export class MuxMessageProvider implements ProviderTransport {
  private messageProviders: ProviderTransport[]
  private provider: ProviderTransport | undefined

  constructor(messageProviders: ProviderTransport[] = []) {
    this.messageProviders = messageProviders
    this.provider = undefined
  }

  static new(template: MuxTransportTemplate, projectAccessKey?: string): MuxMessageProvider {
    const muxMessageProvider = new MuxMessageProvider()

    if (template.windowTransport?.enabled && typeof window === 'object' && template.walletAppURL) {
      const windowMessageProvider = new WindowMessageProvider(template.walletAppURL, projectAccessKey)
      muxMessageProvider.add(windowMessageProvider)
    }

    if (template.proxyTransport?.enabled) {
      const proxyMessageProvider = new ProxyMessageProvider(template.proxyTransport.appPort!)
      muxMessageProvider.add(proxyMessageProvider)
    }

    if (template.extensionTransport?.enabled) {
      const extensionMessageProvider = new ExtensionMessageProvider(template.extensionTransport.runtime)
      muxMessageProvider.add(extensionMessageProvider)

      // NOTE/REVIEW: see note in mux-message-provider
      //
      // We don't add the extensionMessageProvider here because we don't send requests to it anyways, we seem to
      // send all requests to the WindowMessageProvider anyways. By allowing it, if browser restarts, it will break
      // the entire extension because messageProvider.provider will be undefined. So this is a hack to fix it.
    }

    if (template.unrealTransport?.enabled && template.windowTransport && template.walletAppURL) {
      const unrealMessageProvider = new UnrealMessageProvider(template.walletAppURL)
      muxMessageProvider.add(unrealMessageProvider)
    }

    muxMessageProvider.register()

    return muxMessageProvider
  }

  add(...messageProviders: ProviderTransport[]) {
    this.messageProviders.push(...messageProviders)
  }

  register = () => {
    if (this.messageProviders.length === 1) {
      this.provider = this.messageProviders[0]
      this.provider.register()
      return
    }

    // REVIEW/NOTE: ........ this method does not work for the chrome-extension. The issue becomes
    // when the browser quits or restarts, the "open" event is never triggered. Perhaps the code here is fine,
    // or maybe its not. What should happen is when a dapp makes a request, it will call openWallet
    // below, in which case one of the events will register. So perhaps this is fine.
    this.messageProviders.forEach(m => {
      m.register()

      m.once('open', () => {
        // the first one to open is the winner, and others will be unregistered
        if (!this.provider) {
          this.provider = m

          // unregister other providers
          this.messageProviders.forEach(m => {
            if (this.provider !== m) {
              m.unregister()
            }
          })
        }
      })
    })
  }

  unregister = () => {
    this.messageProviders.forEach(m => m.unregister())
    this.provider = undefined
  }

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    if (this.provider) {
      this.provider.openWallet(path, intent, networkId)
      return
    }
    this.messageProviders.forEach(m => m.openWallet(path, intent, networkId))
  }

  closeWallet() {
    if (this.provider) {
      this.provider.closeWallet()
    }
  }

  isOpened(): boolean {
    if (this.provider) {
      return this.provider.isOpened()
    }
    return false
  }

  isConnected(): boolean {
    if (this.provider) {
      return this.provider.isConnected()
    }
    return false
  }

  on<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    if (this.provider) {
      this.provider.on(event, fn)
      return
    }
    this.messageProviders.forEach(m => {
      m.on(event, fn)
    })
  }

  once<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    if (this.provider) {
      this.provider.once(event, fn)
      return
    }
    this.messageProviders.forEach(m => {
      m.once(event, fn)
    })
  }

  emit<K extends keyof ProviderEventTypes>(event: K, ...args: Parameters<ProviderEventTypes[K]>): boolean {
    if (this.provider) {
      return this.provider.emit(event, ...args)
    }
    for (let i = 0; i < this.messageProviders.length; i++) {
      this.messageProviders[i].emit(event, ...args)
    }
    return true
  }

  request(request: { method: string; params?: any[]; chainId?: number }): Promise<any> {
    if (!this.provider) {
      throw new Error('impossible state, wallet must be opened first')
    }
    return this.provider.request(request)
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx || message.idx <= 0) {
      throw new Error('message idx is empty')
    }

    if (this.provider) {
      this.provider.sendMessage(message)
    } else {
      throw new Error('impossible state, wallet must be opened first')
    }
  }

  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    if (this.provider) {
      return this.provider.sendMessageRequest(message)
    }
    throw new Error('impossible state, wallet must be opened first')
  }

  handleMessage(message: ProviderMessage<any>): void {
    if (this.provider) {
      this.provider.handleMessage(message)
      return
    }
    throw new Error('impossible state, wallet must be opened first')
  }

  waitUntilOpened = async (): Promise<WalletSession | undefined> => {
    if (this.provider) {
      return this.provider.waitUntilOpened()
    }
    return Promise.race(this.messageProviders.map(p => p.waitUntilOpened()))
  }

  waitUntilConnected = async (): Promise<ConnectDetails> => {
    if (this.provider) {
      return this.provider.waitUntilConnected()
    }
    throw new Error('impossible state, wallet must be opened first')
  }
}
