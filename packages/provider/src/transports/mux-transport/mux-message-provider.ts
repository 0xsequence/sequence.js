import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'
import {
  ProviderMessage, ProviderMessageResponseCallback, ProviderMessageType, ProviderTransport,
  ProviderMessageEvent, ProviderMessageRequest, ProviderMessageResponse, WalletSession
} from '../../types'

import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export class MuxMessageProvider implements ProviderTransport {

  private messageProviders: ProviderTransport[]
  private provider: ProviderTransport

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

      m.once('connect', () => {
        // the first one to connect is the winner, and others will be unregistered
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

  openWallet = (path?: string, state?: any, defaultNetworkId?: string | number): void => {
    if (this.provider) {
      this.provider.openWallet(path, state, defaultNetworkId)
      return
    }
    this.messageProviders.forEach(m => m.openWallet(path, state, defaultNetworkId))
  }

  closeWallet() {
    if (this.provider) {
      this.provider.closeWallet()
    }
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
    throw new Error('impossible state, must be connected first')
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx || message.idx <= 0) {
      throw new Error('message idx is empty')
    }

    // connected
    if (this.provider) {
      this.provider.sendMessage(message)
      return
    }

    // not connceted
    if (message.type === ProviderMessageType.CONNECT) {
      this.messageProviders.forEach(m => m.sendMessage(message))
    } else {
      throw new Error('impossible state, must be connected first')
    }
  }

  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    if (this.provider) {
      return this.provider.sendMessageRequest(message)
    }
    throw new Error('impossible state, must be connected first')
  }

  handleMessage(message: ProviderMessage<any>): void {
    if (this.provider) {
      this.provider.handleMessage(message)
      return
    }
    throw new Error('impossible state, must be connected first')
  }

  waitUntilConnected = async (): Promise<boolean> => {
    if (this.provider) {
      return this.provider.waitUntilConnected()
    }
    throw new Error('impossible state, must be connected first')
  }

  waitUntilLoggedIn = async (): Promise<WalletSession> => {
    if (this.provider) {
      return this.provider.waitUntilLoggedIn()
    }
    throw new Error('impossible state, must be connected first')
  }

}
