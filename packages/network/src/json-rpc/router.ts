import {
  JsonRpcHandlerFunc,
  JsonRpcRequest,
  JsonRpcResponseCallback,
  JsonRpcHandler,
  JsonRpcMiddleware,
  JsonRpcMiddlewareHandler
} from './types'

export class JsonRpcRouter implements JsonRpcHandler {
  private sender: JsonRpcHandler
  private handler: JsonRpcHandlerFunc

  constructor(middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>, sender: JsonRpcHandler) {
    this.sender = sender
    if (middlewares) {
      this.setMiddleware(middlewares)
    }
  }

  setMiddleware(middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>) {
    this.handler = createJsonRpcMiddlewareStack(middlewares, this.sender.sendAsync)
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) {
    try {
      this.handler(request, callback, chainId)
    } catch (err) {
      callback(err, undefined)
    }
  }

  // createWeb3Provider(network?: Networkish): EthersWeb3Provider {
  //   return new EthersWeb3Provider(this.sender, network)
  // }
}

export const createJsonRpcMiddlewareStack = (
  middlewares: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>,
  handler: JsonRpcHandlerFunc
): JsonRpcHandlerFunc => {
  if (middlewares.length === 0) return handler

  const toMiddleware = (v: any): JsonRpcMiddleware => {
    if (v.sendAsyncMiddleware) {
      return (v as JsonRpcMiddlewareHandler).sendAsyncMiddleware
    } else {
      return v
    }
  }

  let chain: JsonRpcHandlerFunc
  chain = toMiddleware(middlewares[middlewares.length - 1])(handler)
  for (let i = middlewares.length - 2; i >= 0; i--) {
    chain = toMiddleware(middlewares[i])(chain)
  }
  return chain
}
