import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'

export class SingleflightMiddleware implements JsonRpcMiddlewareHandler {

  private singleflightJsonRpcMethods = [
    'eth_chainId',
    'net_version',
    'eth_call',
    'eth_getCode',
    'eth_blockNumber',
    'eth_getBalance',
    'eth_getStorageAt',
    'eth_getTransactionCount',
    'eth_getBlockTransactionCountByHash',
    'eth_getBlockTransactionCountByNumber',
    'eth_getUncleCountByBlockHash',
    'eth_getUncleCountByBlockNumber',
    'eth_getBlockByHash',
    'eth_getBlockByNumber',
    'eth_getTransactionByHash',
    'eth_getTransactionByBlockHashAndIndex',
    'eth_getTransactionByBlockNumberAndIndex',
    'eth_getTransactionReceipt',
    'eth_getUncleByBlockHashAndIndex',
    'eth_getUncleByBlockNumberAndIndex',
    'eth_getLogs'
  ]

  inflight: {[key: string]: { id: number, callback: JsonRpcResponseCallback }[]}

  constructor() {
    this.inflight = {}
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

      // continue to next handler if method isn't part of methods list
      if (!this.singleflightJsonRpcMethods.includes(request.method)) {
        next(request, callback, chainId)
        return
      }

      const key = this.requestKey(request.method, request.params || [], chainId)

      if (!this.inflight[key]) {
        // first request -- init the empty list
        this.inflight[key] = []
      } else {
        // already in-flight, add the callback to the list and return
        this.inflight[key].push({ id: request.id!, callback })
        return
      }

      // Continue down the handler chain
      next(request, (error: any, response?: JsonRpcResponse, chainId?: number) => {
        // callback the original request
        callback(error, response)

        // callback all other requests of the same kind in queue, with the
        // same response result as from the first response.
        for (let i=0; i < this.inflight[key].length; i++) {
          const sub = this.inflight[key][i]
          if (error) {
            sub.callback(error, response)
          } else if (response) {
            sub.callback(undefined, {
              jsonrpc: '2.0',
              id: sub.id,
              result: response!.result
            })
          }
        }

        // clear request key
        delete(this.inflight[key])
      }, chainId)
    }
  }

  requestKey = (method: string, params: any[], chainId?: number) => {
    let key = ''
    if (chainId) {
      key = `${chainId}:${method}:`
    } else {
      key = `:${method}:`
    }
    if (!params || params.length === 0) {
      return key+'[]'
    }
    return key+JSON.stringify(params)
  }
}