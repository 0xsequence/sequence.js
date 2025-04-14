import { JsonRpcRequest, EIP1193ProviderFunc, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from '../types'

export class AllowProvider implements JsonRpcMiddlewareHandler {
  requestHandler: JsonRpcMiddleware

  private isAllowedFunc: (request: JsonRpcRequest) => boolean

  constructor(isAllowedFunc?: (request: JsonRpcRequest) => boolean) {
    if (isAllowedFunc) {
      this.isAllowedFunc = isAllowedFunc
    } else {
      this.isAllowedFunc = (request: JsonRpcRequest): boolean => true
    }

    this.requestHandler = allowProviderMiddleware(this.isAllowedFunc)
  }

  setIsAllowedFunc(fn: (request: JsonRpcRequest) => boolean) {
    this.isAllowedFunc = fn
    this.requestHandler = allowProviderMiddleware(this.isAllowedFunc)
  }
}

export const allowProviderMiddleware =
  (isAllowed: (request: JsonRpcRequest) => boolean): JsonRpcMiddleware =>
  (next: EIP1193ProviderFunc) => {
    return (request: JsonRpcRequest): Promise<any> => {
      // ensure precondition is met or do not allow the request to continue
      if (!isAllowed(request)) {
        throw new Error('allowProvider middleware precondition is unmet.')
      }

      // request is allowed. keep going..
      return next(request)
    }
  }
