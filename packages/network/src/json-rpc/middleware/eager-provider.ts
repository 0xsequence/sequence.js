import { ethers } from 'ethers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse, JsonRpcMiddlewareHandler } from '../types'
import { WalletContext } from '../../context'

// EagerProvider will eagerly respond to a provider request from pre-initialized data values.
//
// This is useful for saving a few remote calls for responses we're already expecting when
// communicating to a specific network provider.

export type EagerProviderProps = {
  accountAddress?: string,
  chainId?: number,
  walletContext?: WalletContext
}

export class EagerProvider implements JsonRpcMiddlewareHandler {

  readonly props: EagerProviderProps

  constructor(props: EagerProviderProps) {
    this.props = props
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

      const { id, method } = request

      switch (method) {
        case 'net_version':
          if (this.props.chainId) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: `${this.props.chainId}` })
            return
          }
          break

        case 'eth_chainId':
          if (this.props.chainId) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: ethers.utils.hexlify(this.props.chainId) })
            return
          }
          break

        case 'eth_accounts':
          if (this.props.accountAddress) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: [ethers.utils.getAddress(this.props.accountAddress)] })
            return
          }
          break

        case 'sequence_getWalletContext':
          if (this.props.walletContext) {
            callback(undefined, { jsonrpc: '2.0', id: id!, result: this.props.walletContext })
            return
          }
          break

        default:
      }

      next(request, callback, chainId)

    }
  }

}
