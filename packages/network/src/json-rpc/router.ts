import { EIP1193Provider, EIP1193ProviderFunc, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from './types'

export class JsonRpcRouter implements EIP1193Provider {
  private sender: EIP1193Provider
  private handler: EIP1193Provider

  constructor(middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>, sender: EIP1193Provider) {
    this.sender = sender
    if (middlewares) {
      this.setMiddleware(middlewares)
    }
  }

  setMiddleware(middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>) {
    this.handler = createJsonRpcMiddlewareStack(middlewares, this.sender)
  }

  request(request: { id?: number; method: string; params?: any[]; chainId?: number }): Promise<any> {
    return this.handler.request(request)
  }
}

export const createJsonRpcMiddlewareStack = (
  middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>,
  handler: EIP1193Provider
): EIP1193Provider => {
  if (middlewares.length === 0) return handler

  const toMiddleware = (v: any): JsonRpcMiddleware => {
    if (v.requestHandler) {
      return (v as JsonRpcMiddlewareHandler).requestHandler
    } else {
      return v
    }
  }

  let chain: EIP1193ProviderFunc
  chain = toMiddleware(middlewares[middlewares.length - 1])(handler.request)
  for (let i = middlewares.length - 2; i >= 0; i--) {
    chain = toMiddleware(middlewares[i])(chain)
  }
  return { request: chain }
}
