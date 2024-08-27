import { ethers } from 'ethers'
import {
  JsonRpcRouter,
  EagerProvider,
  SingleflightMiddleware,
  CachedProvider,
  JsonRpcMiddleware,
  JsonRpcMiddlewareHandler,
  JsonRpcHandler,
  EIP1193Provider,
  JsonRpcSender,
  JsonRpcRequest
} from './json-rpc'
import { ChainId, networks } from './constants'

export interface JsonRpcProviderOptions {
  // ..
  chainId?: number

  // ..
  middlewares?: Array<JsonRpcMiddleware | JsonRpcMiddlewareHandler>

  // ..
  blockCache?: boolean | string[]
}

// JsonRpcProvider with a middleware stack. By default it will use a simple caching middleware.
export class JsonRpcProvider extends ethers.JsonRpcProvider implements EIP1193Provider, JsonRpcSender {
  #chainId?: number
  #nextId: number = 1
  #sender: EIP1193Provider

  constructor(
    public url: string | ethers.FetchRequest | undefined,
    options?: JsonRpcProviderOptions,
    jsonRpcApiProviderOptions?: ethers.JsonRpcApiProviderOptions
  ) {
    super(url, options?.chainId, jsonRpcApiProviderOptions)

    const chainId = options?.chainId
    const middlewares = options?.middlewares
    const blockCache = options?.blockCache

    this.#chainId = chainId

    // NOTE: it will either use the middleware stack passed to the constructor
    // or it will use the default caching middleware provider. It does not concat them,
    // so if you set middlewares, make sure you set the caching middleware yourself if you'd
    // like to keep using it.
    const router = new JsonRpcRouter(
      middlewares ?? [
        // loggingProviderMiddleware,
        new EagerProvider({ chainId }),
        new SingleflightMiddleware(),
        new CachedProvider({ defaultChainId: chainId, blockCache: blockCache })
      ],
      new JsonRpcHandler(this.fetch, chainId)
    )

    this.#sender = router
  }

  async request(request: { method: string; params?: any[]; chainId?: number }): Promise<any> {
    return this.#sender.request(request)
  }

  async send(method: string, params?: any[] | Record<string, any>, chainId?: number): Promise<any> {
    return this.request({ method, params: params as any, chainId })
  }

  async getNetwork(): Promise<ethers.Network> {
    const chainId = this.#chainId
    if (chainId) {
      const network = networks[chainId as ChainId]
      const name = network?.name || ''
      const ensAddress = network?.ensAddress
      return ethers.Network.from({
        name,
        chainId,
        ensAddress
      })
    } else {
      const chainIdHex = await this.send('eth_chainId', [])
      this.#chainId = Number(chainIdHex)
      return this.getNetwork()
    }
  }

  private fetch = async (request: { method: string; params?: any[]; chainId?: number }): Promise<any> => {
    if (this.url === undefined) {
      throw new Error('missing provider URL')
    }

    const { method, params } = request

    const jsonRpcRequest: JsonRpcRequest = {
      method,
      params,
      id: this.#nextId++,
      jsonrpc: '2.0'
    }

    // const result = ethers.fetchJson(this.connection, JSON.stringify(request), getResult).then(
    //   result => {
    //     return result
    //   },
    //   error => {
    //     throw error
    //   }
    // )

    const fetchRequest = typeof this.url === 'string' ? new ethers.FetchRequest(this.url) : this.url
    fetchRequest.body = JSON.stringify(jsonRpcRequest)

    // TODOXXX: what about headers, etc..?
    // we probably need these in the options of the construtor, etc..

    try {
      const res = await fetchRequest.send()

      if (res.body) {
        try {
          const result = JSON.parse(ethers.toUtf8String(res.body))

          // TODO: Process result

          return getResult(result)
        } catch (err) {
          throw new Error('invalid JSON response')
        }
      }

      return null
    } catch (err) {
      // TODO - error handling
      throw err
    }
  }
}

function getResult(payload: { error?: { code?: number; data?: any; message?: string }; result?: any }): any {
  if (payload.error) {
    // @TODO: not any
    const error: any = new Error(payload.error.message)
    error.code = payload.error.code
    error.data = payload.error.data
    throw error
  }
  return payload.result
}
