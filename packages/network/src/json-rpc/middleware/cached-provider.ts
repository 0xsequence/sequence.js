import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'

export class CachedProvider implements JsonRpcMiddlewareHandler {

  private cachableJsonRpcMethods = [
    'net_version', 'eth_chainId', 'eth_accounts',
    'sequence_getWalletContext', 'sequence_getNetworks'
  ]

  private cache: {[key: string]: any}
  private onUpdateCallback?: (key?: string, value?: any) => void

  readonly defaultChainId?: number

  constructor(defaultChainId?: number) {
    this.cache = {}
    this.defaultChainId = defaultChainId
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

      // Respond early with cached result
      if (this.cachableJsonRpcMethods.includes(request.method)) {
        const key = this.cacheKey(request.method, request.params!, chainId || this.defaultChainId)
        const result = this.getCacheValue(key)
        if (result && result !== '') {
          callback(undefined, {
            jsonrpc: '2.0',
            id: request.id!,
            result: result
          })
          return
        }
      }
  
      // Continue down the handler chain
      next(request, (error: any, response?: JsonRpcResponse, chainId?: number) => {
        // Store result in cache and continue
        if (this.cachableJsonRpcMethods.includes(request.method)) {
          if (response && response.result) {
            const key = this.cacheKey(request.method, request.params!, chainId || this.defaultChainId)
            this.setCacheValue(key, response.result)
          }
        }
  
        // Exec next handler
        callback(error, response)
      }, chainId || this.defaultChainId)
    }
  }

  cacheKey = (method: string, params: any[], chainId?: number) => {
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

  getCache = () => this.cache

  setCache = (cache: {[key: string]: any}) => {
    this.cache = cache
    if (this.onUpdateCallback) {
      this.onUpdateCallback()
    }
  }

  getCacheValue = (key: string): any => {
    return this.cache[key]
  }

  setCacheValue = (key: string, value: any) => {
    this.cache[key] = value
    if (this.onUpdateCallback) {
      this.onUpdateCallback(key, value)
    }
  }

  onUpdate(callback: (key?: string, value?: any) => void) {
    this.onUpdateCallback = callback
  }

  clearCache = () => {
    this.cache = {}
  }
}
