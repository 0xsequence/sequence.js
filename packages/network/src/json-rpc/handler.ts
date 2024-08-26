import { ethers } from 'ethers'
import { EIP1193Provider, EIP1193ProviderFunc, JsonRpcSender } from './types'

import { isJsonRpcSender, isJsonRpcProvider } from './utils'

export class JsonRpcHandler implements EIP1193Provider, JsonRpcSender {
  private provider: EIP1193ProviderFunc
  private defaultChainId?: number

  constructor(provider: EIP1193ProviderFunc | JsonRpcSender | ethers.JsonRpcProvider, defaultChainId?: number) {
    if (isJsonRpcSender(provider)) {
      this.provider = (request: { method: string; params?: any[]; chainId?: number }): Promise<any> => {
        return provider.send(request.method, request.params, request.chainId)
      }
    } else if (isJsonRpcProvider(provider)) {
      this.provider = (request: { method: string; params?: any[]; chainId?: number }): Promise<any> => {
        return provider.send(request.method, request.params || [])
      }
    } else {
      this.provider = provider
    }
    this.defaultChainId = defaultChainId
  }

  request = (request: { method: string; params?: any[]; chainId?: number }): Promise<any> => {
    if (!request.chainId) {
      request.chainId = this.defaultChainId
    }
    return this.provider(request)
  }

  send(method: string, params?: any[], chainId?: number): Promise<any> {
    const request = {
      method,
      params,
      chainId
    }
    return this.request(request)
  }
}
