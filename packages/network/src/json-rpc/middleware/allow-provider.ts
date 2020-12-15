import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddleware } from '../types'

export const allowProviderMiddleware = (isAllowed: () => boolean): JsonRpcMiddleware => (next: JsonRpcHandlerFunc) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    // ensure precondition is met or do not allow the request to continue
    if (!isAllowed()) {
      throw new Error('allowProvider middleware precondition is unmet.')
    }

    // request is allowed. keep going..
    next(request, callback)
  }
}