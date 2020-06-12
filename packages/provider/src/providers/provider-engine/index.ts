import { AsyncSendable, JsonRpcProvider } from 'ethers/providers'
import { JsonRpcRequest, JsonRpcResponseCallback, NetworkConfig } from '../../types'

export class ProviderEngine implements AsyncSendable {
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

  createJsonRpcProvider(): JsonRpcProvider {
    return new RawJsonRpcProvider(this)
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

export { loggingProviderMiddleware } from './logging-provider'
export { allowProviderMiddleware } from './allow-provider'
export { PublicProvider } from './public-provider'
export { CachedProvider } from './cached-provider'


let requestIdx = 1

export class RawJsonRpcProvider extends JsonRpcProvider {

  private sender: AsyncSendable

  private networkConfig: NetworkConfig
  private privider: JsonRpcProvider

  constructor(sender: AsyncSendable) {
    super()
    this.sender = sender
  }

  send(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let request = {
        method: method,
        params: params,
        id: (requestIdx++),
        jsonrpc: '2.0'
      }
      this.sender.sendAsync(request, (error, result) => {
        if (error) {
          reject(error)
          return
        }
        if (result.error) {
          let error: any = new Error(result.error.message)
          error.code = result.error.code
          error.data = result.error.data
          reject(error)
          return
        }      
        resolve(result.result)
      })
    })
  }

  // getNetwork()

}
