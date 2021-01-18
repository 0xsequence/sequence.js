import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'

import {
  ProviderMessageResponse,
  ProviderMessage, ProviderMessageResponseCallback, ProviderMessageType,
  ProviderMessageRequest, ProviderMessageTransport, ConnectionState
} from '../../types'

import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

import { ProxyMessageChannelPort } from './proxy-message-channel'

export class ProxyMessageProvider extends BaseProviderTransport {

  private port: ProxyMessageChannelPort
  
  constructor(port: ProxyMessageChannelPort) {
    super()
    this.connection = ConnectionState.DISCONNECTED
    this.port = port
    if (!port) {
      throw new Error('port argument cannot be empty')
    }
  }

  register = () => {
    this.port.handleMessage = (message: ProviderMessage<any>): void => {
      this.handleMessage(message)
    }
  }

  unregister = () => {
    this.port.handleMessage = undefined
  }

  openWallet = (path?: string, state?: any): void => {
    this.connect()
  }

  closeWallet() {
    this.disconnect()
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx || message.idx <= 0) {
      throw new Error('message idx is empty')
    }
    this.port.sendMessage(message)
  }
}
