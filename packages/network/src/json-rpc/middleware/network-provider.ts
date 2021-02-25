import { ethers } from 'ethers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from '../types'

export const networkProviderMiddleware = (getChainId: (request: JsonRpcRequest) => number): JsonRpcMiddleware => (next: JsonRpcHandlerFunc) => {
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

    const networkChainId = getChainId(request)

    const { id, method } = request

    switch (method) {
      case 'net_version':
        callback(undefined, { jsonrpc: '2.0', id: id!, result: `${networkChainId}` })
        return

      case 'eth_chainId':
        callback(undefined, { jsonrpc: '2.0', id: id!, result: ethers.utils.hexlify(networkChainId) })
        return

      default:
    }

    // request is allowed. keep going..
    next(request, callback, chainId)
  }
}
