import { Web3Provider, Networkish } from '@ethersproject/providers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcHandler, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from './types'

export class JsonRpcRouter implements JsonRpcHandler {
  private sender: JsonRpcHandler
  private handler: JsonRpcHandlerFunc

  constructor(sender: JsonRpcHandler, middlewares?: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>) {
    this.sender = sender
    if (middlewares) {
      this.setMiddleware(middlewares)
    }
  }

  setMiddleware(middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>) {
    this.handler = createJsonRpcMiddlewareStack(middlewares, this.sender.sendAsync)
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback) {
    this.handler(request, callback)
  }

  createWeb3Provider(network?: Networkish): Web3Provider {
    return new Web3Provider(this.sender, network)
  }
}

export const createJsonRpcMiddlewareStack = (middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>, handler: JsonRpcHandlerFunc): JsonRpcHandlerFunc => {
  if (middlewares.length === 0) return handler

  const toMiddleware = (v: any): JsonRpcMiddleware => {
    if (v.sendAsyncMiddleware) {
      return (v as JsonRpcMiddlewareHandler).sendAsyncMiddleware
    } else {
      return v
    }
  }

  let chain: JsonRpcHandlerFunc
  chain = toMiddleware(middlewares[middlewares.length-1])(handler)
  for (let i = middlewares.length - 2; i >= 0; i--) {
    chain = toMiddleware(middlewares[i])(chain)
  }
  return chain
}
