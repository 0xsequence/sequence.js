import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'

export class CachedProvider implements JsonRpcMiddlewareHandler {

  private cachableJsonRpcMethods = ['net_version', 'eth_chainId', 'eth_accounts']
  private cache: {[key: string]: any}
  private onUpdateCallback?: () => void

  constructor() {
    this.cache = {}
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
      // Respond early with cached result
      if (this.cachableJsonRpcMethods.includes(request.method)) {
        const key = this.cacheKey(request.method, request.params)
        const result = this.getCacheValue(key)
        if (result && result !== '') {
          callback(null, {
            jsonrpc: '2.0',
            id: request.id,
            result: result
          })
          return
        }
      }
  
      // Continue down the handler chain
      next(request, (error: any, response?: JsonRpcResponse) => {
        // Store result in cache and continue
        if (this.cachableJsonRpcMethods.includes(request.method)) {
          if (response.result) {
            const key = this.cacheKey(request.method, request.params)
            this.setCacheValue(key, response.result)
          }
        }
  
        // Exec next handler
        callback(error, response)
      })
    }
  }

  cacheKey = (method: string, params: any[]) => `${method}:${JSON.stringify(params)}`

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
      this.onUpdateCallback()
    }
  }

  onUpdate(callback: () => void) {
    this.onUpdateCallback = callback
  }

  resetCache = () => {
    this.cache = {}
    this.onUpdateCallback = null
  }
}
