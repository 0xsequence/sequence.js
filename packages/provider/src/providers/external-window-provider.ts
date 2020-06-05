import { AsyncSendable, JsonRpcProvider } from 'ethers/providers'
import { JsonRpcRequest, JsonRpcResponseCallback } from '../types'
import { EventEmitter } from 'eventemitter3'

let eventIdx = 0

export class ExternalWindowProvider implements AsyncSendable {

  // TODO: include .host, .path, etc.. for AsyncSendable

  private walletURL: URL
  private walletWindow: Window
  private walletOpened: boolean

  private pendingSendQueue: PendingSendRequest[] = []
  private callbacks = new Map<number, SendCallbackData>()

  private connected = false
  private loggedIn: boolean = false
  private confirmationOnly: boolean = false

  private events = new EventEmitter()

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

    const popupBlocked = popup === null || popup === undefined
    if (popupBlocked) {
      // TODO: handle differently..
      throw new Error('popup is blocked')
    }

    this.walletWindow = popup
    this.walletOpened = true

    // Send connection request and wait for confirmation
    if (!this.connected) {
      const initRequest: SendRequest = {
        type: EventType.CONNECT_REQUEST,
        id: ++eventIdx
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
        this.events.emit('disconnected')
      }
    }, 1000)
  }

  closeWallet = () => {
    if (this.walletWindow) {
      this.walletWindow.close()
    }
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    if (!this.walletOpened) {
      throw new Error('wallet is not opened.')
    }

    // Handle request via external provider
    this.sendRequest(EventType.SEND_REQUEST, request, callback)
  }

  private sendRequest(type: EventType, payload: SendPayload, callback?: JsonRpcResponseCallback) {
    if (!this.connected) {
      this.pendingSendQueue.push({
        type,
        payload,
        callback
      })
      return
    }

    const sendRequest: SendRequest = {
      type,
      id: ++eventIdx,
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
  
    // console.log('RECEIVED MSG:', event)

    // Handle response payload
    const response: SendResponse = JSON.parse(event.data)
    const requestId = response.id
    const result = response.payload
    const callbackData = this.callbacks.get(requestId)

    if (requestId) {
      this.callbacks.delete(requestId)
    }

    // CONNECT_RESPONSE
    //
    // Flip connected flag, and flush the pending queue 
    if (response.type === EventType.CONNECT_RESPONSE && !this.connected) {
      this.connected = true

      if (this.pendingSendQueue.length !== 0) {
        const pendingSendRequests = this.pendingSendQueue.splice(0, this.pendingSendQueue.length)

        pendingSendRequests.forEach(pendingSendRequest => {
          const { type, payload, callback } = pendingSendRequest
          this.sendRequest(type, payload, callback)
        })
      }

      this.events.emit('connected')
    }


    // SEND_RESPONSE
    if (response.type === EventType.SEND_RESPONSE) {

      // Require user confirmation, bring up wallet to prompt for input then close
      if (this.confirmationOnly) {
        if (this.callbacks.size === 0) {
          // TODO: close at appropriate time..
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

    // NOTIFY
    if (response.type === EventType.NOTIFY) {
      if (response.payload.loggedIn) {
        this.loggedIn = true
        this.events.emit('loggedIn')
      }
    }
  }

  private postMessage = (message: any) => {
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
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
        return
      })
    })
  }

  waitUntilLoggedIn = async (): Promise<boolean> => {
    await this.waitUntilConnected()

    return new Promise(resolve => {
      if (this.loggedIn) {
        resolve(true)
        return
      }

      this.events.once('loggedIn', () => {
        resolve(true)
        return
      })
    })
  }

  isConnected(): boolean {
    return this.connected
  }
}

export enum EventType {
  CONNECT_RESPONSE = 'CONNECT_RESPONSE',
  CONNECT_REQUEST = 'CONNECT_REQUEST',

  SEND_REQUEST = 'SEND_REQUEST',
  SEND_RESPONSE = 'SEND_RESPONSE',

  NOTIFY = 'NOTIFY',

  DEBUG_LOG = 'DEBUG_LOG'
}

export type SendRequest = {
  type: EventType
  id: number
  payload?: {
    [key: string]: any
  }
}

export type SendResponse = {
  type: EventType
  id: number
  payload: { [key: string]: any }
}

export type SendPayload = any

export type SendCallback = (error: any, response?: any) => void

export type SendCallbackData = {
  id: number
  callback: SendCallback
}

export type PendingSendRequest = {
  type: EventType
  payload: SendPayload
  callback?: SendCallback
}
