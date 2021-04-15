import { BaseProviderTransport } from '../base-provider-transport'

import {
  ProviderMessage, OpenState, OpenWalletIntent, ProviderMessageType
} from '../../types'

import { ProxyMessageChannelPort } from './proxy-message-channel'

export class ProxyMessageProvider extends BaseProviderTransport {

  private port: ProxyMessageChannelPort
  
  constructor(port: ProxyMessageChannelPort) {
    super()
    this.state = OpenState.CLOSED
    this.port = port
    if (!port) {
      throw new Error('port argument cannot be empty')
    }
  }

  register = () => {
    this.port.handleMessage = (message: ProviderMessage<any>): void => {
      this.handleMessage(message)
    }

    this.on('open', (...args: any[]) => {
      this.port.events.emit('open', args)
    })
    this.on('close', (...args: any[]) => {
      this.port.events.emit('close', args)
    })
    this.on('connect', (...args: any[]) => {
      this.port.events.emit('connect', args)
    })
    this.on('disconnect', (...args: any[]) => {
      this.port.events.emit('disconnect', args)
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

  openWallet = (path?: string, intent?: OpenWalletIntent, defaultNetworkId?: string | number): void => {
    if (!this.isOpened()) {
      this.sendMessage({
        idx: -1, type: ProviderMessageType.OPEN, data: {
          path, intent, defaultNetworkId
        }
      })
    }
  }

  closeWallet() {
    this.close()
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx) {
      throw new Error('message idx is empty')
    }
    this.port.sendMessage(message)
  }
}
