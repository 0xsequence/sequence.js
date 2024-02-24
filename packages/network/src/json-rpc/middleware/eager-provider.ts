import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'
import { EIP1193ProviderFunc, JsonRpcRequest, JsonRpcMiddlewareHandler } from '../types'

// EagerProvider will eagerly respond to a provider request from pre-initialized data values.
//
// This is useful for saving a few remote calls for responses we're already expecting when
// communicating to a specific network provider.

export type EagerProviderOptions = {
  accountAddress?: string
  chainId?: number
  walletContext?: commons.context.VersionedContext
}

export class EagerProvider implements JsonRpcMiddlewareHandler {
  readonly options: EagerProviderOptions

  constructor(options: EagerProviderOptions) {
    this.options = options
  }

  requestMiddleware = (next: EIP1193ProviderFunc) => {
    return (request: { jsonrpc: '2.0', id?: number, method: string, params?:  Array<any> | Record<string, any>, chainId?: number }): Promise<any> => {
      switch (request.method) {
        case 'net_version':
          if (this.options.chainId) {
            const response = { jsonrpc: '2.0', id: request.id!, result: `${this.options.chainId}` }
            return new Promise(resolve => resolve(response))
          }
          break

        case 'eth_chainId':
          if (this.options.chainId) {
            const response = { jsonrpc: '2.0', id: request.id!, result: ethers.toBeHex(this.options.chainId) }
            return new Promise(resolve => resolve(response))
          }
          break

        case 'eth_accounts':
          if (this.options.accountAddress) {
            const response = { jsonrpc: '2.0', id: request.id!, result: [ethers.getAddress(this.options.accountAddress)] }
            return new Promise(resolve => resolve(response))
          }
          break

        case 'sequence_getWalletContext':
          if (this.options.walletContext) {
            const response = { jsonrpc: '2.0', id: request.id!, result: this.options.walletContext }
            return new Promise(resolve => resolve(response))
          }
          break

        default:
      }

      return next(request)
    }
  }
}
