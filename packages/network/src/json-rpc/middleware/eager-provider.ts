import { ethers } from 'ethers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse, JsonRpcMiddlewareHandler } from '../types'
import { WalletContext } from '../../context'

// EagerProvider will eagerly respond to a provider request from pre-initialized data values.
//
// This is useful for saving a few remote calls for responses we're already expecting when
// communicating to a specific network provider.

export type EagerProviderOptions = {
  accountAddress?: string,
  chainId?: number,
  walletContext?: WalletContext
}

export class EagerProvider implements JsonRpcMiddlewareHandler {

  readonly options: EagerProviderOptions

  constructor(options: EagerProviderOptions) {
    this.options = options
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

      const { id, method } = request

      switch (method) {
        case 'net_version':
          if (this.options.chainId) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: `${this.options.chainId}` })
            return
          }
          break

        case 'eth_chainId':
          if (this.options.chainId) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: ethers.utils.hexlify(this.options.chainId) })
            return
          }
          break

        case 'eth_accounts':
          if (this.options.accountAddress) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: [ethers.utils.getAddress(this.options.accountAddress)] })
            return
          }
          break

        case 'sequence_getWalletContext':
          if (this.options.walletContext) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: this.options.walletContext })
            return
          }
          break

        default:
      }

      next(request, callback, chainId)

    }
  }

}
