import { BaseProviderTransport } from '../base-provider-transport'

import {
  ProviderMessage, OpenState, OpenWalletIntent, EventType, InitState
} from '../../types'

import { ProxyMessageChannelPort, ProxyEventTypes } from './proxy-message-channel'

export class ProxyMessageProvider extends BaseProviderTransport {

  private port: ProxyMessageChannelPort
  
  constructor(port: ProxyMessageChannelPort) {
    super()
    this.state = OpenState.CLOSED
    this.port = port    
    if (!port) {
      throw new Error('port argument cannot be empty')
    }

    // disable init handshake for proxy-transport, we set it to OK, to
    // consider it in completed state.
    this._init = InitState.OK
  }

  register = () => {
    this.port.handleMessage = (message: ProviderMessage<any>): void => {
      this.handleMessage(message)
    }

    this.on('open', (...args: Parameters<ProxyEventTypes['open']>) => {
      this.port.events.emit('open', ...args)
    })
    this.on('close', (...args: Parameters<ProxyEventTypes['close']>) => {
      this.port.events.emit('close', ...args)
    })
    this.on('connect', (...args: Parameters<ProxyEventTypes['connect']>) => {
      this.port.events.emit('connect', ...args)
    })
    this.on('disconnect', (...args: Parameters<ProxyEventTypes['disconnect']>) => {
      this.port.events.emit('disconnect', ...args)
    })

    this._registered = true
  }

  unregister = () => {
    this._registered = false
    this.closeWallet()
    this.events.removeAllListeners()
    // @ts-ignore
    this.port.handleMessage = undefined
  }

  openWallet = (path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    if (this.state === OpenState.CLOSED) {
      this.state = OpenState.OPENING
      const sessionId = `${performance.now()}`
      this._sessionId = sessionId
      this.sendMessage({
        idx: -1, type: EventType.OPEN, data: {
          path, intent, networkId, sessionId
        }
      })
    }
  }

  closeWallet() {
    this.sendMessage({
      idx: -1, type: EventType.CLOSE, data: null
    })
    this.close()
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx) {
      throw new Error('message idx is empty')
    }
    this.port.sendMessage(message)
  }
}
