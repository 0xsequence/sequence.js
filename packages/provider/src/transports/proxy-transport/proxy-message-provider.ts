import { BaseProviderTransport, nextMessageIdx } from '../base-provider-transport'

import {
  ProviderMessageResponse,
  ProviderMessage, ProviderMessageResponseCallback, ProviderMessageType,
  ProviderMessageRequest, ProviderMessageTransport
} from '../../types'

import { JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '../../json-rpc'

import { ProxyMessageChannelPort } from './proxy-message-channel'

export class ProxyMessageProvider extends BaseProviderTransport {

  private port: ProxyMessageChannelPort
  
  constructor(port: ProxyMessageChannelPort) {
    super()

    this.connected = true // assume always connected

    this.port = port
    this.port.handleMessage = (message: ProviderMessage<any>): void => {
      this.handleMessage(message)
    }
  }

  openWallet = (path?: string, state?: object): void => {
    // assume the wallet is already opened or handled by another process
    return
  }

  closeWallet() {
    // closing the wallet is handled by another process
    return
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    const response = await this.sendMessageRequest({ idx: nextMessageIdx(), type: ProviderMessageType.MESSAGE, data: request })
    callback(null, response.data)
  }

  sendMessage(message: ProviderMessage<any>) {
    if (!message.idx || message.idx <= 0) {
      throw Error('message idx is empty')
    }
    this.port.sendMessage(message)
  }
}
