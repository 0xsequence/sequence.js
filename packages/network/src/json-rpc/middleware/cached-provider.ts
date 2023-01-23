import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'

export interface CachedProviderOptions {
  // defaultChainId passes a chainId to provider handler if one isn't passed.
  // This is used in multi-chain mode 
  defaultChainId?: number

  // blockCache toggle, with option to pass specific set of methods to use with
  // the block cache.
  blockCache?: boolean | string[]
}

export class CachedProvider implements JsonRpcMiddlewareHandler {

  // cachableJsonRpcMethods which can be permanently cached for lifetime
  // of the provider.
  private cachableJsonRpcMethods = [
    'net_version', 'eth_chainId', 'eth_accounts',
    'sequence_getWalletContext', 'sequence_getNetworks'
  ]

  // cachableJsonRpcMethodsByBlock which can be temporarily cached for a short
  // period of time, essentially by block time. As we support chains fast blocks,
  // we keep the values here cachable only for 1.5 seconds. This is still useful to
  // memoize the calls within app-code that calls out to fetch these values within
  // a short period of time.
  private cachableJsonRpcMethodsByBlock: string[] = [
    'eth_call', 'eth_getCode'
  ]

  // cache for life-time of provider (unless explicitly cleared)
  private cache: {[key: string]: any}
  
  // cache by block, simulated by using a 1 second life-time
  private cacheByBlock: {[key: string]: any}
  private cacheByBlockResetLock: boolean = false

  // onUpdateCallback callback to be notified when cache values are set.
  private onUpdateCallback?: (key?: string, value?: any) => void

  // defaultChainId is used for default chain select with used with multi-chain provider
  readonly defaultChainId?: number

  constructor(options?: CachedProviderOptions) {
    this.cache = {}
    this.cacheByBlock = {}
    this.defaultChainId = options?.defaultChainId
    if (!options?.blockCache) {
      this.cachableJsonRpcMethodsByBlock = []
    } else if (options?.blockCache !== true) {
      this.cachableJsonRpcMethodsByBlock = options?.blockCache
    }
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

      // Respond early with cached result
      if (this.cachableJsonRpcMethods.includes(request.method) || this.cachableJsonRpcMethodsByBlock.includes(request.method)) {
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
        if (this.cachableJsonRpcMethods.includes(request.method) || this.cachableJsonRpcMethodsByBlock.includes(request.method)) {
          if (response && response.result && this.shouldCacheResponse(request, response)) {
            // cache the value
            const key = this.cacheKey(request.method, request.params!, chainId || this.defaultChainId)
            
            if (this.cachableJsonRpcMethods.includes(request.method)) {
              this.setCacheValue(key, response.result)
            } else {
              this.setCacheByBlockValue(key, response.result)              
            }
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
    if (this.cache[key]) {
      return this.cache[key]
    }
    if (this.cacheByBlock[key]) {
      return this.cacheByBlock[key]
    }
    return undefined
  }

  setCacheValue = (key: string, value: any) => {
    this.cache[key] = value
    if (this.onUpdateCallback) {
      this.onUpdateCallback(key, value)
    }
  }

  setCacheByBlockValue = (key: string, value: any) => {
    this.cacheByBlock[key] = value
   
    // clear the cacheByBlock once every X period of time
    if (!this.cacheByBlockResetLock) {
      this.cacheByBlockResetLock = true
      setTimeout(() => {
        this.cacheByBlockResetLock = false
        this.cacheByBlock = {}
      }, 1500) // 1.5 second cache lifetime
    }
  }

  shouldCacheResponse = (request: JsonRpcRequest, response?: JsonRpcResponse): boolean => {
    // skip if we do not have response result
    if (!response || !response.result) {
      return false
    }

    // skip caching eth_getCode where resposne value is '0x' or empty
    if (request.method === 'eth_getCode' && response.result.length <= 2) {
      return false
    }

    // all good -- signal to cache the result
    return true
  }

  onUpdate(callback: (key?: string, value?: any) => void) {
    this.onUpdateCallback = callback
  }

  clearCache = () => {
    this.cache = {}
    this.cacheByBlock = {}
  }
}
