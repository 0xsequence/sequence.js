import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddleware } from '../types'

export const loggingProviderMiddleware: JsonRpcMiddleware = (next: JsonRpcHandlerFunc) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    const chainIdLabel = chainId ? ` chainId:${chainId}` : ''
    console.log(`[provider request]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params)
    next(request, (error: any, response?: JsonRpcResponse) => {
      console.log(`[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params, `response:`, response)
      callback(error, response)
    }, chainId)
  }
}
