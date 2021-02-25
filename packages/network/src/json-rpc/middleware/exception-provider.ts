import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddleware } from '../types'

export const exceptionProviderMiddleware: JsonRpcMiddleware = (next: JsonRpcHandlerFunc) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    next(request, (error: any, response?: JsonRpcResponse) => {

      if (!error && response && response.error) {
        if (typeof(response.error) === 'string') {
          throw new Error(response.error)
        } else {
          throw new Error(response.error.data)
        }
      }

      callback(error, response)
    }, chainId)
  }
}
