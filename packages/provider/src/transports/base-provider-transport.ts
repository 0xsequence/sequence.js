import EventEmitter from 'eventemitter3'

import {
  ProviderTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageEvent, ProviderMessageResponse,
  ProviderMessageResponseCallback, ProviderMessageTransport,
  WalletSession, ConnectionState
} from '../types'

import { NetworkConfig, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'

export const PROVIDER_CONNECT_TIMEOUT = 8000 // in ms

let _messageIdx = 0

export const nextMessageIdx = () => ++_messageIdx

export abstract class BaseProviderTransport implements ProviderTransport {

  protected pendingMessageRequests: ProviderMessageRequest[] = []
  protected responseCallbacks = new Map<number, ProviderMessageResponseCallback>()

  protected connection: ConnectionState
  protected sessionId: string
  protected confirmationOnly: boolean = false
  protected events: EventEmitter<ProviderMessageEvent, any> = new EventEmitter()

  protected accountPayload: string
  protected networksPayload: NetworkConfig[]

  protected registered: boolean

  constructor() {
    this.connection = ConnectionState.DISCONNECTED
    this.registered = false
  }

  register() {
    throw new Error('abstract method')
  }

  unregister() {
    throw new Error('abstract method')
  }

  openWallet(path?: string, state?: any, defaultNetworkId?: string | number) {
    throw new Error('abstract method')
  }

  closeWallet() {
    throw new Error('abstract method')
  }

  isConnected(): boolean {
    return this.registered && this.connection === ConnectionState.CONNECTED
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // here, we receive the message from the dapp provider call

    if (this.connection === ConnectionState.DISCONNECTED ) {
      // flag the wallet to auto-close once user submits input. ie.
      // prompting to sign a message or transaction
      this.confirmationOnly = true
    }

    // open/focus the wallet.
    // automatically open the wallet when a provider request makes it here.
    await this.openWallet()
    if (!this.isConnected()) {
      await this.waitUntilConnected()
    }

    // send message request, await, and then execute callback after receiving the response
    try {
      const response = await this.sendMessageRequest({
        idx: nextMessageIdx(),
        type: ProviderMessageType.MESSAGE,
        data: request,
        chainId: chainId
      })
      callback(undefined, response.data)
    } catch (err) {
      callback(err)
    }
  }

  // handleMessage will handle message received from the remote wallet
  handleMessage(message: ProviderMessage<any>) {

    // message is either a notification, or its a ProviderMessageResponse
    console.log("RECEIVED MESSAGE FROM WALLET", message.idx, message)

    const requestIdx = message.idx
    const responseCallback = this.responseCallbacks.get(requestIdx)
    if (requestIdx) {
      this.responseCallbacks.delete(requestIdx)
    }

    // CONNECT response
    //
    // Flip connected flag, and flush the pending queue 
    if (message.type === ProviderMessageType.CONNECT && !this.isConnected()) {
      if (this.sessionId !== message.data?.result?.sessionId) {
        console.log('connect received from wallet, but does not match id', this.sessionId)
        return
      }

      // check if connection error occured due to invalid defaultNetworkId
      if (message.data?.result?.error) {
        console.error('connection to wallet failed')
        this.disconnect()
        throw new Error(message.data?.result?.error)
      }

      // success!
      this.connection = ConnectionState.CONNECTED
      this.events.emit('connect')

      // flush pending requests when connected
      if (this.pendingMessageRequests.length !== 0) {
        const pendingMessageRequests = this.pendingMessageRequests.splice(0, this.pendingMessageRequests.length)

        pendingMessageRequests.forEach(async pendingMessageRequest => {
          this.sendMessage(pendingMessageRequest)
        })
      }

      return
    }

    // MESSAGE resposne
    if (message.type === ProviderMessageType.MESSAGE) {

      // Require user confirmation, bring up wallet to prompt for input then close
      // TODO: perhaps apply technique like in multicall to queue messages within
      // a period of time, then close the window if responseCallbacks is empty, this is better.
      if (this.confirmationOnly) {
        setTimeout(() => {
          if (this.responseCallbacks.size === 0) {
            this.closeWallet()
          }
        }, 1500) // TODO: be smarter about timer as we're processing the response callbacks..
      }

      if (!responseCallback) {
        // NOTE: this would occur if 'idx' isn't set, which should never happen
        // or when we register two handler, or duplicate messages with the same idx are sent,
        // all of which should be prevented prior to getting to this point
        throw new Error('impossible state')
      }

      // Callback to original caller
      if (responseCallback) {
        responseCallback(undefined, message)
        return
      }
    }

    // ACCOUNTS_CHANGED -- when a user logs in or out
    if (message.type === ProviderMessageType.ACCOUNTS_CHANGED) {
      this.accountPayload = undefined
      if (message.data && message.data.length > 0) {
        this.accountPayload = message.data[0].toLowerCase()
      }
      this.events.emit('accountsChanged', message.data)
      return
    }

    // CHAIN_CHANGED -- when a user changes their default chain
    if (message.type === ProviderMessageType.CHAIN_CHANGED) {
      this.events.emit('chainChanged', message.data)
      return
    }

    // NOTIFY NETWORKS -- when a user connects or logs in
    if (message.type === ProviderMessageType.NETWORKS) {
      this.networksPayload = message.data
      this.events.emit('networks', this.networksPayload)
      return
    }
  }

  // sendMessageRequest sends a ProviderMessageRequest over the wire to the wallet
  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    return new Promise((resolve, reject) => {
      if (!message.idx || message.idx <= 0) {
        reject(new Error('message idx not set'))
      }

      const responseCallback: ProviderMessageResponseCallback = (error: any, response?: ProviderMessageResponse) => {
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
      }

      const idx = message.idx
      if (!this.responseCallbacks.get(idx)) {
        this.responseCallbacks.set(idx, responseCallback)
      } else {
        reject(new Error('duplicate message idx, should never happen'))
      }

      if (!this.isConnected()) {
        console.log('pushing to pending requests', message)
        this.pendingMessageRequests.push(message)
      } else {
        this.sendMessage(message)
      }
    })
  }

  sendMessage(message: ProviderMessage<any>) {
    throw new Error('abstract method')
  }

  on(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    this.events.on(event, fn)
  }

  once(event: ProviderMessageEvent, fn: (...args: any[]) => void) {
    this.events.once(event, fn)
  }

  waitUntilConnected = async (): Promise<boolean> => {
    let connected = false
    return Promise.race([
      new Promise<boolean>((_, reject) => {
        const timeout = setTimeout(() => {
          clearTimeout(timeout)
          // only emit disconnect if the timeout wins the race
          if (!connected) this.events.emit('disconnect')
          reject(new Error('connection attempt to the wallet timed out'))
        }, PROVIDER_CONNECT_TIMEOUT)
      }),
      new Promise<boolean>(resolve => {
        if (this.isConnected()) {
          connected = true
          resolve(true)
          return
        }
        this.events.once('connect', () => {
          connected = true
          resolve(true)
        })
      })
    ])
  }

  waitUntilLoggedIn = async (): Promise<WalletSession> => {
    await this.waitUntilConnected()

    const login = Promise.all([
      new Promise<string>(resolve => {
        if (this.accountPayload) {
          resolve(this.accountPayload)
          return
        }
        this.events.once('accountsChanged', (accounts) => {
          if (accounts && accounts.length > 0) {
            // account logged in
            resolve(accounts[0])
          } else {
            // account logged out
            resolve(undefined)
          }
        })
      }),
      new Promise<NetworkConfig[]>(resolve => {
        if (this.networksPayload) {
          resolve(this.networksPayload)
          return
        }
        this.events.once('networks', (networks) => {
          resolve(networks)
        })
      })
    ]).then(values => {
      const [ accountAddress, networks ] = values
      return { accountAddress, networks }
    })

    const disconnect = new Promise((_, reject) => {
      this.events.once('disconnect', () => {
        reject(new Error('user disconnected the wallet'))
      })
    })

    return Promise.race<WalletSession>([
      login,
      disconnect
    ])
  }

  protected connect = async (defaultNetworkId?: string | number): Promise<boolean> => {
    if (this.isConnected()) return true

    // Send connection request and wait for confirmation
    this.connection = ConnectionState.CONNECTING

    // CONNECT is special case, as we emit multiple tranmissions waiting for a response
    const initRequest: ProviderMessage<any> = {
      idx: nextMessageIdx(),
      type: ProviderMessageType.CONNECT,
      data: {
        defaultNetworkId: defaultNetworkId
      }
    }

    // Continually send connect requesst until we're connected or timeout passes
    let connected: boolean = undefined
    const postMessageUntilConnected = () => {
      if (!this.registered) return false
      if (connected !== undefined) return connected
      if (this.connection === ConnectionState.DISCONNECTED) return false

      this.sendMessage(initRequest)
      setTimeout(postMessageUntilConnected, 200)
    }
    postMessageUntilConnected()

    // Wait for connection or timeout
    try {
      connected = await this.waitUntilConnected()
    } catch (err) {
      connected = false
    }
    return connected
  }

  protected disconnect() {
    this.connection = ConnectionState.DISCONNECTED
    this.confirmationOnly = false
    console.log('disconnecting wallet and flushing!')

    // flush pending requests and return error to all callbacks
    this.pendingMessageRequests.length = 0
    this.responseCallbacks.forEach(responseCallback => {
      responseCallback('wallet disconnected')
    })
    this.responseCallbacks.clear()

    this.accountPayload = undefined
    this.networksPayload = undefined

    this.events.emit('disconnect')
  }
}
