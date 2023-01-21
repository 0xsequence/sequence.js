import { providers } from 'ethers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'
import { SignerJsonRpcMethods } from './signing-provider'
import { logger } from '@0xsequence/utils'

export class PublicProvider implements JsonRpcMiddlewareHandler {

  private privateJsonRpcMethods = [
    'net_version', 'eth_chainId', 'eth_accounts', ...SignerJsonRpcMethods
  ]

  private provider?: providers.JsonRpcProvider
  private rpcUrl?: string
 
  constructor(rpcUrl?: string) {
    if (rpcUrl) {
      this.setRpcUrl(rpcUrl)
    }
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
      // When provider is configured, send non-private methods to our local public provider
      if (this.provider && !this.privateJsonRpcMethods.includes(request.method)) {
        this.provider.send(request.method, request.params!).then(r => {
          callback(undefined, {
            jsonrpc: '2.0',
            id: request.id!,
            result: r
          })
        }).catch(e => callback(e))
        return
      }

      // Continue to next handler
      logger.debug('[public-provider] sending request to signer window', request.method)
      next(request, callback)
    }
  }

  getRpcUrl() {
    return this.rpcUrl
  }

  setRpcUrl(rpcUrl: string) {
    if (!rpcUrl || rpcUrl === '') {
      this.rpcUrl = undefined
      this.provider = undefined
    } else {
      this.rpcUrl = rpcUrl
      // TODO: maybe use @0xsequence/network JsonRpcProvider here instead,
      // which supports better caching.
      this.provider = new providers.JsonRpcProvider(rpcUrl)
    }
  }

}
