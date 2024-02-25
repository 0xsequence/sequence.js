import { ethers } from 'ethers'
import {
  EIP1193ProviderFunc,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcMiddleware
} from '../types'

export const networkProviderMiddleware =
  (getChainId: (request: JsonRpcRequest) => number): JsonRpcMiddleware =>
    (next: EIP1193ProviderFunc) => {
      return (request: { jsonrpc: '2.0', id?: number, method: string, params?: any[], chainId?: number }): Promise<JsonRpcResponse> => {
        const networkChainId = getChainId(request)

        switch (request.method) {
          case 'net_version': {
            const response = { jsonrpc: '2.0', id: request.id!, result: `${networkChainId}` }
            return new Promise(resolve => resolve(response))
          }

          case 'eth_chainId': {
            const response = { jsonrpc: '2.0', id: request.id!, result: ethers.toBeHex(networkChainId) }
            return new Promise(resolve => resolve(response))
          }
        }

        // request is allowed. keep going..
        return next(request)
      }
    }
