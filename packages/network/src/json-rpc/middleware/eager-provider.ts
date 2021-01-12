import { ethers } from 'ethers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse, JsonRpcMiddlewareHandler } from '../types'

// EagerProvider will eagerly respond to a provider request from pre-initialized data values.
//
// This is useful for saving a few remote calls for responses we're already expecting when
// communicating to a specific network provider.
export class EagerProvider implements JsonRpcMiddlewareHandler {

  readonly _accountAddress: string
  readonly _chainId: number

  constructor(accountAddress: string, chainId: number) {
    this._accountAddress = accountAddress
    this._chainId = chainId
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

      const { id, method } = request

      switch (method) {
        case 'net_version':
          callback(null, { jsonrpc: '2.0', id, result: `${this._chainId}` })
          return
        case 'eth_chainId':
          callback(null, { jsonrpc: '2.0', id, result: ethers.utils.hexlify(this._chainId) })
          return
        case 'eth_accounts':
          callback(null, { jsonrpc: '2.0', id, result: [this._accountAddress.toLowerCase()] })
          return
        default:
      }

      next(request, (error: any, response?: JsonRpcResponse, chainId?: number) => {
        callback(error, response)
      }, chainId)

    }
  }

}
