import { AsyncSendable } from 'ethers/providers'
import { JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback } from '../types'

let eventIdx = 0

export class ExternalWindowProvider implements AsyncSendable {

  // TODO: include .host, .path, etc..

  private walletURL: URL
  private walletWindow: Window
  private walletOpened: boolean

  private connected = false
  private pendingSendQueue: PendingSendRequest[] = []
  private callbacks = new Map<number, SendCallbackData>()

  // TODO: configure config + pendingSendQueue timeout
  // so we can resolve a promise for a blocked popup or one that times out

  constructor(walletAppURL: string) {
    this.walletURL = new URL(walletAppURL)

    // init and the external window and setup message handlers
    this.init()
  }

  private init = () => {
    this.openWindow()

    window.addEventListener('message', this.handleMessage)

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
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback) {
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
  private handleMessage = (ev: MessageEvent) => {
    if (typeof ev.data === 'string' && !ev.data) {
      return
    }

    console.log('received event..', ev)

    const response: SendResponse = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data

    // Handle CONNECT_RESPONSE
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
    }

    // Handle SEND_RESPONSE
    const { type, payload = {} } = response
    const requestId = response.id

    if (type === EventType.SEND_RESPONSE) {
      const result = payload
      const callbackData = this.callbacks.get(requestId)

      if (callbackData) {
        const { callback, id } = callbackData

        if (result.error) {
          // Respond with error
          let error: Error
          if (result.error.message) {
            error = new Error(result.error.message)
          } else {
            error = new Error(result.error)
          }
          callback(error.message)
        } else {
          // Respond with result
          callback(null, {
            jsonrpc: '2.0',
            ...result,
            id
          })
        }
      }
    }
  }


  private postMessage = (message: any) => {
    const postedMessage = typeof message !== 'string' ? JSON.stringify(message) : message
    this.walletWindow.postMessage(postedMessage, this.walletURL.origin)
  }

  private openWindow = () => {
    const windowFeatures = 'toolbar=0,location=0,menubar=0,scrollbars=yes,status=yes,width=450,height=700'

    const popup = window.open(this.walletURL.href, '_blank', windowFeatures)

    const popupBlocked = popup === null || popup === undefined
    if (popupBlocked) {
      // TODO: handle differently..
      throw new Error('popup is blocked')
    }

    this.walletWindow = popup
    this.walletOpened = true

    const interval = setInterval(() => {
      if (popup && popup.closed) {
        console.log('popup is closed..')
        this.walletOpened = false
        this.connected = false // TODO: specify connected false?
        clearInterval(interval)
      }
    }, 1000)
  }

  private focusWindow = () => {
    if (this.walletOpened) {
      this.walletWindow.focus()
    }
  }

  isConnected(): boolean {
    // TODO: consider reconncetion, and methods sent / pending,, etc..
    // ie. connect listAccounts, disconnect, etc..
    // it gets pushed to send queue..
    // prob want a timeout though..

    // TODO: should we check walletWindow.closed instead ?
    return this.connected
  }

}

export enum EventType {
  CONNECT_RESPONSE = 'CONNECT_RESPONSE',
  CONNECT_REQUEST = 'CONNECT_REQUEST',

  SEND_REQUEST = 'SEND_REQUEST',
  SEND_RESPONSE = 'SEND_RESPONSE',

  // TODO: think about an acknowledgement (ACK) type
  // ie. dapp could send a SEND_RESPONSE_ACK or ACK with event id
  // the let the wallet know it received the response event

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
