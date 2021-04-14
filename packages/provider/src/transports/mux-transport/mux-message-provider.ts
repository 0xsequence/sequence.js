import {
  ProviderMessage, ProviderMessageType, ProviderTransport,
  ProviderMessageEvent, ProviderMessageRequest, ProviderMessageResponse, WalletSession, OpenWalletIntent
} from '../../types'

import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export class MuxMessageProvider implements ProviderTransport {

  private messageProviders: ProviderTransport[]
  private provider: ProviderTransport | undefined

  constructor(...messageProviders: ProviderTransport[]) {
    this.messageProviders = messageProviders
    this.provider = undefined
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

  openWallet = (path?: string, intent?: OpenWalletIntent, defaultNetworkId?: string | number): void => {
    if (this.provider) {
      this.provider.openWallet(path, intent, defaultNetworkId)
      return
    }
    this.messageProviders.forEach(m => m.openWallet(path, intent, defaultNetworkId))
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

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    if (this.provider) {
      this.provider.on(event, fn)
      return
    }
    this.messageProviders.forEach(m => {
      m.on(event, fn)
    })
  }

  once(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    if (this.provider) {
      this.provider.once(event, fn)
      return
    }
    this.messageProviders.forEach(m => {
      m.once(event, fn)
    })
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    if (this.provider) {
      this.provider.sendAsync(request, callback, chainId)
      return
    }
    throw new Error('impossible state, wallet must be opened first')
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

  waitUntilOpened = async (): Promise<boolean> => {
    if (this.provider) {
      return this.provider.waitUntilOpened()
    }
    return Promise.race(this.messageProviders.map(p => p.waitUntilOpened()))
  }

  waitUntilLoggedIn = async (): Promise<WalletSession> => {
    if (this.provider) {
      return this.provider.waitUntilLoggedIn()
    }
    throw new Error('impossible state, wallet must be opened first')
  }

}
