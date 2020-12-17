import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddleware } from '../types'

export const allowProviderMiddleware = (isAllowed: () => boolean): JsonRpcMiddleware => (next: JsonRpcHandlerFunc) => {
  const alwaysAllowedMethods = [] //['net_version', 'eth_chainId']

  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    // ensure precondition is met or do not allow the request to continue
    if (!alwaysAllowedMethods.includes(request.method) && !isAllowed()) {
      throw new Error('allowProvider middleware precondition is unmet.')
    }

    // request is allowed. keep going..
    next(request, callback)
  }
}