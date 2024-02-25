import { EIP1193ProviderFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcMiddleware } from '../types'

export const exceptionProviderMiddleware: JsonRpcMiddleware = (next: EIP1193ProviderFunc<JsonRpcResponse>) => {
  return async (request: { jsonrpc: '2.0', method: string, params?: any[], chainId?: number }): Promise<JsonRpcResponse> => {
    const response = await next(request)
    if (response.error) {
      if (typeof response.error === 'string') {
        throw new Error(response.error)
      } else {
        throw new Error(response.error.message)
      }
    }
    return response
  }
}
