import { JsonRpcRequest, JsonRpcResponse } from '@0xsequence/network'
import { logger } from '@0xsequence/utils'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import {
  ProviderMessageResponseCallback,
  ProviderMessage,
  EventType,
  ProviderMessageRequest,
  ProviderMessageResponse
} from '../../types'

export interface Stream {
  on(ev: string | symbol, fn: (...args: any[]) => void): void
  writable: boolean
  write(chunk: any, cb?: (error: Error | null | undefined) => void): boolean
}

// to be used on injected window.ethereum EIP1193 proxy
export abstract class BaseInjectedTransport extends EventEmitter {
  protected responseCallbacks = new Map<number, ProviderMessageResponseCallback>()

  private _messageIdx = 0
  protected nextMessageIdx = () => ++this._messageIdx

  constructor(private stream: Stream) {
    super()

    this.stream.on('data', this.handleMessage)
  }

  private handleMessage = (message: ProviderMessage<JsonRpcResponse>) => {
    if (!message.type || !message.data) {
      return
    }

    logger.info('[received message]', message)

    const requestIdx = message.idx
    const responseCallback = this.responseCallbacks.get(requestIdx)
    if (requestIdx) {
      this.responseCallbacks.delete(requestIdx)
    }

    switch (message.type) {
      case EventType.MESSAGE:
        if (responseCallback) {
          this.emit(EventType.MESSAGE, message)
          responseCallback(message.data.error, message)
        } else {
          // NOTE: this would occur if 'idx' isn't set, which should never happen
          // or when we register two handler, or duplicate messages with the same idx are sent,
          // all of which should be prevented prior to getting to this point
          throw new Error('impossible state')
        }
        break
      case EventType.DISCONNECT:
      case EventType.ACCOUNTS_CHANGED:
      case EventType.CHAIN_CHANGED:
        this.emit(message.type, message.data)
        break
      default:
        console.error('unknown message type', message)
        break
    }
  }

  protected sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
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

      const { idx } = message
      if (!this.responseCallbacks.get(idx)) {
        this.responseCallbacks.set(idx, responseCallback)
      } else {
        reject(new Error('duplicate message idx, should never happen'))
      }

      this.sendMessage(message)
    })
  }

  private sendMessage(message: ProviderMessage<JsonRpcRequest>) {
    if (!this.stream.writable) {
      console.error('window post message stream is not writable')
    }

    this.stream.write(message)
  }
}
