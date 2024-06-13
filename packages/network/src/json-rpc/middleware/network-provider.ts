import { ethers } from 'ethers'
import { EIP1193ProviderFunc, JsonRpcRequest, JsonRpcMiddleware } from '../types'

export const networkProviderMiddleware =
  (getChainId: (request: JsonRpcRequest) => number): JsonRpcMiddleware =>
  (next: EIP1193ProviderFunc) => {
    return async (request: { jsonrpc: '2.0'; id?: number; method: string; params?: any[]; chainId?: number }): Promise<any> => {
      const networkChainId = getChainId(request)

      switch (request.method) {
        case 'net_version': {
          return `${networkChainId}`
        }

        case 'eth_chainId': {
          return ethers.toBeHex(networkChainId)
        }
      }

      // request is allowed. keep going..
      return next(request)
    }
  }
