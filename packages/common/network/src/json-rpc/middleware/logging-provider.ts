import { EIP1193ProviderFunc, JsonRpcMiddleware, JsonRpcRequest } from '../types'
import { logger } from '@0xsequence/utils'

// TODO: rename to loggerMiddleware
export const loggingProviderMiddleware: JsonRpcMiddleware = (next: EIP1193ProviderFunc) => {
  return async (request: JsonRpcRequest): Promise<any> => {
    const chainIdLabel = request.chainId ? ` chainId:${request.chainId}` : ''
    logger.info(`[provider request]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params)

    try {
      const result = await next(request)

      logger.info(
        `[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`,
        request.params,
        `result:`,
        result
      )

      return result
    } catch (error) {
      logger.warn(
        `[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`,
        request.params,
        `error:`,
        error
      )
    }
  }
}
