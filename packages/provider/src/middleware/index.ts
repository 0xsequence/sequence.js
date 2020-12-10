import { JsonRpcHandlerFunc } from '../types'

export type JsonRpcMiddleware = (next: JsonRpcHandlerFunc) => JsonRpcHandlerFunc

export interface JsonRpcMiddlewareHandler {
  sendAsyncMiddleware: JsonRpcMiddleware
}

export { loggingProviderMiddleware } from './logging-provider'
export { allowProviderMiddleware } from './allow-provider'
export { PublicProvider } from './public-provider'
export { CachedProvider } from './cached-provider'
