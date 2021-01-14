import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from '../types'

export class AllowProvider implements JsonRpcMiddlewareHandler {

  sendAsyncMiddleware: JsonRpcMiddleware

  private isAllowedFunc: (request: JsonRpcRequest) => boolean

  constructor(isAllowedFunc?: (request: JsonRpcRequest) => boolean) {
    if (isAllowedFunc) {
      this.isAllowedFunc = isAllowedFunc
    } else {
      this.isAllowedFunc = (request: JsonRpcRequest): boolean => true
    }

    this.sendAsyncMiddleware = allowProviderMiddleware(this.isAllowedFunc)
  }

  setIsAllowedFunc(fn: (request: JsonRpcRequest) => boolean) {
    this.isAllowedFunc = fn
    this.sendAsyncMiddleware = allowProviderMiddleware(this.isAllowedFunc)
  }

}

export const allowProviderMiddleware = (isAllowed: (request: JsonRpcRequest) => boolean): JsonRpcMiddleware => (next: JsonRpcHandlerFunc) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // ensure precondition is met or do not allow the request to continue
    if (!isAllowed(request)) {
      throw new Error('allowProvider middleware precondition is unmet.')
    }

    // request is allowed. keep going..
    next(request, callback, chainId)
  }
}
