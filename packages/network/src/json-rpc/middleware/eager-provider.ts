import { commons } from '@0xsequence/core'
import { ethers } from 'ethers'
import { EIP1193ProviderFunc, JsonRpcMiddlewareHandler } from '../types'

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

  requestHandler = (next: EIP1193ProviderFunc) => {
    return async (request: { jsonrpc: '2.0'; id?: number; method: string; params?: any[]; chainId?: number }): Promise<any> => {
      switch (request.method) {
        case 'net_version':
          if (this.options.chainId) {
            return `${this.options.chainId}`
          }
          break

        case 'eth_chainId':
          if (this.options.chainId) {
            return ethers.toBeHex(this.options.chainId)
          }
          break

        case 'eth_accounts':
          if (this.options.accountAddress) {
            return [ethers.getAddress(this.options.accountAddress)]
          }
          break

        case 'sequence_getWalletContext':
          if (this.options.walletContext) {
            return this.options.walletContext
          }
          break

        default:
      }

      return next(request)
    }
  }
}
