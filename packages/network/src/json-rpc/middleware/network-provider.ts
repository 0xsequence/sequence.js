import { ethers } from 'ethers'
import { EIP1193ProviderFunc, JsonRpcRequest, JsonRpcMiddleware } from '../types'

export const networkProviderMiddleware =
  (getChainId: (request: JsonRpcRequest) => number): JsonRpcMiddleware =>
  (next: EIP1193ProviderFunc) => {
    return async (request: JsonRpcRequest): Promise<any> => {
      const networkChainId = getChainId(request)

      switch (request.method) {
        case 'net_version': {
          return `${networkChainId}`
        }

        case 'eth_chainId': {
          return ethers.toQuantity(networkChainId)
        }
      }

      // request is allowed. keep going..
      return next(request)
    }
  }
