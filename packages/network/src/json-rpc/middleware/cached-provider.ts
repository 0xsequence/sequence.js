import { ethers } from 'ethers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'

export interface CachedProviderOptions {
  // defaultChainId passes a chainId to provider handler if one isn't passed.
  // This is used in multi-chain mode 
  defaultChainId?: number

  // chainId specifies the cached provider is bound to a single chain at all times,
  // and so will init the cache with the chainId value supplied.
  chainId?: number
}

export class CachedProvider implements JsonRpcMiddlewareHandler {

  private cachableJsonRpcMethods = [
    'net_version', 'eth_chainId', 'eth_accounts',
    'sequence_getWalletContext', 'sequence_getNetworks'
  ]

  private cache: {[key: string]: any}
  private onUpdateCallback?: (key?: string, value?: any) => void

  // defaultChainId is used for default chain select with used with multi-chain provider
  readonly defaultChainId?: number

  // chainId is used to bind this provider to a specific chain, for a bit of extra
  // optimization to avoid having to query eth_chainId / net_version.
  readonly chainId?: number

  constructor(options?: CachedProviderOptions) {
    this.cache = {}
    this.defaultChainId = options?.defaultChainId
    this.chainId = options?.chainId
    if (this.chainId) {
      this.defaultChainId = this.chainId
      this.initChainIdCache()
    }
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

  private initChainIdCache = () => {
    if (!this.chainId) return
    this.setCacheValue(this.cacheKey('eth_chainId', [], this.chainId), ethers.utils.hexlify(this.chainId))
    this.setCacheValue(this.cacheKey('net_version', [], this.chainId), `${this.chainId}`)
  }
}
