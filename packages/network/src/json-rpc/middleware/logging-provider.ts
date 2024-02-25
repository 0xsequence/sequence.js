import { EIP1193ProviderFunc, JsonRpcResponse, JsonRpcMiddleware } from '../types'
import { logger } from '@0xsequence/utils'

// TODO: rename to loggerMiddleware
export const loggingProviderMiddleware: JsonRpcMiddleware = (next: EIP1193ProviderFunc<JsonRpcResponse>) => {
  return async (request: { jsonrpc: '2.0', id?: number, method: string, params?: any[], chainId?: number }): Promise<JsonRpcResponse> => {
    const chainIdLabel = request.chainId ? ` chainId:${request.chainId}` : ''
    logger.info(`[provider request]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params)

    const response = await next(request)

    if (response.error) {
      logger.warn(
        `[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`,
        request.params,
        `error:`,
        response.error
      )
    } else {
      logger.info(
        `[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`,
        request.params,
        `response:`,
        response
      )
    }

    return response
  }
}
