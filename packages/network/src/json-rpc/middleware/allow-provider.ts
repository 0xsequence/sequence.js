import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from '../types'

export class AllowProvider implements JsonRpcMiddlewareHandler {

  sendAsyncMiddleware: JsonRpcMiddleware

  private isAllowedFunc: () => boolean

  constructor(isAllowedFunc?: () => boolean) {
    if (isAllowedFunc) {
      this.isAllowedFunc = isAllowedFunc
    } else {
      this.isAllowedFunc = (): boolean => true
    }

    this.sendAsyncMiddleware = allowProviderMiddleware(this.isAllowedFunc)
  }

  setIsAllowedFunc(fn: () => boolean) {
    this.isAllowedFunc = fn
    this.sendAsyncMiddleware = allowProviderMiddleware(this.isAllowedFunc)
  }

}

export const allowProviderMiddleware = (isAllowed: () => boolean): JsonRpcMiddleware => (next: JsonRpcHandlerFunc) => {
  const alwaysAllowedMethods = [] //['net_version', 'eth_chainId']

  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // ensure precondition is met or do not allow the request to continue
    if (!alwaysAllowedMethods.includes(request.method) && !isAllowed()) {
      throw new Error('allowProvider middleware precondition is unmet.')
    }

    // request is allowed. keep going..
    next(request, callback, chainId)
  }
}
