import { AsyncSendable } from 'ethers/providers'
import { JsonRpcRequest, JsonRpcResponseCallback, NetworkConfig } from '../types'
import EventEmitter from 'eventemitter3'
import { WalletSession } from './wallet-provider'

let requestIdx = 0

export class ExternalWindowProvider implements AsyncSendable {

  private walletURL: URL
  private walletWindow: Window
  private walletOpened: boolean

  private pendingMessageQueue: PendingMessageRequest[] = []
  private callbacks = new Map<number, MessageCallbackData>()

  private connected = false
  private confirmationOnly: boolean = false
  private loginPayload?: string
  private networkPayload?: NetworkConfig
  private events: EventEmitter<EventType, any> = new EventEmitter()

  constructor(walletAppURL: string) {
    this.walletURL = new URL(walletAppURL)

    // init postMessage handler between dapp and wallet
    window.addEventListener('message', this.handleMessage)
  }

  openWallet = (pathname?: string) => {
    if (this.walletOpened === true) {
      this.walletWindow.focus()
      return
    }

    if (pathname) {
      this.walletURL.pathname = pathname
    }

    // Open popup window
    const windowFeatures = 'toolbar=0,location=0,menubar=0,scrollbars=yes,status=yes,width=450,height=700'
    const popup = window.open(this.walletURL.href, '_blank', windowFeatures)

    setTimeout(() => {
      if (!popup || popup.closed || typeof popup.closed == 'undefined') {
        // popup is definitely blocked if we reach here.
        throw new Error('popup is blocked')
      }
    }, 1000)

    const popupBlocked = popup === null || popup === undefined
    if (popupBlocked) {
      // TODO: handle differently..
      throw new Error('popup is blocked')
    }

    this.walletWindow = popup
    this.walletOpened = true

    // Send connection request and wait for confirmation
    if (!this.connected) {
      const initRequest: MessageRequest = {
        type: MessageType.CONNECT_REQUEST,
        id: ++requestIdx
      }

      const postMessageUntilConnected = () => {
        if (this.connected) {
          return
        }
        this.postMessage(initRequest)
        setTimeout(postMessageUntilConnected, 500)
      }

      postMessageUntilConnected()
    }

    // Heartbeat to track if wallet is closed / disconnected
    const interval = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(interval)
        this.walletOpened = false
        this.connected = false
        this.loginPayload = undefined // TODO: ok?
        this.events.emit('disconnected')
      }
    }, 1000)
  }

  closeWallet = () => {
    if (this.walletWindow) {
      this.walletWindow.close()
      this.walletWindow = null
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    if (!this.walletOpened) {
      await this.openWallet()
    }
    if (!this.walletOpened) {
      throw new Error('wallet is not opened.')
    }

    // Handle request via external provider
    this.sendRequest(MessageType.SEND_REQUEST, request, callback)
  }

  private sendRequest(type: MessageType, payload: MessagePayload, callback?: JsonRpcResponseCallback) {
    if (!this.connected) {
      this.pendingMessageQueue.push({
        type,
        payload,
        callback
      })
      return
    }

    const sendRequest: MessageRequest = {
      type,
      id: ++requestIdx,
      payload: payload
    }

    if (callback && sendRequest.payload) {
      this.callbacks.set(sendRequest.id, {
        id: sendRequest.id,
        callback
      })
    }

    this.postMessage(sendRequest)
  }

  // handle incoming message from external window..
  private handleMessage = (event: MessageEvent) => {
    // Security check, ensure message is coming from wallet origin url
    if (event.origin !== this.walletURL.origin) {
      return
    }
  
    console.log('RECEIVED MSG:', event)

    // Handle response payload
    const response: MessageResponse = JSON.parse(event.data)
    const requestId = response.id
    const result = response.payload
    const callbackData = this.callbacks.get(requestId)

    if (requestId) {
      this.callbacks.delete(requestId)
    }

    // CONNECT_RESPONSE
    //
    // Flip connected flag, and flush the pending queue 
    if (response.type === MessageType.CONNECT_RESPONSE && !this.connected) {
      this.connected = true

      if (this.pendingMessageQueue.length !== 0) {
        const pendingMessageRequests = this.pendingMessageQueue.splice(0, this.pendingMessageQueue.length)

        pendingMessageRequests.forEach(pendingMessageRequest => {
          const { type, payload, callback } = pendingMessageRequest
          this.sendRequest(type, payload, callback)
        })
      }

      this.events.emit('connected')
      return
    }


    // SEND_RESPONSE
    if (response.type === MessageType.SEND_RESPONSE) {

      // Require user confirmation, bring up wallet to prompt for input then close
      if (this.confirmationOnly) {
        if (this.callbacks.size === 0) {
          // TODO: close at appropriate time......
          // this.closeWallet()
        }
      }

      // Callback to original caller
      if (callbackData) {
        const { callback, id } = callbackData

        // Error response
        if (result.error) {
          // Respond with error
          let error: Error
          if (result.error.message) {
            error = new Error(result.error.message)
          } else {
            error = new Error(result.error)
          }
          callback(error.message)
          return
        }

        // Respond with result
        callback(null, {
          jsonrpc: '2.0',
          ...result,
          id
        })

        return
      }
    }

    // NOTIFY LOGIN -- when a user authenticates / logs in
    if (response.type === MessageType.NOTIFY_LOGIN) {
      this.loginPayload = response.payload
      this.events.emit('login', this.loginPayload)
      return
    }

    // NOTIFY LOGOUT -- when a user logs out
    if (response.type === MessageType.NOTIFY_LOGOUT) {
      this.loginPayload = undefined
      this.events.emit('logout')
      return
    }

    // NOTIFY NETWORK -- when a user sets or changes their ethereum network
    if (response.type === MessageType.NOTIFY_NETWORK) {
      this.networkPayload = response.payload
      this.events.emit('network', this.networkPayload)
      return
    }
  }

  private postMessage = (message: any) => {
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
  }

  on = (event: EventType, fn: (...args: any[]) => void) => {
    this.events.on(event, fn)
  }

  once = (event: EventType, fn: (...args: any[]) => void) => {
    this.events.once(event, fn)
  }

  waitUntilConnected = (): Promise<boolean> => {
    // TODO: handle popup blockers, perhaps emit connected:false, or call reject()
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true)
        return
      }
      this.events.once('connected', () => {
        resolve(true)
      })
    })
  }

  waitUntilLoggedIn = async (): Promise<WalletSession> => {
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

type EventType =  'connected' | 'disconnected' | 'login' | 'logout' | 'network'

export enum MessageType {
  CONNECT_RESPONSE = 'CONNECT_RESPONSE',
  CONNECT_REQUEST = 'CONNECT_REQUEST',

  SEND_REQUEST = 'SEND_REQUEST',
  SEND_RESPONSE = 'SEND_RESPONSE',

  NOTIFY_LOGIN = 'NOTIFY_LOGIN',
  NOTIFY_LOGOUT = 'NOTIFY_LOGOUT',
  NOTIFY_NETWORK = 'NOTIFY_NETWORK',

  DEBUG_LOG = 'DEBUG_LOG'
}

export type MessageRequest = {
  type: MessageType
  id: number
  payload?: {[key: string]: any}
}

export type MessageResponse = {
  type: MessageType
  id: number
  payload: any
}

export type MessagePayload = any

export type MessageCallback = (error: any, response?: any) => void

export type MessageCallbackData = {
  id: number
  callback: MessageCallback
}

export type PendingMessageRequest = {
  type: MessageType
  payload: MessagePayload
  callback?: MessageCallback
}
