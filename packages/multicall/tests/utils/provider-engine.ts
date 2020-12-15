import { ethers } from "ethers"
import { JsonRpcRequest, JsonRpcResponseCallback } from "../../src/multicall"

export class ProviderEngine implements ethers.providers.ExternalProvider {
  private sender: ethers.providers.ExternalProvider
  private handler: JsonRpcHandler

  constructor(sender: ethers.providers.ExternalProvider, middlewares?: Array<JsonRpcMiddleware | AsyncSendableMiddleware>) {
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
  for (let i = middlewares.length - 2; i >= 0; i--) {
    chain = toMiddleware(middlewares[i])(chain)
  }
  return chain
}

import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers'

export class JsonRpcAsyncSender implements ExternalProvider {
  provider: JsonRpcProvider

  constructor(p: JsonRpcProvider) {
    this.provider = p
  }

  sendAsync = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    this.provider
      .send(request.method, request.params)
      .then(r => {
        callback(undefined, {
          jsonrpc: '2.0',
          id: request.id,
          result: r
        })
      })
      .catch(e => {
        callback(e)
      })
  }

  send = this.sendAsync
}
