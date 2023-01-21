import { ethers } from 'ethers'
import { JsonRpcRouter, JsonRpcSender, loggingProviderMiddleware, CachedProvider, JsonRpcMiddleware, JsonRpcMiddlewareHandler } from './json-rpc'
import { networks, ChainId } from './config'

// TODO: we can cache eth_getCode for our own wallet address..
// this does not change often at all.. but it's more tricky to ensure we expire
// / prune the cache perfectly, so we can add support for it another time.

// JsonRpcProvider with a middleware stack. By default it will use a simple caching middleware.
export class JsonRpcProvider extends ethers.providers.JsonRpcProvider {
  private _chainId?: number
  private _sender: JsonRpcSender

  constructor(url: ethers.utils.ConnectionInfo | string, chainId?: number, middlewares?: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>) {
    super(url, chainId)

    this._chainId = chainId

    // NOTE: it will either use the middleware stack passed to the constructor
    // or it will use the default caching middleware provider. It does not concat them,
    // so if you set middlewares, make sure you set the caching middleware yourself if you'd
    // like to keep using it.
    const router = new JsonRpcRouter(
      middlewares ?? 
      [
        // loggingProviderMiddleware,
        new CachedProvider({ chainId })
      ],
      new JsonRpcSender(this.fetch, chainId)
    )

    this._sender = new JsonRpcSender(router, chainId)
  }

  async getNetwork(): Promise<ethers.providers.Network> {
    const chainId = this._chainId
    if (chainId) {
      const network = networks[chainId as ChainId]
      const name = network?.name || ''
      return {
        name: name,
        chainId: chainId,
        ensAddress: network.ensAddress
      }
    } else {
      const chainIdHex = await this.send('eth_chainId', [])
      this._chainId = ethers.BigNumber.from(chainIdHex).toNumber()
      return this.getNetwork()
    }
  }

  send = (method: string, params: Array<any>): Promise<any> => {
    return this._sender.send(method, params)
  }

  private fetch = (method: string, params: Array<any>): Promise<any> => {
    const request = {
      method: method,
      params: params,
      id: (this._nextId++),
      jsonrpc: '2.0'
    }

    const result = ethers.utils.fetchJson(this.connection, JSON.stringify(request), getResult).then((result) => {
      return result
    }, (error) => {
      throw error
    })

    return result
  }
}

function getResult(payload: { error?: { code?: number, data?: any, message?: string }, result?: any }): any {
  if (payload.error) {
    // @TODO: not any
    const error: any = new Error(payload.error.message)
    error.code = payload.error.code
    error.data = payload.error.data
    throw error
  }
  return payload.result
}