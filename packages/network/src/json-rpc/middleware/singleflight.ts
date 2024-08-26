import { EIP1193ProviderFunc, JsonRpcResponseCallback, JsonRpcMiddlewareHandler, JsonRpcRequest } from '../types'

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

  inflight: { [key: string]: { id: number; callback: JsonRpcResponseCallback }[] }

  constructor() {
    this.inflight = {}
  }

  requestHandler = (next: EIP1193ProviderFunc) => {
    return async (request: JsonRpcRequest): Promise<any> => {
      // continue to next handler if method isn't part of methods list
      if (!this.singleflightJsonRpcMethods.includes(request.method)) {
        return next(request)
      }

      const key = this.requestKey(request.method, request.params || [], request.chainId)

      if (!this.inflight[key]) {
        // first request -- init the empty list
        this.inflight[key] = []
      } else {
        // already in-flight, add the callback to the list and return
        return new Promise<any>((resolve, reject) => {
          this.inflight[key].push({
            id: request.id!,
            callback: (error: any, response: any) => {
              if (error) {
                reject(error)
              } else {
                resolve(response)
              }
            }
          })
        })
      }

      // Continue down the handler chain
      try {
        // Exec the handler, and on success resolve all other promises
        const response = await next(request)
        this.inflight[key].forEach(({ callback }) => callback(undefined, response))
        return response
      } catch (error) {
        // If the request fails, reject all queued promises.
        this.inflight[key].forEach(({ callback }) => callback(error, undefined))
        throw error
      } finally {
        delete this.inflight[key]
      }
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
      return key + '[]'
    }
    return key + JSON.stringify(params)
  }
}
