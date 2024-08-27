import { EIP1193ProviderFunc, JsonRpcMiddleware } from '../types'

export const exceptionProviderMiddleware: JsonRpcMiddleware = (next: EIP1193ProviderFunc) => {
  return async (request: { method: string; params?: any[]; chainId?: number }): Promise<any> => {
    try {
      return await next(request)
    } catch (error) {
      if (typeof error === 'string') {
        throw new Error(error)
      } else {
        throw new Error(error.message)
      }
    }
  }
}
