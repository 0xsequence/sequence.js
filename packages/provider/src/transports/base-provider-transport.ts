import EventEmitter from 'eventemitter3'

import {
  ProviderTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageEvent, ProviderMessageResponse,
  ProviderMessageResponseCallback, ProviderMessageTransport,
  WalletSession
} from '../types'

import { NetworkConfig, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

let messageIdx = 0

export const nextMessageIdx = () => ++messageIdx

export class BaseProviderTransport implements ProviderTransport {

  protected pendingMessageRequests: ProviderMessageRequest[] = []
  protected responseCallbacks = new Map<number, ProviderMessageResponseCallback>()

  protected connected = false
  protected confirmationOnly: boolean = false
  protected events: EventEmitter<ProviderMessageEvent, any> = new EventEmitter()

  protected loginPayload: string
  protected networkPayload: NetworkConfig

  constructor() {}

  // TODO: would be nice for openWallet() to return an auth token for the url too
  // so we don't need to request it after we login..
  // or maybe it will work as is already? .. notifyLogin() should do it..? or notifyAuth() ?

  openWallet = (path?: string, state?: object): void => {
    throw Error('abstract method')
  }

  closeWallet() {
    throw Error('abstract method')
  }

  isConnected(): boolean {
    return this.connected
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number): Promise<void> => {
    throw Error('abstract method')
  }

  // handleMessage will handle message received from the remote wallet
  handleMessage(message: ProviderMessage<any>) {

    // message is either a notification, or its a ProviderMessageResponse
    console.log("RECEIVED MESSAGE FROM WALLET", message)

    const requestIdx = message.idx
    const payload = message.data

    const responseCallback = this.responseCallbacks.get(requestIdx)
    if (requestIdx) {
      this.responseCallbacks.delete(requestIdx)
    }

    // CONNECT response
    //
    // Flip connected flag, and flush the pending queue 
    if (message.type === ProviderMessageType.CONNECT && !this.connected) {
      this.connected = true

      // flush pending requests when connected
      if (this.pendingMessageRequests.length !== 0) {
        const pendingMessageRequests = this.pendingMessageRequests.splice(0, this.pendingMessageRequests.length)

        pendingMessageRequests.forEach(async pendingMessageRequest => {
          this.sendMessage(pendingMessageRequest)
        })
      }

      this.events.emit('connect')
      return
    }


    // MESSAGE resposne
    if (message.type === ProviderMessageType.MESSAGE) {

      // Require user confirmation, bring up wallet to prompt for input then close
      if (this.confirmationOnly) {
        // console.log('========> A callback.size?', this.callbacks.size)
        setTimeout(() => {
          // console.log('========> B callback?', this.callbacks.size)
          if (this.responseCallbacks.size === 0) {
            this.closeWallet()
          }
        }, 0)
      }

      if (!responseCallback) {
        throw Error('impossible state')
      }

      // Callback to original caller
      if (responseCallback) {

        // const responseMessage: ProviderMessageResponse = {
        //   type: message.type,
        //   chainId: message.chainId,
        //   data: {
        //     jsonrpc: '2.0',
        //     id: message.data.id,
        //     result: null
        //   }
        // }

        // TODOOOOOOOOOOOO................... XXX

        // Error response
        if (payload.error) {
          console.log('waaaaaaaaaa?', JSON.stringify(payload))
          throw Error('TODOOOOOOOOOOO')

          // Respond with error
          let error: Error
          if (payload.error.message) {
            error = new Error(payload.error.message)
          } else {
            error = new Error(payload.error)
          }
          // callback(error.message)
          // TODO ........ error handling
          responseCallback({

          })
          return
        }

        // Respond with result
        // TODO: weird type..
        responseCallback(null, message)
        // callback(null, {
        //   jsonrpc: '2.0',
        //   // ...result,
        //   id: result.id,
        //   result: result
        // })

        return
      }
    }

    // NOTIFY LOGIN -- when a user authenticates / logs in
    if (message.type == ProviderMessageType.LOGIN) {
      this.loginPayload = message.data
      this.events.emit('login', message.data) // payload is `accountAddress: string`
      return
    }

    // NOTIFY LOGOUT -- when a user logs out
    if (message.type === ProviderMessageType.LOGOUT) {
      this.loginPayload = undefined
      this.events.emit('logout')
      return
    }

    // NOTIFY NETWORK -- when a user sets or changes their ethereum network
    if (message.type === ProviderMessageType.NETWORK) {
      this.networkPayload = message.data
      this.events.emit('network', this.networkPayload)
      return
    }
  }

  // sendMessageRequest sends a ProviderMessageRequest over the wire to the wallet
  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    return new Promise(resolve => {
      if (!message.idx || message.idx <= 0) {
        throw Error('message idx not set')
      }

      // TODO: sup with the error arg here..?
      const responseCallback: ProviderMessageResponseCallback = (error: any, response?: ProviderMessageResponse) => resolve(response)

      const idx = message.idx
      if (!this.responseCallbacks.get(idx)) {
        this.responseCallbacks.set(idx, responseCallback)
      } else {
        // TODO: or just reject..? or is that the same thing..?
        throw Error('already set -- should not happen')
      }

      if (!this.connected) {
        console.log('pushing to pending requests', message)
        this.pendingMessageRequests.push(message)
        return
      }

      this.sendMessage(message)
    })
  }

  sendMessage(message: ProviderMessage<any>) {
    throw Error('abstract method')
  }

  on = (event: ProviderMessageEvent, fn: (...args: any[]) => void) => {
    this.events.on(event, fn)
  }

  once = (event: ProviderMessageEvent, fn: (...args: any[]) => void) => {
    this.events.once(event, fn)
  }

  waitUntilConnected = async (): Promise<boolean> => {
    // TODO: handle popup blockers, perhaps emit connected:false, or call reject().
    // maybe we don't need it if its handled by openWallet?
    // or, we move the logic down to here
    // ..
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true)
        return
      }
      this.events.once('connect', () => {
        resolve(true)
      })
    })
  }

  waitUntilLoggedIn = async (): Promise<WalletSession> => {
    // TODO: lets not block forever.
    await this.waitUntilConnected()

    return Promise.all([
      new Promise<string>(resolve => {
        if (this.loginPayload) {
          resolve(this.loginPayload)
          return
        }
        this.events.once('login', (payload) => {
          resolve(payload)
        })
      }),
      new Promise<NetworkConfig>(resolve => {
        if (this.networkPayload) {
          resolve(this.networkPayload)
          return
        }
        this.events.once('network', (payload) => {
          resolve(payload)
        })
      })
    ]).then(values => {
      const [ accountAddress, network ] = values
      return { accountAddress, network }
    })
  }

}
