import {
  EIP1193Provider,
  EIP1193ProviderFunc,
  JsonRpcSender
} from './types'

import { isJsonRpcSender } from './utils'

export class JsonRpcHandler implements EIP1193Provider, JsonRpcSender {
  #provider: EIP1193ProviderFunc
  #defaultChainId?: number

  constructor(provider: EIP1193ProviderFunc | JsonRpcSender, defaultChainId?: number) {
    if (isJsonRpcSender(provider)) {
      this.#provider = (request: { method: string, params?: Array<any> | Record<string, any>, chainId?: number }): Promise<any> => {
        return provider.send(request.method, request.params, request.chainId)
      }
    } else {
      this.#provider = provider
    }
    this.#defaultChainId = defaultChainId
  }

  request(request: { method: string, params?: Array<any> | Record<string, any>, chainId?: number }): Promise<any> {
    if (!request.chainId) {
      request.chainId = this.#defaultChainId
    }
    return this.#provider(request)
  }

  send(method: string, params?: Array<any> | Record<string, any>, chainId?: number): Promise<any> {
    const request = {
      method, params, chainId
    }
    return this.request(request)
  }
}
