import EventEmitter from 'eventemitter3'

import {
  ProviderTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageEvent, ProviderMessageResponse,
  ProviderMessageResponseCallback, ProviderMessageTransport,
  WalletSession, OpenState, OpenWalletIntent
} from '../types'

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'
import { ethers } from 'ethers'

export const PROVIDER_OPEN_TIMEOUT = 5000 // in ms

let _messageIdx = 0

export const nextMessageIdx = () => ++_messageIdx

export abstract class BaseProviderTransport implements ProviderTransport {

  protected pendingMessageRequests: ProviderMessageRequest[] = []
  protected responseCallbacks = new Map<number, ProviderMessageResponseCallback>()

  protected state: OpenState
  protected confirmationOnly: boolean = false
  protected events: EventEmitter<ProviderMessageEvent, any> = new EventEmitter()

  protected accountPayload: string | undefined
  protected networksPayload: NetworkConfig[] | undefined
  protected walletContextPayload: WalletContext | undefined

  protected _sessionId?: string
  protected _registered: boolean

  constructor() {
    this.state = OpenState.CLOSED
    this._registered = false
  }

  get registered(): boolean {
    return this._registered
  }

  register() {
    throw new Error('abstract method')
  }

  unregister() {
    throw new Error('abstract method')
  }

  openWallet(path?: string, intent?: OpenWalletIntent, defaultNetworkId?: string | number) {
    throw new Error('abstract method')
  }

  closeWallet() {
    throw new Error('abstract method')
  }

  isOpened(): boolean {
    return this.registered && this.state === OpenState.OPENED
  }

  isConnected(): boolean {
    // if we're registered, and we have the account details, then we are connected
    return (
      this.registered &&
      !!this.accountPayload && this.accountPayload.length === 42 &&
      !!this.networksPayload && this.networksPayload.length > 0
    )
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // here, we receive the message from the dapp provider call

    if (this.state === OpenState.CLOSED) {
      // flag the wallet to auto-close once user submits input. ie.
      // prompting to sign a message or transaction
      this.confirmationOnly = true
    }

    // open/focus the wallet.
    // automatically open the wallet when a provider request makes it here.
    this.openWallet(undefined, { type: 'jsonRpcRequest', method: request.method })

    // send message request, await, and then execute callback after receiving the response
    try {
      if (!this.isOpened()) {
        await this.waitUntilOpened() // will throw on timeout
      }

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

    // OPEN response
    //
    // Flip opened flag, and flush the pending queue 
    if (message.type === ProviderMessageType.OPEN && !this.isOpened()) {
      if (this._sessionId && this._sessionId !== message.data?.sessionId) {
        console.log('open event received from wallet, but does not match sessionId', this._sessionId)
        return
      }

      // check if open error occured due to invalid defaultNetworkId
      if (message.data?.error) {
        const err = new Error(`opening wallet failed: received ${message.data?.error}`)
        console.error(err)
        this.close()
        throw err
      }

      // success!
      this.state = OpenState.OPENED
      this.events.emit('open')

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
        this.accountPayload = ethers.utils.getAddress(message.data[0])
        this.events.emit('accountsChanged', [this.accountPayload])
      } else {
        this.events.emit('accountsChanged', [])
      }
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

    // NOTIFY WALLET_CONTEXT -- when a user connects or logs in
    if (message.type === ProviderMessageType.WALLET_CONTEXT) {
      this.walletContextPayload = message.data
      this.events.emit('walletContext', this.walletContextPayload)
      return
    }

    // NOTIFY CLOSE -- when wallet instructs to close
    if (message.type === ProviderMessageType.CLOSE) {
      if (this.isOpened()) {
        this.close()
      }
    }

    // NOTIFY DISCONNECT -- when wallet instructs to disconnect
    if (message.type === ProviderMessageType.DISCONNECT) {
      if (this.isConnected()) {
        this.events.emit('disconnect', message.data)
        this.close()
      }
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
        } else if (response) {
          resolve(response)
        } else {
          throw new Error('no valid response to return')
        }
      }

      const idx = message.idx
      if (!this.responseCallbacks.get(idx)) {
        this.responseCallbacks.set(idx, responseCallback)
      } else {
        reject(new Error('duplicate message idx, should never happen'))
      }

      if (!this.isOpened()) {
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

  waitUntilOpened = async (openTimeout = PROVIDER_OPEN_TIMEOUT): Promise<boolean> => {
    let opened = false
    return Promise.race([
      new Promise<boolean>((_, reject) => {
        const timeout = setTimeout(() => {
          clearTimeout(timeout)
          // only emit close if the timeout wins the race
          if (!opened) this.events.emit('close')
          reject(new Error('opening wallet timed out'))
        }, openTimeout)
      }),
      new Promise<boolean>(resolve => {
        if (this.isOpened()) {
          opened = true
          resolve(true)
          return
        }
        this.events.once('open', () => {
          opened = true
          resolve(true)
        })
      })
    ])
  }

  waitUntilConnected = async (): Promise<WalletSession> => {
    await this.waitUntilOpened()

    const connect = Promise.all([
      new Promise<string | undefined>(resolve => {
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
      }),
      new Promise<WalletContext>(resolve => {
        if (this.walletContextPayload) {
          resolve(this.walletContextPayload)
          return
        }
        this.events.once('walletContext', (walletContext) => {
          resolve(walletContext)
        })
      })

    ]).then(values => {
      const [ accountAddress, networks, walletContext ] = values
      return { accountAddress, networks, walletContext }
    })

    const closeWallet = new Promise<WalletSession>((_, reject) => {
      this.events.once('close', () => {
        reject(new Error('user closed the wallet'))
      })
    })

    return Promise.race<WalletSession>([
      connect,
      closeWallet
    ])
  }

  protected open = async (): Promise<boolean> => {
    if (this.isOpened()) return true

    // Set to opening state
    this.state = OpenState.OPENING

    // Wait for open response from wallet, or timeout
    let opened: boolean | undefined = undefined
    try {
      opened = await this.waitUntilOpened()
    } catch (err) {
      opened = false
    }
    return opened
  }

  protected close() {
    this.state = OpenState.CLOSED
    this.confirmationOnly = false
    this._sessionId = undefined
    console.log('closing wallet and flushing!')

    // flush pending requests and return error to all callbacks
    this.pendingMessageRequests.length = 0
    this.responseCallbacks.forEach(responseCallback => {
      responseCallback('wallet closed')
    })
    this.responseCallbacks.clear()

    this.accountPayload = undefined
    this.networksPayload = undefined
    this.walletContextPayload = undefined

    this.events.emit('close')
  }
}
