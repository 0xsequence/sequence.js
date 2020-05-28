import { JsonRpcProvider, AsyncSendable } from 'ethers/providers'
import { JsonRpcRequest, JsonRpcResponseCallback } from '../types'

export class JsonRpcAsyncSendable implements AsyncSendable {
  provider: JsonRpcProvider

  constructor(p: JsonRpcProvider) {
    this.provider = p
  }

  send = this.sendAsync

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback) {
    this.provider
      .send(request.method, request.params)
      .then(r => {
        callback(undefined, {
          jsonrpc: '2.0',
          id: request.id,
          result: r
        })
      })
      .catch(e => callback(e))
  }
}
