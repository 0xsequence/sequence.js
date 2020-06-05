import { AsyncSendable, JsonRpcProvider } from 'ethers/providers'
import { JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback } from '../types'

export class ProviderProxy implements AsyncSendable {
  private sender: AsyncSendable
  private handler: JsonRpcHandler

  constructor(sender: AsyncSendable, middlewares?: Array<JsonRpcMiddleware | AsyncSendableMiddleware>) {
    this.sender = sender
    if (middlewares) {
      this.setMiddleware(middlewares)
    }
  }

  setMiddleware(middlewares: Array<JsonRpcMiddleware | AsyncSendableMiddleware>) {
    this.handler = createJsonRpcMiddlewareStack(middlewares, this.sender.sendAsync)
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback) {
    this.handler(request, callback)
  }
}

export type JsonRpcHandler = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => void

export type JsonRpcMiddleware = (next: JsonRpcHandler) => JsonRpcHandler

export interface AsyncSendableMiddleware {
  sendAsyncMiddleware: JsonRpcMiddleware
}

export const createJsonRpcMiddlewareStack = (middlewares: Array<JsonRpcMiddleware | AsyncSendableMiddleware>, handler: JsonRpcHandler): JsonRpcHandler => {
  if (middlewares.length === 0) return handler

  const toMiddleware = (v: any): JsonRpcMiddleware => {
    if (v.sendAsyncMiddleware) {
      return (v as AsyncSendableMiddleware).sendAsyncMiddleware
    } else {
      return v
    }
  }

  let chain: JsonRpcHandler
  chain = toMiddleware(middlewares[middlewares.length-1])(handler)
  for (let i=middlewares.length-2; i >= 0; i--) {
    chain = toMiddleware(middlewares[i])(chain)
  }
  return chain
}

export const loggingProviderMiddleware: JsonRpcMiddleware = (next: JsonRpcHandler) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    console.log(`[provider] request id:${request.id} method:${request.method} params:${request.params}`)
    next(request, (error: any, response?: JsonRpcResponse) => {
      console.log(`[provider] response id:${request.id} method:${request.method} params:${request.params} response:`, response)
      callback(error, response)
    })
  }
}

export const publicProviderMiddleware = (provider: JsonRpcProvider): JsonRpcMiddleware => {
  return (next: JsonRpcHandler) => {
    const privateJsonRpcMethods = ['eth_accounts', 'personal_sign', 'eth_sign', 'eth_sendTransaction', 'eth_sendRawTransaction']

    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
      // Send non-private methods to our local public provider
      if (!privateJsonRpcMethods.includes(request.method)) {
        provider.send(request.method, request.params).then(r => {
          callback(undefined, {
            jsonrpc: '2.0',
            id: request.id,
            result: r
          })
        }).catch(e => callback(e))
        return
      }

      // Continue to next handler
      next(request, callback)
    }
  }
}

export class ProviderCache implements AsyncSendableMiddleware {

  private cachableJsonRpcMethods = ['net_version', 'eth_chainId', 'eth_accounts']
  private cache: {[key: string]: any}

  constructor() {
    this.cache = {}
  }

  sendAsyncMiddleware = (next: JsonRpcHandler) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
      // Respond early with cached result
      if (this.cachableJsonRpcMethods.includes(request.method)) {
        const key = this.cacheKey(request.method, request.params)
        const result = this.cache[key]
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
            this.cache[key] = response.result
          }
        }
  
        // Exec next handler
        callback(error, response)
      })
    }
  }

  cacheKey = (method: string, params: any[]) => `${method}:${JSON.stringify(params)}`

  resetCache = () => this.cache = {}

  setCache = (cache: {[key: string]: any}) => this.cache = cache

  getCache = () => this.cache

  setCacheValue = (key: string, value: any) => this.cache[key] = value

}
