import { JsonRpcProvider } from '@ethersproject/providers'
import { JsonRpcHandlerFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddlewareHandler } from '../types'
import { SignerJsonRpcMethods } from './signing-provider'

export class PublicProvider implements JsonRpcMiddlewareHandler {

  private privateJsonRpcMethods = [
    'net_version', 'eth_chainId', 'eth_accounts', ...SignerJsonRpcMethods
  ]

  private provider?: JsonRpcProvider
  private rpcUrl?: string
 
  constructor(rpcUrl?: string) {
    this.setRpcUrl(rpcUrl)
  }

  sendAsyncMiddleware = (next: JsonRpcHandlerFunc) => {
    return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
      // When provider is configured, send non-private methods to our local public provider
      if (this.provider !== null && !this.privateJsonRpcMethods.includes(request.method)) {
        this.provider.send(request.method, request.params).then(r => {
          callback(undefined, {
            jsonrpc: '2.0',
            id: request.id,
            result: r
          })
        }).catch(e => callback(e))
        return
      }

      // Continue to next handler
      console.log('[public-provider] sending request to signer window', request.method)
      next(request, callback)
    }
  }

  getRpcUrl(): string | null {
    return this.rpcUrl
  }

  setRpcUrl(rpcUrl: string) {
    if (!rpcUrl || rpcUrl === '') {
      this.rpcUrl = null
      this.provider = null
    } else {
      this.rpcUrl = rpcUrl
      this.provider = new JsonRpcProvider(rpcUrl)
    }
  }

}
