import { ExternalProvider } from '@ethersproject/providers'
import { JsonRpcRequest, JsonRpcResponseCallback } from '../../types'

export class ProviderEngine implements ExternalProvider {
  private sender: ExternalProvider
  private handler: JsonRpcHandler

  constructor(sender: ExternalProvider, middlewares?: Array<JsonRpcMiddleware | AsyncSendableMiddleware>) {
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

  // createJsonRpcProvider(): JsonRpcProvider {
  // }
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
  for (let i = middlewares.length - 2; i >= 0; i--) {
    chain = toMiddleware(middlewares[i])(chain)
  }
  return chain
}

export { loggingProviderMiddleware } from './logging-provider'
export { allowProviderMiddleware } from './allow-provider'
export { PublicProvider } from './public-provider'
export { CachedProvider } from './cached-provider'
