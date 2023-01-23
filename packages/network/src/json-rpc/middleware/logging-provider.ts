import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseCallback, JsonRpcMiddleware } from '../types'
import { logger } from '@0xsequence/utils'

// TODO: rename to loggerMiddleware
export const loggingProviderMiddleware: JsonRpcMiddleware = (next: JsonRpcHandlerFunc) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    const chainIdLabel = chainId ? ` chainId:${chainId}` : ''
    logger.info(`[provider request]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params)

    next(request, (error: any, response?: JsonRpcResponse) => {
      if (error) {
        logger.warn(`[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params, `error:`, error)
      } else {
        logger.info(`[provider response]${chainIdLabel} id:${request.id} method:${request.method} params:`, request.params, `response:`, response)
      }
      callback(error, response)
    }, chainId)
  }
}
