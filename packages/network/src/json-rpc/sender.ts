import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers'
import { JsonRpcRequest, JsonRpcResponseCallback } from './types'

export class JsonRpcSender implements ExternalProvider {
  constructor(private provider: JsonRpcProvider) { }

  sendAsync = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    this.provider
      .send(request.method, request.params)
      .then(r => {
        callback(undefined, {
          jsonrpc: '2.0',
          id: request.id,
          result: r
        })
      })
      .catch(e => {
        callback(e)
      })
  }

  send = this.sendAsync
}
