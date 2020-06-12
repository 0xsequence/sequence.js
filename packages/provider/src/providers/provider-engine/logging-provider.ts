import { JsonRpcMiddleware, JsonRpcHandler } from './index'
import { JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback } from '../../types'

export const loggingProviderMiddleware: JsonRpcMiddleware = (next: JsonRpcHandler) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    console.log(`[provider] request id:${request.id} method:${request.method} params:${request.params}`)
    next(request, (error: any, response?: JsonRpcResponse) => {
      console.log(`[provider] response id:${request.id} method:${request.method} params:${request.params} response:`, response)
      callback(error, response)
    })
  }
}
