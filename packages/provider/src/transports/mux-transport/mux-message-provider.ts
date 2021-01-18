import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'
import { ProviderMessage, ProviderMessageResponseCallback, ProviderMessageType, ProviderTransport } from '../../types'

import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

// todo max enqueue size..... then throw..

export class MuxMessageProvider extends BaseProviderTransport { // maybe not extend..?

  private messageProviders: ProviderTransport[]

  private provider: ProviderTransport

  // registered bool?

  constructor(...messageProviders: ProviderTransport[]) {
    super()
    this.messageProviders = messageProviders
    this.provider = undefined
  }

  add(...messageProviders: ProviderTransport[]) {
    this.messageProviders.push(...messageProviders)
  }

  //---

  // register()
  // unregister()

  // openWallet(path?: string, state?: any)
  // closeWallet()
  // isConnected(): boolean
  // on(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  // once(event: ProviderMessageEvent, fn: (...args: any[]) => void)
  // waitUntilConnected(): Promise<boolean>
  // waitUntilLoggedIn(): Promise<WalletSession>

  // handleMessage(message: ProviderMessage<any>): void
  // sendAsync(..)

  // sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse>
  // sendMessage(message: ProviderMessage<any>): void

  //---

  register = () => {
    if (this.messageProviders.length === 1) {
      this.provider = this.messageProviders[0]
      this.provider.register()
      return
    }

    this.messageProviders.forEach(m => {
      m.register()
      m.once('connect', () => {
        console.log('connected provider!!', m)
        if (!this.provider) {
          this.provider = m
          console.log('flushing.......')
        }
      })
    })
  }

  unregister = () => {
    this.messageProviders.forEach(m => m.unregister())
    this.provider = undefined
  }

  openWallet = (path?: string, state?: any): void => {
    if (this.provider) {
      this.provider.openWallet(path, state)
      return
    }
    this.messageProviders.forEach(m => m.openWallet(path, state))
  }

  closeWallet() {
    if (this.provider) {
      this.provider.closeWallet()
    }
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // TODO: we could just fire this to all providers...?
    // and then flush all other provides once one of them connects..? with .flush() ?
    // or with this.disconnect() .. but make sure we do it in try / catch,
    // so that in error if (this.provider) is set, or we connected, we can skip those errors
    // as it means one of the other providers was just flushed out


    // connected
    if (this.provider) {
      this.provider.sendAsync(request, callback, chainId)
      return
    }

    // throw new Error('should not happen..? or enqueue...?')

    // not connected
    // ...

    // TODO: maybe keep track of pending requests before getting connected, then flush..
    // .....
    // ....... we should enqueue these......

    // TODO: what will this do exactly..?
    // const response = await this.sendMessageRequest({
    //   idx: nextMessageIdx(),
    //   type: ProviderMessageType.MESSAGE,
    //   data: request,
    //   chainId: chainId
    // })
    // callback(undefined, response.data)
    console.log('sendAsync, enqueuing..', request)
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
      // enqueue this message .....
      console.log('sendMessage, enqueing..', message)
    }
  }

}
