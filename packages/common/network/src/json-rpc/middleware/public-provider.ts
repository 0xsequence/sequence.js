import { ethers } from 'ethers'
import { EIP1193ProviderFunc, JsonRpcMiddlewareHandler, JsonRpcRequest } from '../types'
import { SignerJsonRpcMethods } from './signing-provider'
import { logger } from '@0xsequence/utils'

export class PublicProvider implements JsonRpcMiddlewareHandler {
  private privateJsonRpcMethods = ['net_version', 'eth_chainId', 'eth_accounts', ...SignerJsonRpcMethods]

  private provider?: ethers.JsonRpcProvider
  private rpcUrl?: string

  constructor(rpcUrl?: string) {
    if (rpcUrl) {
      this.setRpcUrl(rpcUrl)
    }
  }

  requestHandler = (next: EIP1193ProviderFunc) => {
    return (request: JsonRpcRequest): Promise<any> => {
      // When provider is configured, send non-private methods to our local public provider
      if (this.provider && !this.privateJsonRpcMethods.includes(request.method)) {
        return this.provider.send(request.method, request.params || [])
      }

      // Continue to next handler
      logger.debug('[public-provider] sending request to signer window', request.method)
      return next(request)
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
      this.provider = new ethers.JsonRpcProvider(rpcUrl)
    }
  }
}
